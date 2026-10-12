/**
 * Signed venue QR codes.
 *
 *   code = `${slug}-${sig}`   e.g. AGV-SHRINE-7K2QD
 *   sig  = first 5 chars of Crockford-base32(HMAC-SHA256(QR_SIGNING_SECRET, slug))
 *
 * 25 bits of signature: a guess succeeds with p = 1/33,554,432, so codes can't be
 * forged by reading the slug list in shared/content/missions.ts.
 *
 * IMPORTANT: this module must import ONLY `node:crypto` and use erasable TypeScript
 * syntax — `scripts/generate-qr-codes.mjs` imports it directly with Node's
 * built-in type stripping (no bundler).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Fixed secret used only in local development when QR_SIGNING_SECRET is unset. */
export const DEV_QR_SECRET = 'tt-dev-only-qr-secret-do-not-use-in-production';
export const SIGNATURE_LENGTH = 5;
const SLUG_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export function crockfordBase32(bytes: Uint8Array): string {
  let out = '';
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function signature(slug: string, secret: string): string {
  return crockfordBase32(createHmac('sha256', secret).update(slug, 'utf8').digest()).slice(0, SIGNATURE_LENGTH);
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 40 && SLUG_RE.test(slug);
}

/** Signs a code slug (as printed in shared/content/missions.ts) for printing on a venue QR. */
export function signCode(slug: string, secret: string): string {
  if (!secret) throw new Error('signCode: secret is required');
  if (!isValidSlug(slug)) throw new Error(`signCode: invalid slug "${slug}"`);
  return `${slug}-${signature(slug, secret)}`;
}

/** Crockford decoding is forgiving of look-alike characters typed by hand. */
function canonicalSignature(sig: string): string {
  return sig.replace(/O/g, '0').replace(/[IL]/g, '1');
}

/**
 * Verifies a signed code (case-insensitive) in constant time.
 * Returns the slug when the signature is valid, otherwise null.
 */
export function verifyCode(code: string, secret: string): string | null {
  if (typeof code !== 'string' || !secret) return null;
  const c = code.trim().toUpperCase();
  const dash = c.lastIndexOf('-');
  if (dash <= 0) return null;
  const slug = c.slice(0, dash);
  const sig = canonicalSignature(c.slice(dash + 1));
  if (sig.length !== SIGNATURE_LENGTH || !isValidSlug(slug)) return null;
  const expected = signature(slug, secret);
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? slug : null;
}

/**
 * Extracts the code from anything a camera might read:
 *   - a raw code                      `agv-shrine-7k2qd`
 *   - the app deep link               `tequilatown://scan/AGV-SHRINE-7K2QD`
 *   - the web landing URL (any host)  `https://tequilatown.com/s/AGV-SHRINE-7K2QD`
 * Returns the trimmed, upper-cased code, or null for unrelated URLs / empty input.
 */
export function normalizeScanPayload(payload: string): string | null {
  if (typeof payload !== 'string') return null;
  const raw = payload.trim();
  if (!raw || raw.length > 1024) return null;

  let candidate: string;
  const deepLink = /^tequilatown:\/\/scan\/([^?#]+)/i.exec(raw);
  if (deepLink) {
    candidate = deepLink[1];
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const m = /^\/s\/([^/]+)\/?$/.exec(url.pathname);
    if (!m) return null;
    candidate = m[1];
  } else {
    candidate = raw;
  }

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // keep as-is
  }
  candidate = candidate.replace(/\/+$/, '').trim().toUpperCase();
  if (!candidate || candidate.length > 100) return null;
  return candidate;
}
