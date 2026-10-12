/**
 * In-memory fixed-window rate limiter, per warm function instance.
 *
 * This is a burst guard, not a global quota: each Netlify instance keeps its own
 * counters. Durable limits (daily AI allowances, failed-login lockout) live in
 * Blobs. The platform-level `rateLimit` in the function config is the outer
 * backstop.
 */
import { ApiError } from './http';

export type Rule = { limit: number; windowMs: number };

export const RULES = {
  /** auth endpoints, per client IP (venue Wi-Fi/carrier NAT share IPs — keep generous) */
  authIp: { limit: 60, windowMs: 60_000 },
  /** any authenticated request, per user */
  user: { limit: 240, windowMs: 60_000 },
  chat: { limit: 12, windowMs: 60_000 },
  memories: { limit: 3, windowMs: 60_000 },
  identify: { limit: 8, windowMs: 60_000 },
  persona: { limit: 3, windowMs: 60_000 },
  forgot: { limit: 20, windowMs: 15 * 60_000 },
} satisfies Record<string, Rule>;

export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 20_000,
  ) {}

  /** Throws 429 RATE_LIMITED when `key` exceeded `rule` in the current window. */
  check(key: string, rule: Rule): void {
    const t = this.now();
    let e = this.hits.get(key);
    if (!e || t >= e.resetAt) {
      if (this.hits.size >= this.maxKeys) this.sweep(t);
      e = { count: 0, resetAt: t + rule.windowMs };
      this.hits.set(key, e);
    }
    e.count++;
    if (e.count > rule.limit) {
      const retry = Math.max(1, Math.ceil((e.resetAt - t) / 1000));
      throw new ApiError('RATE_LIMITED', 'Too many requests. Please slow down', {
        headers: { 'retry-after': String(retry) },
        details: { retryAfterSeconds: retry },
      });
    }
  }

  private sweep(t: number) {
    for (const [k, v] of this.hits) if (t >= v.resetAt) this.hits.delete(k);
    // Still full (a flood of distinct keys): drop the oldest half.
    if (this.hits.size >= this.maxKeys) {
      let i = 0;
      const drop = this.maxKeys / 2;
      for (const k of this.hits.keys()) {
        if (i++ >= drop) break;
        this.hits.delete(k);
      }
    }
  }
}
