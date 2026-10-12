/**
 * Dependency injection: everything with side effects (storage, network, clock,
 * Apple JWKS, CDN purge) is passed in, so the whole API runs in-process in tests.
 */
import type { Config } from './config';
import type { RateLimiter } from './ratelimit';
import type { Store } from './store';
import type { UserRecord } from './types';

export type LogContext = Record<string, unknown>;
export type Logger = {
  info(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  error(msg: string, ctx?: LogContext): void;
};

export const consoleLogger: Logger = {
  info: (msg, ctx) => console.log(JSON.stringify({ level: 'info', msg, ...ctx })),
  warn: (msg, ctx) => console.warn(JSON.stringify({ level: 'warn', msg, ...ctx })),
  error: (msg, ctx) => console.error(JSON.stringify({ level: 'error', msg, ...ctx })),
};

export const silentLogger: Logger = { info() {}, warn() {}, error() {} };

export type AppleClaims = { sub: string; email: string | null; emailVerified: boolean };
export type AppleVerifier = (identityToken: string, audiences: string[]) => Promise<AppleClaims>;

export type Deps = {
  store: Store;
  config: Config;
  /** Outbound HTTP (OpenRouter, Resend). Defaults to global fetch. */
  fetch?: typeof fetch;
  now?: () => Date;
  logger?: Logger;
  verifyAppleToken?: AppleVerifier;
  /** Invalidates CDN-cached media by cache tag after deletion. Optional. */
  purgeCache?: (tags: string[]) => Promise<void>;
};

/** Resolved, instance-wide services. */
export type Services = {
  store: Store;
  config: Config;
  fetch: typeof fetch;
  now: () => Date;
  log: Logger;
  verifyAppleToken: AppleVerifier;
  purgeCache: (tags: string[]) => Promise<void>;
  limiter: RateLimiter;
};

/** Per-request context handed to route handlers. */
export type Ctx = {
  svc: Services;
  req: Request;
  url: URL;
  params: Record<string, string>;
  /** Public origin used for absolute URLs (PUBLIC_BASE_URL or the request origin). */
  origin: string;
  ip: string;
  requestId: string;
  /** Run work after the response is sent (context.waitUntil); awaited inline in tests. */
  defer(task: () => Promise<unknown>, label: string): void;
  /** Present on authenticated routes. */
  user: UserRecord;
};

export const mediaUrl = (origin: string, kind: 'avatars' | 'memories', id: string) => `${origin}/api/media/${kind}/${id}`;
