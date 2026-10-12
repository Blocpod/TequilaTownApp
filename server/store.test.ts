import { describe, expect, it } from 'vitest';
import { ApiError } from './http';
import { casUpdate, MemoryStore, NO_CHANGE } from './store';

describe('MemoryStore conditional writes', () => {
  it('honors onlyIfNew and onlyIfMatch like Netlify Blobs', async () => {
    const kv = new MemoryStore().ns('users');
    const a = await kv.setJSON('k', { v: 1 }, { onlyIfNew: true });
    expect(a.modified).toBe(true);
    expect((await kv.setJSON('k', { v: 2 }, { onlyIfNew: true })).modified).toBe(false);
    const cur = await kv.getJSON<{ v: number }>('k');
    expect(cur?.value.v).toBe(1);
    expect((await kv.setJSON('k', { v: 3 }, { onlyIfMatch: '"nope"' })).modified).toBe(false);
    const ok = await kv.setJSON('k', { v: 3 }, { onlyIfMatch: cur!.etag });
    expect(ok.modified).toBe(true);
    expect(ok.etag).not.toBe(cur!.etag);
    expect((await kv.setJSON('missing', { v: 1 }, { onlyIfMatch: cur!.etag })).modified).toBe(false);
  });

  it('stores bytes with metadata and lists by prefix', async () => {
    const kv = new MemoryStore().ns('media');
    await kv.setBytes('avatars/a', new Uint8Array([1, 2, 3]), { contentType: 'image/png' });
    await kv.setBytes('memories/b', new Uint8Array([4]), {});
    expect(await kv.listKeys('avatars/')).toEqual(['avatars/a']);
    const got = await kv.getBytes('avatars/a');
    expect([...got!.data]).toEqual([1, 2, 3]);
    expect(got!.metadata.contentType).toBe('image/png');
    expect(await kv.getMetadata('memories/b')).toEqual({});
    await kv.delete('avatars/a');
    expect(await kv.getBytes('avatars/a')).toBeNull();
  });
});

describe('casUpdate', () => {
  it('serializes concurrent read-modify-write cycles without lost updates', async () => {
    const store = new MemoryStore();
    const kv = store.ns('progress');
    await Promise.all(
      Array.from({ length: 4 }, () =>
        casUpdate<{ n: number }>(kv, 'counter', (d) => {
          d.n += 1;
        }, { init: () => ({ n: 0 }), retries: 10 }),
      ),
    );
    expect((await kv.getJSON<{ n: number }>('counter'))?.value.n).toBe(4);
  });

  it('gives up with 409 CONFLICT after the retry budget', async () => {
    const store = new MemoryStore();
    const kv = store.ns('progress');
    await kv.setJSON('hot', { n: 0 });
    let attempts = 0;
    const err = await casUpdate<{ n: number }>(kv, 'hot', async (d) => {
      attempts++;
      // Someone else always writes between our read and our write.
      await kv.setJSON('hot', { n: Math.random() });
      d.n = -1;
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('CONFLICT');
    expect(attempts).toBe(5);
  });

  it('skips the write when nothing changed', async () => {
    const store = new MemoryStore();
    const kv = store.ns('users');
    await kv.setJSON('u', { a: 1 });
    const before = store.writes;
    const r1 = await casUpdate<{ a: number }>(kv, 'u', () => NO_CHANGE);
    const r2 = await casUpdate<{ a: number }>(kv, 'u', (d) => {
      d.a = 1;
    });
    expect(r1.changed).toBe(false);
    expect(r2.changed).toBe(false);
    expect(store.writes).toBe(before);
  });

  it('throws NOT_FOUND without init', async () => {
    const kv = new MemoryStore().ns('users');
    await expect(casUpdate(kv, 'nobody', () => undefined)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
