/**
 * HTTP primitives: typed API errors, JSON responses, CORS, body parsing and
 * small hand-rolled validators. Framework-free (WHATWG Request/Response only).
 */
import type { ApiErrorBody, ErrorCode } from '../shared/api';

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  TOKEN_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  UNDERAGE: 403,
  RATE_LIMITED: 429,
  LIMIT_REACHED: 429,
  LOCKED: 403,
  NOT_STARTED: 400,
  INVALID_CODE: 400,
  WRONG_ANSWER: 400,
  INCOMPLETE_STEPS: 400,
  TICKET_TAKEN: 409,
  AI_UNAVAILABLE: 503,
  AI_REFUSED: 422,
  NOT_CONFIGURED: 501,
  SERVER_ERROR: 500,
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly headers?: Record<string, string>;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { status?: number; details?: Record<string, unknown>; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = opts.status ?? DEFAULT_STATUS[code];
    this.details = opts.details;
    this.headers = opts.headers;
  }
}

export const badRequest = (message: string, details?: Record<string, unknown>) =>
  new ApiError('BAD_REQUEST', message, { details });

export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, x-admin-key, x-request-id',
  'access-control-expose-headers': 'x-request-id, retry-after, x-ai-remaining',
  'access-control-max-age': '86400',
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function errorResponse(err: ApiError): Response {
  const body: ApiErrorBody = { error: err.message, code: err.code };
  if (err.details) body.details = err.details;
  return json(body, err.status, err.headers ?? {});
}

/** Merges extra headers into an existing response (Response headers can be immutable). */
export function withHeaders(res: Response, headers: Record<string, string>): Response {
  const merged = new Headers(res.headers);
  for (const [k, v] of Object.entries(headers)) if (!merged.has(k)) merged.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: merged });
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

/** Netlify's buffered request limit is 6 MB; stay just under it. */
export const MAX_JSON_BYTES = 6 * 1024 * 1024 - 64 * 1024;

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new ApiError('BAD_REQUEST', 'Request body too large', { status: 413 });
  let text: string;
  try {
    text = await req.text();
  } catch {
    throw badRequest('Could not read request body');
  }
  if (Buffer.byteLength(text) > maxBytes) throw new ApiError('BAD_REQUEST', 'Request body too large', { status: 413 });
  if (!text.trim()) throw badRequest('Request body must be a JSON object');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw badRequest('Request body is not valid JSON');
  }
  if (!isPlainObject(parsed)) throw badRequest('Request body must be a JSON object');
  return parsed;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Validators — each throws ApiError(BAD_REQUEST) with a field-specific message.
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(s: string): string {
  return s.replace(CONTROL_CHARS, '').trim();
}

export function reqString(
  body: Record<string, unknown>,
  key: string,
  opts: { min?: number; max: number; trim?: boolean; singleLine?: boolean },
): string {
  const raw = body[key];
  if (typeof raw !== 'string') throw badRequest(`\`${key}\` must be a string`, { field: key });
  let v = opts.trim === false ? raw : cleanText(raw);
  if (opts.singleLine) v = v.replace(/\s+/g, ' ');
  const len = [...v].length;
  if (len < (opts.min ?? 1)) throw badRequest(`\`${key}\` is required`, { field: key });
  if (len > opts.max) throw badRequest(`\`${key}\` must be at most ${opts.max} characters`, { field: key });
  return v;
}

export function optString(
  body: Record<string, unknown>,
  key: string,
  opts: { min?: number; max: number; singleLine?: boolean },
): string | undefined {
  if (body[key] === undefined || body[key] === null) return undefined;
  return reqString(body, key, opts);
}

export function reqEnum<T extends string>(body: Record<string, unknown>, key: string, allowed: readonly T[]): T {
  const v = body[key];
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw badRequest(`\`${key}\` must be one of: ${allowed.join(', ')}`, { field: key });
  }
  return v as T;
}

export function optBoolean(body: Record<string, unknown>, key: string): boolean | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw badRequest(`\`${key}\` must be a boolean`, { field: key });
  return v;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') throw badRequest('`email` must be a string', { field: 'email' });
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) throw badRequest('Please enter a valid email address', { field: 'email' });
  return email;
}

// ---------------------------------------------------------------------------
// Images (base64 uploads)
// ---------------------------------------------------------------------------

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export function sniffImage(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  return null;
}

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Decodes a base64 JPEG/PNG upload (a `data:image/...;base64,` prefix is tolerated),
 * enforcing the decoded size limit and verifying the magic bytes.
 */
export function decodeImageUpload(raw: unknown, maxBytes: number, field = 'image'): { bytes: Buffer; contentType: 'image/jpeg' | 'image/png' } {
  if (typeof raw !== 'string' || raw.length === 0) throw badRequest(`\`${field}\` must be a base64-encoded JPEG or PNG`, { field });
  let b64 = raw;
  const comma = b64.startsWith('data:') ? b64.indexOf(',') : -1;
  if (comma !== -1) b64 = b64.slice(comma + 1);
  b64 = b64.replace(/\s+/g, '');
  // Reject before decoding if it can't possibly fit.
  if (Math.floor((b64.length * 3) / 4) > maxBytes + 3) {
    throw new ApiError('BAD_REQUEST', `Image is too large (max ${Math.round(maxBytes / 1024 / 1024 * 10) / 10} MB)`, { status: 413, details: { field } });
  }
  if (b64.length % 4 !== 0 || !BASE64_RE.test(b64)) throw badRequest(`\`${field}\` is not valid base64`, { field });
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length === 0) throw badRequest(`\`${field}\` is empty`, { field });
  if (bytes.length > maxBytes) {
    throw new ApiError('BAD_REQUEST', `Image is too large (max ${Math.round(maxBytes / 1024 / 1024 * 10) / 10} MB)`, { status: 413, details: { field } });
  }
  const type = sniffImage(bytes);
  if (type !== 'image/jpeg' && type !== 'image/png') throw badRequest('Only JPEG or PNG images are supported', { field });
  return { bytes, contentType: type };
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function clientIp(req: Request, fallback?: string): string {
  return (
    fallback ||
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}
