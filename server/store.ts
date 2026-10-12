/**
 * Storage abstraction over Netlify Blobs.
 *
 * Every namespace maps to one site-wide Blobs store opened with **strong
 * consistency**, so reads always observe the latest write (required for the
 * optimistic-concurrency read-modify-write cycles in progress/users/leaderboard).
 *
 * Conditional writes (`onlyIfNew`, `onlyIfMatch`) are the only concurrency
 * primitive Blobs offers; `casUpdate()` builds a retrying compare-and-swap on top.
 *
 * `MemoryStore` implements identical semantics for tests and is used by the
 * in-process end-to-end test.
 */
import { ApiError } from './http';

export type Namespace =
  | 'users'
  | 'indexes'
  | 'tokens'
  | 'progress'
  | 'tickets'
  | 'media'
  | 'memories'
  | 'shop'
  | 'leaderboard'
  | 'analytics';

export type Metadata = Record<string, unknown>;
export type WriteCondition = { onlyIfNew: true } | { onlyIfMatch: string };
export type WriteResult = { modified: boolean; etag?: string };

export interface KV {
  getJSON<T>(key: string): Promise<{ value: T; etag: string } | null>;
  setJSON(key: string, value: unknown, cond?: WriteCondition): Promise<WriteResult>;
  getBytes(key: string): Promise<{ data: Uint8Array; metadata: Metadata } | null>;
  getStream(key: string): Promise<{ stream: ReadableStream<Uint8Array>; metadata: Metadata } | null>;
  getMetadata(key: string): Promise<Metadata | null>;
  setBytes(key: string, data: Uint8Array, metadata?: Metadata): Promise<void>;
  delete(key: string): Promise<void>;
  /** All keys with the given prefix (auto-paginated). */
  listKeys(prefix?: string): Promise<string[]>;
}

export interface Store {
  ns(name: Namespace): KV;
}

// ---------------------------------------------------------------------------
// Netlify Blobs implementation
// ---------------------------------------------------------------------------

type BlobsModule = typeof import('@netlify/blobs');

export class BlobsStore implements Store {
  private readonly kvs = new Map<Namespace, KV>();
  constructor(
    private readonly blobs: Pick<BlobsModule, 'getStore'>,
    private readonly prefix = 'tt-',
  ) {}

  ns(name: Namespace): KV {
    let kv = this.kvs.get(name);
    if (!kv) {
      kv = new BlobsKV(() => this.blobs.getStore({ name: `${this.prefix}${name}`, consistency: 'strong' }));
      this.kvs.set(name, kv);
    }
    return kv;
  }
}

const toArrayBuffer = (u: Uint8Array): ArrayBuffer =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

class BlobsKV implements KV {
  // The Blobs client is resolved lazily on every call: in Functions the
  // environment context is injected per invocation.
  constructor(private readonly open: () => ReturnType<BlobsModule['getStore']>) {}

  async getJSON<T>(key: string) {
    const store = this.open();
    const res = await store.getWithMetadata(key, { type: 'text' });
    if (!res || res.data === null || res.data === undefined) return null;
    if (res.etag) return { value: JSON.parse(res.data) as T, etag: res.etag };

    // The local Blobs sandbox used by `netlify dev` (@netlify/blobs/server) sends no
    // ETag on GET — only on PUT and list. Production does. Recover it from list(),
    // re-reading until the ETag is stable around the read so data and ETag match.
    for (let attempt = 0; attempt < 4; attempt++) {
      const before = await this.listEtag(store, key);
      const again = await store.getWithMetadata(key, { type: 'text' });
      const after = await this.listEtag(store, key);
      if (!again || again.data === null || again.data === undefined) return null;
      if (before && before === after) return { value: JSON.parse(again.data) as T, etag: before };
    }
    throw new Error(`Blobs: could not obtain a stable ETag for "${key}"`);
  }

  private async listEtag(store: ReturnType<BlobsModule['getStore']>, key: string): Promise<string | undefined> {
    const { blobs } = await store.list({ prefix: key });
    return blobs.find((b) => b.key === key)?.etag || undefined;
  }

  async setJSON(key: string, value: unknown, cond?: WriteCondition): Promise<WriteResult> {
    // An empty ETag would make the Blobs client silently drop the condition and
    // overwrite unconditionally — never allow a CAS write to fail open.
    if (cond && 'onlyIfMatch' in cond && !cond.onlyIfMatch) throw new Error(`Blobs: refusing conditional write to "${key}" without an ETag`);
    const store = this.open();
    const res =
      cond && 'onlyIfNew' in cond
        ? await store.setJSON(key, value, { onlyIfNew: true })
        : cond && 'onlyIfMatch' in cond
          ? await store.setJSON(key, value, { onlyIfMatch: cond.onlyIfMatch })
          : await store.setJSON(key, value);
    return { modified: res.modified, etag: res.etag };
  }

  async getBytes(key: string) {
    const res = await this.open().getWithMetadata(key, { type: 'arrayBuffer' });
    if (!res || !res.data) return null;
    return { data: new Uint8Array(res.data), metadata: res.metadata ?? {} };
  }

  async getStream(key: string) {
    const res = await this.open().getWithMetadata(key, { type: 'stream' });
    if (!res || !res.data) return null;
    return { stream: res.data as ReadableStream<Uint8Array>, metadata: res.metadata ?? {} };
  }

  async getMetadata(key: string) {
    const res = await this.open().getMetadata(key);
    return res ? (res.metadata ?? {}) : null;
  }

  async setBytes(key: string, data: Uint8Array, metadata: Metadata = {}) {
    await this.open().set(key, toArrayBuffer(data), { metadata });
  }

