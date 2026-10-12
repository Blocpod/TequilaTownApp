/** Test helpers: in-memory app, controllable clock, JSON/SSE request helpers. */
import { expect } from 'vitest';
import type { Session } from '../shared/api';
import { createApp, type App } from './app';
import { signCode } from './codes';
import { DEFAULT_MODELS, type Config } from './config';
import type { AppleVerifier, Logger } from './context';
import { MemoryStore } from './store';

export const TEST_QR_SECRET = 'test-qr-secret';
export const TEST_ADMIN_KEY = 'test-admin-key';

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    deployed: false,
    netlifyDev: false,
    jwtSecret: 'test-jwt-secret-0123456789-abcdefghijklmnop',
    jwtSecretIsDev: false,
    qrSecret: TEST_QR_SECRET,
    qrSecretIsDev: false,
    openrouterKey: null,
    openrouterBaseUrl: null,
    models: { ...DEFAULT_MODELS },
    resendKey: null,
    resetEmailFrom: null,
    appleBundleIds: ['com.tequilatown.app'],
    appleSignIn: true,
    adminKey: TEST_ADMIN_KEY,
    publicBaseUrl: null,
    appStoreUrl: null,
    playStoreUrl: null,
    scryptN: 1024,
    ...overrides,
  };
}

export class Clock {
  constructor(public t = new Date('2026-10-12T15:00:00.000Z').getTime()) {}
  now = () => new Date(this.t);
  advance(ms: number) {
    this.t += ms;
  }
}

export type TestHarness = {
  app: App;
  store: MemoryStore;
  clock: Clock;
  fetchMock: FetchMock;
  logs: { level: string; msg: string; ctx?: Record<string, unknown> }[];
};

export type FetchMock = ((input: string | URL | Request, init?: RequestInit) => Promise<Response>) & {
  calls: { url: string; init?: RequestInit; body?: unknown }[];
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response;
};

export function makeFetchMock(): FetchMock {
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let body: unknown;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    fn.calls.push({ url, init, body });
    return fn.handler(url, init);
  }) as FetchMock;
  fn.calls = [];
  fn.handler = () => {
    throw new Error('unexpected outbound fetch');
  };
  return fn;
}

export function makeHarness(opts: { config?: Partial<Config>; verifyAppleToken?: AppleVerifier } = {}): TestHarness {
  const store = new MemoryStore();
  const clock = new Clock();
  const fetchMock = makeFetchMock();
  const logs: TestHarness['logs'] = [];
  const logger: Logger = {
    info: (msg, ctx) => logs.push({ level: 'info', msg, ctx }),
    warn: (msg, ctx) => logs.push({ level: 'warn', msg, ctx }),
    error: (msg, ctx) => logs.push({ level: 'error', msg, ctx }),
  };
  const app = createApp({
    store,
    config: testConfig(opts.config),
    fetch: fetchMock,
    now: clock.now,
    logger,
    verifyAppleToken: opts.verifyAppleToken,
  });
  return { app, store, clock, fetchMock, logs };
}

export const BASE = 'https://tt.test';

export type CallResult<T = any> = { status: number; body: T; headers: Headers; text: string };

export async function call<T = any>(
  h: Pick<TestHarness, 'app'>,
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<CallResult<T>> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await h.app.fetch(
    new Request(`${BASE}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    }),
    { ip: '203.0.113.7' },
  );
  const text = await res.text();
  let body: any = text;
  if ((res.headers.get('content-type') ?? '').includes('application/json')) body = text ? JSON.parse(text) : null;
  return { status: res.status, body, headers: res.headers, text };
}

let counter = 0;
export async function signup(
  h: Pick<TestHarness, 'app'>,
  overrides: Partial<{ email: string; password: string; name: string; birthDate: string }> = {},
): Promise<Session> {
  counter++;
  const res = await call<Session>(h, 'POST', '/api/auth/signup', {
    body: {
      email: `guest${counter}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      password: 'agave-fields-42',
      name: `Guest Number${counter}`,
      birthDate: '1990-05-17',
      ...overrides,
    },
  });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${res.text}`);
  return res.body;
}

export const code = (slug: string) => signCode(slug, TEST_QR_SECRET);

/** Parses a text/event-stream body into JSON events. */
export function parseSse(text: string): any[] {
  return text
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      expect(block.startsWith('data: ')).toBe(true);
      return JSON.parse(block.slice(6));
    });
}

/** Builds an upstream OpenRouter-style SSE Response from raw lines. */
export function sseResponse(chunks: string[], status = 200): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return new Response(stream, { status, headers: { 'content-type': 'text/event-stream' } });
}

/** A tiny valid PNG (1×1) and JPEG header-bearing buffer for upload tests. */
export const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
export const JPEG_STUB = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(256, 7), Buffer.from([0xff, 0xd9])]);

