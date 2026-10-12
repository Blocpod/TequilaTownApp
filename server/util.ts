import { createHash, randomBytes, randomInt } from 'node:crypto';
import { CROCKFORD_ALPHABET } from './codes';

export const sha256hex = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');

/** URL-safe random id with `bytes` bytes of entropy (16 bytes → 22 chars). */
export const randomId = (bytes = 16) => randomBytes(bytes).toString('base64url');

/** Uniformly random Crockford base32 string (no I, L, O, U — easy to read aloud). */
export function randomCrockford(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CROCKFORD_ALPHABET[randomInt(32)];
  return out;
}

/** UTC calendar day, used for daily AI allowances. */
export const utcDay = (d: Date) => d.toISOString().slice(0, 10);

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