  async delete(key: string) {
    await this.open().delete(key);
  }

  async listKeys(prefix?: string) {
    const { blobs } = await this.open().list(prefix ? { prefix } : {});
    return blobs.map((b) => b.key);
  }
}

// ---------------------------------------------------------------------------
// In-memory implementation (tests)
// ---------------------------------------------------------------------------

type Entry = { data: string | Uint8Array; etag: string; metadata: Metadata };

export class MemoryStore implements Store {
  readonly data = new Map<Namespace, Map<string, Entry>>();
  private counter = 0;
  private readonly kvs = new Map<Namespace, KV>();
  /** Total number of write operations (useful for asserting no-op writes are skipped). */
  writes = 0;

  ns(name: Namespace): KV {
    let kv = this.kvs.get(name);
    if (!kv) {
      if (!this.data.has(name)) this.data.set(name, new Map());
      kv = new MemoryKV(this.data.get(name)!, () => `"${++this.counter}"`, () => this.writes++);
      this.kvs.set(name, kv);
    }
    return kv;
  }

  /** Every key in every namespace — used by the account-deletion test. */
  dump(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [ns, m] of this.data) if (m.size) out[ns] = [...m.keys()].sort();
    return out;
  }
}

/** Yields to the event loop so concurrent operations interleave like real I/O. */
const tick = () => new Promise<void>((r) => setImmediate(r));

class MemoryKV implements KV {
  constructor(
    private readonly m: Map<string, Entry>,
    private readonly nextEtag: () => string,
    private readonly onWrite: () => void,
  ) {}

  async getJSON<T>(key: string) {
    await tick();
    const e = this.m.get(key);
    if (!e) return null;
    const text = typeof e.data === 'string' ? e.data : Buffer.from(e.data).toString('utf8');
    return { value: JSON.parse(text) as T, etag: e.etag };
  }

  async setJSON(key: string, value: unknown, cond?: WriteCondition): Promise<WriteResult> {
    if (cond && 'onlyIfMatch' in cond && !cond.onlyIfMatch) throw new Error(`refusing conditional write to "${key}" without an ETag`);
    await tick();
    const cur = this.m.get(key);
    if (cond && 'onlyIfNew' in cond && cur) return { modified: false };
    if (cond && 'onlyIfMatch' in cond && (!cur || cur.etag !== cond.onlyIfMatch)) return { modified: false };
    const etag = this.nextEtag();
    this.m.set(key, { data: JSON.stringify(value), etag, metadata: {} });
    this.onWrite();
    return { modified: true, etag };
  }

  async getBytes(key: string) {
    await tick();
    const e = this.m.get(key);
    if (!e) return null;
    const data = typeof e.data === 'string' ? new TextEncoder().encode(e.data) : new Uint8Array(e.data);
    return { data, metadata: { ...e.metadata } };
  }

  async getStream(key: string) {
    const res = await this.getBytes(key);
    if (!res) return null;
    const bytes = res.data;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    });
    return { stream, metadata: res.metadata };
  }

  async getMetadata(key: string) {
    await tick();
    const e = this.m.get(key);
    return e ? { ...e.metadata } : null;
  }

  async setBytes(key: string, data: Uint8Array, metadata: Metadata = {}) {
    await tick();
    this.m.set(key, { data: new Uint8Array(data), etag: this.nextEtag(), metadata: { ...metadata } });
    this.onWrite();
  }

  async delete(key: string) {
    await tick();
    if (this.m.delete(key)) this.onWrite();
  }

  async listKeys(prefix = '') {
    await tick();
    return [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

// ---------------------------------------------------------------------------
// Compare-and-swap helper
// ---------------------------------------------------------------------------

/** Return from a CAS mutator to signal "nothing changed, skip the write". */
export const NO_CHANGE = Symbol('NO_CHANGE');

export type CasOptions<T> = {
  /** Value used when the key does not exist yet. Omit to throw NOT_FOUND. */
  init?: () => T;
  /** Maximum attempts before giving up with 409 CONFLICT (default 5). */
  retries?: number;
};

/**
 * Optimistic-concurrency read-modify-write:
 *  1. read value + ETag (strongly consistent)
 *  2. run `mutate` on a private copy (it may throw ApiError to abort, or return NO_CHANGE)
 *  3. write with `onlyIfMatch` (or `onlyIfNew` for a fresh key)
 *  4. on a lost race, back off with jitter and retry (default ≤ 5 attempts)
 *
 * `mutate` can run several times, so it must only touch the draft it is given.
 */
export async function casUpdate<T, R = void>(
  kv: KV,
  key: string,
  mutate: (draft: T) => R | typeof NO_CHANGE | Promise<R | typeof NO_CHANGE>,
  opts: CasOptions<T> = {},
): Promise<{ value: T; result: R | undefined; changed: boolean }> {
  const attempts = opts.retries ?? 5;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const cur = await kv.getJSON<T>(key);
    let draft: T;
    if (cur) draft = structuredClone(cur.value);
    else if (opts.init) draft = opts.init();
    else throw new ApiError('NOT_FOUND', 'Not found');
    const before = JSON.stringify(draft);
    const result = await mutate(draft);
    if (result === NO_CHANGE || (cur && JSON.stringify(draft) === before)) {
      return { value: cur ? cur.value : draft, result: result === NO_CHANGE ? undefined : result, changed: false };
    }
    const write = await kv.setJSON(key, draft, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (write.modified) return { value: draft, result, changed: true };
    // Lost the race — someone else wrote in between. Back off and retry.
    await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 40 * (attempt + 1)) + 5));
  }
  throw new ApiError('CONFLICT', 'The server is busy, please try again', { status: 409, headers: { 'retry-after': '1' } });
}
