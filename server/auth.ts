/**
 * Authentication: scrypt password hashes, HS256 access tokens (jose), rotating
 * opaque refresh tokens, Sign in with Apple, and email-code password reset.
 *
 * Access token: JWT HS256, 1h, iss `tequila-town`, aud `tt-app`, sub = userId,
 *   `ver` = user.sessionVersion (a password reset bumps it → all tokens die).
 * Refresh token: 32 random bytes (base64url). Only sha256(token) is stored, with
 *   { userId, expiresAt (60 days) }. The user keeps ≤ 10 active hashes (oldest evicted).
 *   Every refresh rotates: the presented token is deleted and a new one issued.
 */
import { createHash, createHmac, randomBytes, randomInt, randomUUID, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import type { Session } from '../shared/api';
import { festival } from '../shared/content/festival';
import { passwordResetEnabled, requireJwtSecret, type Config } from './config';
import type { AppleClaims, AppleVerifier, Ctx, Services } from './context';
import { ApiError, badRequest, bearerToken, isPlainObject, json, normalizeEmail, readJson } from './http';
import { syncLeaderboard } from './leaderboard';
import { RULES } from './ratelimit';
import { NO_CHANGE } from './store';
import type { RefreshRecord, ResetRecord, UserRecord } from './types';
import {
  appleIndexKey,
  claimIndex,
  emailIndexKey,
  getUser,
  toApiUser,
  updateUser,
  userByIndex,
  validateName,
} from './users';
import { escapeHtml, sha256hex } from './util';

export const JWT_ISSUER = 'tequila-town';
export const JWT_AUDIENCE = 'tt-app';
export const ACCESS_TTL_SECONDS = 60 * 60;
export const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;
export const MAX_REFRESH_TOKENS = 10;
const RESET_TTL_MS = 15 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;
const RESET_RESEND_MS = 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Passwords (scrypt; parameters are stored with each hash)
// ---------------------------------------------------------------------------

const scrypt = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );

const KEYLEN = 64;

export async function hashPassword(password: string, N = 2 ** 17): Promise<string> {
  const salt = randomBytes(16);
  const r = 8;
  const p = 1;
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r, p, maxmem: 256 * N * r });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  // Bounds guard against a tampered record turning into a CPU/memory bomb.
  if (!Number.isInteger(N) || N < 2 || N > 2 ** 20 || (N & (N - 1)) !== 0 || r < 1 || r > 32 || p < 1 || p > 4) return false;
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  const key = await scrypt(password.normalize('NFKC'), salt, expected.length, { N, r, p, maxmem: 256 * N * r });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Lazily computed hash used to spend equal time when an email doesn't exist. */
const dummyHashes = new Map<number, Promise<string>>();
function dummyHash(N: number): Promise<string> {
  let h = dummyHashes.get(N);
  if (!h) {
    h = hashPassword(randomUUID(), N);
    dummyHashes.set(N, h);
  }
  return h;
}

export function validatePassword(raw: unknown): string {
  if (typeof raw !== 'string') throw badRequest('`password` must be a string', { field: 'password' });
  if ([...raw].length < 8) throw badRequest('Password must be at least 8 characters', { field: 'password' });
  if (raw.length > 256) throw badRequest('Password must be at most 256 characters', { field: 'password' });
  return raw;
}

// ---------------------------------------------------------------------------
// Age gate (the birth date is validated, never stored)
// ---------------------------------------------------------------------------

/**
 * Throws BAD_REQUEST for a malformed date and 403 UNDERAGE under the festival
 * minimum age. "Today" is evaluated in UTC−12 (the last time zone to reach a
 * date), so nobody anywhere is admitted before their 21st birthday.
 */
export function assertOfAge(raw: unknown, now: Date, minimumAge: number = festival.ageMinimum): void {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw badRequest('`birthDate` must be a date in YYYY-MM-DD format', { field: 'birthDate' });
  }
  const [y, m, d] = raw.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || y < 1900) {
    throw badRequest('`birthDate` is not a valid date', { field: 'birthDate' });
  }
  const today = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const ty = today.getUTCFullYear();
  const tm = today.getUTCMonth() + 1;
  const td = today.getUTCDate();
  if (dt.getTime() > Date.UTC(ty, tm - 1, td)) throw badRequest('`birthDate` cannot be in the future', { field: 'birthDate' });
  const age = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
  if (age < minimumAge) {
    throw new ApiError('UNDERAGE', `You must be ${minimumAge} or older to use Tequila Town`);
  }
}

// ---------------------------------------------------------------------------
// Access tokens
// ---------------------------------------------------------------------------

const keyCache = new Map<string, Uint8Array>();
const hmacKey = (secret: string) => {
  let k = keyCache.get(secret);
  if (!k) {
    k = new TextEncoder().encode(secret);
    keyCache.set(secret, k);
  }
  return k;
};

export async function signAccessToken(cfg: Config, user: Pick<UserRecord, 'id' | 'sessionVersion'>, now: Date) {
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + ACCESS_TTL_SECONDS;
  const token = await new SignJWT({ ver: user.sessionVersion })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(hmacKey(requireJwtSecret(cfg)));
  return { token, expiresAt: exp * 1000 };
}

export async function verifyAccessToken(cfg: Config, token: string, now: Date): Promise<{ sub: string; ver: number }> {
  const secret = requireJwtSecret(cfg);
  try {
    const { payload } = await jwtVerify(token, hmacKey(secret), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'],
      currentDate: now,
    });
    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('missing sub');
    return { sub: payload.sub, ver: typeof payload.ver === 'number' ? payload.ver : 0 };
  } catch (e) {
    if (e instanceof joseErrors.JWTExpired) throw new ApiError('TOKEN_EXPIRED', 'Access token expired. Refresh your session');
    throw new ApiError('UNAUTHORIZED', 'Invalid access token');
  }
}

/** Resolves the signed-in user for a request (401 on any failure). */
export async function authenticate(svc: Services, req: Request): Promise<UserRecord> {
  const token = bearerToken(req);
  if (!token) throw new ApiError('UNAUTHORIZED', 'Sign in required');
  const claims = await verifyAccessToken(svc.config, token, svc.now());
  const user = await getUser(svc, claims.sub);
  if (!user) throw new ApiError('UNAUTHORIZED', 'Account not found');
  if ((user.sessionVersion ?? 0) !== claims.ver) throw new ApiError('UNAUTHORIZED', 'Session was signed out. Please sign in again');
  return user;
}

// ---------------------------------------------------------------------------
// Sessions & refresh tokens
// ---------------------------------------------------------------------------

const refreshKey = (hash: string) => `refresh/${hash}`;

/**
 * Issues a new access + refresh token pair. `replacing` (a rotated token hash) is
 * removed from the user's active list in the same CAS write.
 */
export async function issueSession(svc: Services, origin: string, userId: string, replacing?: string): Promise<Session> {
  const now = svc.now();
  const refreshToken = randomBytes(32).toString('base64url');
  const hash = sha256hex(refreshToken);
  const tokens = svc.store.ns('tokens');
  const rec: RefreshRecord = { userId, expiresAt: now.getTime() + REFRESH_TTL_MS, createdAt: now.getTime() };
  await tokens.setJSON(refreshKey(hash), rec);

  const { user, result: evicted } = await updateUser(svc, userId, (u) => {
    const list = (u.refreshHashes ?? []).filter((h) => h !== replacing);
    list.push(hash);
    const out = list.length > MAX_REFRESH_TOKENS ? list.splice(0, list.length - MAX_REFRESH_TOKENS) : [];
    u.refreshHashes = list;
    return out;
  });
  await Promise.all((evicted ?? []).map((h) => tokens.delete(refreshKey(h))));

  const access = await signAccessToken(svc.config, user, now);
  return { accessToken: access.token, refreshToken, expiresAt: access.expiresAt, user: toApiUser(user, origin) };
}

/** Deletes every refresh token of a user (password reset, account deletion). */
export async function revokeAllRefreshTokens(svc: Services, userId: string): Promise<void> {
  const res = await updateUser(svc, userId, (u) => {
    const all = u.refreshHashes ?? [];
    if (all.length === 0) return NO_CHANGE;
    u.refreshHashes = [];
    return all;
  }).catch((e) => {
    if (e instanceof ApiError && e.code === 'NOT_FOUND') return { result: [] as string[] };
    throw e;
  });
  const tokens = svc.store.ns('tokens');
  await Promise.all((res.result ?? []).map((h) => tokens.delete(refreshKey(h))));
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

let appleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/** Default verifier: Apple's JWKS (cached by jose), issuer + audience + expiry checks. */
export const verifyAppleIdentityToken: AppleVerifier = async (identityToken, audiences): Promise<AppleClaims> => {
  appleJwks ??= createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'), {
    timeoutDuration: 5000,
    cooldownDuration: 30_000,
    cacheMaxAge: 6 * 60 * 60 * 1000,
  });
  const { payload } = await jwtVerify(identityToken, appleJwks, {
    issuer: 'https://appleid.apple.com',
    audience: audiences,
    algorithms: ['RS256', 'ES256'],
  });
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Apple token has no subject');
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  const ev = (payload as Record<string, unknown>).email_verified;
  return { sub: payload.sub, email, emailVerified: ev === true || ev === 'true' };
};

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function newUserRecord(now: Date, fields: Partial<UserRecord> & Pick<UserRecord, 'id' | 'name' | 'providers'>): UserRecord {
  return {
    email: null,
    phone: null,
    avatar: null,
    appleSub: null,
    passwordHash: null,
    showOnLeaderboard: true,
    createdAt: now.toISOString(),
    ageVerifiedAt: now.toISOString(),
    sessionVersion: 0,
    refreshHashes: [],
    ...fields,
  };
}

type PublicCtx = Omit<Ctx, 'user'>;

export async function signup(ctx: PublicCtx): Promise<Response> {
  const { svc } = ctx;
  svc.limiter.check(`auth:${ctx.ip}`, RULES.authIp);
  requireJwtSecret(svc.config);
  const body = await readJson(ctx.req);
  const email = normalizeEmail(body.email);
  const password = validatePassword(body.password);
  const name = validateName(body.name);
  const now = svc.now();
  assertOfAge(body.birthDate, now);

  const id = randomUUID();
  const passwordHash = await hashPassword(password, svc.config.scryptN);
  if (!(await claimIndex(svc, emailIndexKey(email), id))) {
    throw new ApiError('EMAIL_TAKEN', 'An account with this email already exists. Try signing in');
  }
  const user = newUserRecord(now, { id, email, name, providers: ['password'], passwordHash });
  await svc.store.ns('users').setJSON(id, user, { onlyIfNew: true });
  svc.log.info('auth.signup', { userId: id, requestId: ctx.requestId });
  ctx.defer(() => syncLeaderboard(svc, id), 'leaderboard.sync');
  return json(await issueSession(svc, ctx.origin, id), 201);
}

type LoginFailures = { count: number; windowStart: number };

export async function login(ctx: PublicCtx): Promise<Response> {
  const { svc } = ctx;
  svc.limiter.check(`auth:${ctx.ip}`, RULES.authIp);
  requireJwtSecret(svc.config);
  const body = await readJson(ctx.req);
  const email = normalizeEmail(body.email);
  if (typeof body.password !== 'string' || !body.password) throw badRequest('`password` is required', { field: 'password' });
  const password = body.password.slice(0, 256);

  const failKey = `loginfail/${sha256hex(email)}`;
  const tokens = svc.store.ns('tokens');
  const now = svc.now().getTime();
  const fails = await tokens.getJSON<LoginFailures>(failKey);
  if (fails && now - fails.value.windowStart < LOGIN_WINDOW_MS && fails.value.count >= LOGIN_MAX_FAILURES) {
    const retry = Math.ceil((fails.value.windowStart + LOGIN_WINDOW_MS - now) / 1000);
    throw new ApiError('RATE_LIMITED', 'Too many sign-in attempts. Please wait a few minutes or reset your password', {
      headers: { 'retry-after': String(retry) },
      details: { retryAfterSeconds: retry },
    });
  }

  const user = await userByIndex(svc, emailIndexKey(email));
  // Always run scrypt so response time doesn't reveal whether the email exists.
  let ok = false;
  if (user?.passwordHash) ok = await verifyPassword(password, user.passwordHash);
  else await verifyPassword(password, await dummyHash(svc.config.scryptN));

  if (!user || !ok) {
    const fresh = !fails || now - fails.value.windowStart >= LOGIN_WINDOW_MS;
    const next: LoginFailures = fresh ? { count: 1, windowStart: now } : { count: fails.value.count + 1, windowStart: fails.value.windowStart };
    await (fails ? tokens.setJSON(failKey, next, { onlyIfMatch: fails.etag }) : tokens.setJSON(failKey, next, { onlyIfNew: true }));
    throw new ApiError('INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (fails) await tokens.delete(failKey);
  return json(await issueSession(svc, ctx.origin, user.id));
}

export async function appleSignIn(ctx: PublicCtx): Promise<Response> {
  const { svc } = ctx;
  svc.limiter.check(`auth:${ctx.ip}`, RULES.authIp);
  requireJwtSecret(svc.config);
  if (!svc.config.appleSignIn) throw new ApiError('NOT_CONFIGURED', 'Sign in with Apple is not enabled');
  const body = await readJson(ctx.req, 32 * 1024);
  if (typeof body.identityToken !== 'string' || !body.identityToken) {
    throw badRequest('`identityToken` is required', { field: 'identityToken' });
  }
  let claims: AppleClaims;
  try {
    claims = await svc.verifyAppleToken(body.identityToken, svc.config.appleBundleIds);
  } catch (e) {
    svc.log.warn('auth.apple.invalid_token', { reason: e instanceof Error ? e.message : String(e), requestId: ctx.requestId });
    throw new ApiError('UNAUTHORIZED', 'Apple sign-in could not be verified. Please try again');
  }
  const now = svc.now();
  const appleKey = appleIndexKey(claims.sub);

  // 1. Returning Apple user.
  const existing = await userByIndex(svc, appleKey);
  if (existing) return json(await issueSession(svc, ctx.origin, existing.id));

  // 2. Link to an existing account with the same verified email.
  if (claims.email && claims.emailVerified) {
    const byEmail = await userByIndex(svc, emailIndexKey(claims.email));
    if (byEmail) {
      await claimIndex(svc, appleKey, byEmail.id);
      await updateUser(svc, byEmail.id, (u) => {
        u.appleSub = claims.sub;
        if (!u.providers.includes('apple')) u.providers.push('apple');
      });
      svc.log.info('auth.apple.linked', { userId: byEmail.id, requestId: ctx.requestId });
      return json(await issueSession(svc, ctx.origin, byEmail.id));
    }
  }

  // 3. New account — the 21+ check is required.
  assertOfAge(body.birthDate, now);
  const fullName = isPlainObject(body.fullName) ? body.fullName : null;
  const given = typeof fullName?.givenName === 'string' ? fullName.givenName : '';
  const family = typeof fullName?.familyName === 'string' ? fullName.familyName : '';
  const rawName = `${given} ${family}`.trim();
  const name = rawName ? validateName([...rawName].slice(0, 60).join('')) : 'Festival Guest';

  const id = randomUUID();
  if (!(await claimIndex(svc, appleKey, id))) {
    // Lost a race with a concurrent first sign-in for the same Apple ID.
    const winner = await userByIndex(svc, appleKey);
    if (winner) return json(await issueSession(svc, ctx.origin, winner.id));
    throw new ApiError('CONFLICT', 'Please try again');
  }
  let email: string | null = null;
  if (claims.email && claims.emailVerified && (await claimIndex(svc, emailIndexKey(claims.email), id))) email = claims.email;
  const user = newUserRecord(now, { id, email, name, providers: ['apple'], appleSub: claims.sub });
  await svc.store.ns('users').setJSON(id, user, { onlyIfNew: true });
  svc.log.info('auth.apple.signup', { userId: id, requestId: ctx.requestId });
  ctx.defer(() => syncLeaderboard(svc, id), 'leaderboard.sync');
  return json(await issueSession(svc, ctx.origin, id), 201);
}

export async function refresh(ctx: PublicCtx): Promise<Response> {
  const { svc } = ctx;
  svc.limiter.check(`auth:${ctx.ip}`, RULES.authIp);
  requireJwtSecret(svc.config);
  const body = await readJson(ctx.req);
  if (typeof body.refreshToken !== 'string' || !body.refreshToken || body.refreshToken.length > 200) {
    throw badRequest('`refreshToken` is required', { field: 'refreshToken' });
  }
  const hash = sha256hex(body.refreshToken);
  const tokens = svc.store.ns('tokens');
  const cur = await tokens.getJSON<RefreshRecord & { rotatedAt?: number }>(refreshKey(hash));
  const expired = new ApiError('UNAUTHORIZED', 'Your session has expired. Please sign in again');
  if (!cur || cur.value.rotatedAt || cur.value.expiresAt <= svc.now().getTime()) {
    if (cur) await tokens.delete(refreshKey(hash));
    throw expired;
  }
  // Atomically claim the token so two concurrent refreshes can't both succeed.
  const claimed = await tokens.setJSON(refreshKey(hash), { ...cur.value, rotatedAt: svc.now().getTime() }, { onlyIfMatch: cur.etag });
  if (!claimed.modified) throw expired;
  await tokens.delete(refreshKey(hash));
  const user = await getUser(svc, cur.value.userId);
  if (!user) throw expired;
  return json(await issueSession(svc, ctx.origin, user.id, hash));
}

export async function logout(ctx: PublicCtx): Promise<Response> {
  const { svc } = ctx;
  const body = await readJson(ctx.req).catch(() => ({}) as Record<string, unknown>);
  if (typeof body.refreshToken === 'string' && body.refreshToken && body.refreshToken.length <= 200) {
    const hash = sha256hex(body.refreshToken);
    const tokens = svc.store.ns('tokens');
    const rec = await tokens.getJSON<RefreshRecord>(refreshKey(hash));
    if (rec) {
      await tokens.delete(refreshKey(hash));
      await updateUser(svc, rec.value.userId, (u) => {
        if (!u.refreshHashes.includes(hash)) return NO_CHANGE;
        u.refreshHashes = u.refreshHashes.filter((h) => h !== hash);
      }).catch((e) => {
        if (!(e instanceof ApiError && e.code === 'NOT_FOUND')) throw e;
      });
    }
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Password reset (Resend)
// ---------------------------------------------------------------------------

const resetKey = (email: string) => `reset/${sha256hex(email)}`;
const codeHash = (secret: string, userId: string, code: string) =>
  createHmac('sha256', secret).update(`reset:${userId}:${code}`).digest('hex');

function requireResetConfigured(cfg: Config) {
  if (!passwordResetEnabled(cfg)) throw new ApiError('NOT_CONFIGURED', 'Password reset by email is not available. Please contact support');
}

export async function forgotPassword(ctx: PublicCtx): Promise<Response> {
  const { svc } = ctx;
  requireResetConfigured(svc.config);
  const secret = requireJwtSecret(svc.config);
  svc.limiter.check(`forgot:${ctx.ip}`, RULES.forgot);
  const body = await readJson(ctx.req);
  const email = normalizeEmail(body.email);
  const user = await userByIndex(svc, emailIndexKey(email));
  if (user) {
    const tokens = svc.store.ns('tokens');
    const now = svc.now().getTime();
    const prev = await tokens.getJSON<ResetRecord>(resetKey(email));
    if (!prev || now - prev.value.sentAt >= RESET_RESEND_MS) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const rec: ResetRecord = { userId: user.id, codeHash: codeHash(secret, user.id, code), expiresAt: now + RESET_TTL_MS, attempts: 0, sentAt: now };
      await tokens.setJSON(resetKey(email), rec);
      // Sent after the response so timing doesn't reveal whether the account exists.
      ctx.defer(() => sendResetEmail(svc, email, user.name, code), 'auth.reset_email');
    }
  }
  return json({ ok: true });
}

export async function resetPassword(ctx: PublicCtx): Promise<Response> {
  const { svc } = ctx;
  requireResetConfigured(svc.config);
  const secret = requireJwtSecret(svc.config);
  svc.limiter.check(`auth:${ctx.ip}`, RULES.authIp);
  const body = await readJson(ctx.req);
  const email = normalizeEmail(body.email);
  const code = typeof body.code === 'string' ? body.code.replace(/\s+/g, '') : '';
  if (!/^\d{6}$/.test(code)) throw badRequest('`code` must be the 6-digit code from your email', { field: 'code' });
  const password = validatePassword(body.password);

  const tokens = svc.store.ns('tokens');
  const key = resetKey(email);
  const now = svc.now().getTime();
  const invalid = (details?: Record<string, unknown>) => new ApiError('INVALID_CODE', 'That code is invalid or has expired', { details });
  const cur = await tokens.getJSON<ResetRecord>(key);
  if (!cur || cur.value.expiresAt <= now || cur.value.attempts >= RESET_MAX_ATTEMPTS) {
    if (cur) await tokens.delete(key);
    throw invalid();
  }
  const expected = Buffer.from(cur.value.codeHash, 'hex');
  const actual = Buffer.from(codeHash(secret, cur.value.userId, code), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    const attempts = cur.value.attempts + 1;
    if (attempts >= RESET_MAX_ATTEMPTS) await tokens.delete(key);
    else await tokens.setJSON(key, { ...cur.value, attempts }, { onlyIfMatch: cur.etag });
    throw invalid({ attemptsRemaining: Math.max(0, RESET_MAX_ATTEMPTS - attempts) });
  }
  // Single use: of two concurrent correct submissions, only the conditional write's winner proceeds.
  const consumed = await tokens.setJSON(key, { ...cur.value, attempts: RESET_MAX_ATTEMPTS }, { onlyIfMatch: cur.etag });
  if (!consumed.modified) throw invalid();
  await tokens.delete(key);

  const passwordHash = await hashPassword(password, svc.config.scryptN);
  const userId = cur.value.userId;
  // New password + bumped session version (kills outstanding access tokens) +
  // dropped refresh tokens, in one CAS write.
  const { result: oldHashes } = await updateUser(svc, userId, (u) => {
    const old = u.refreshHashes ?? [];
    u.refreshHashes = [];
    u.passwordHash = passwordHash;
    if (!u.providers.includes('password')) u.providers.push('password');
    u.sessionVersion = (u.sessionVersion ?? 0) + 1;
    return old;
  }).catch((e) => {
    if (e instanceof ApiError && e.code === 'NOT_FOUND') throw invalid();
    throw e;
  });
  await Promise.all((oldHashes ?? []).map((h) => tokens.delete(refreshKey(h))));
  await tokens.delete(`loginfail/${sha256hex(email)}`);
  svc.log.info('auth.password_reset', { userId, requestId: ctx.requestId });
  return json(await issueSession(svc, ctx.origin, userId));
}

async function sendResetEmail(svc: Services, to: string, name: string, code: string): Promise<void> {
  const cfg = svc.config;
  if (!cfg.resendKey || !cfg.resetEmailFrom) return;
  const first = escapeHtml(name.split(/\s+/)[0] || 'there');
  const html = `<!doctype html><html><body style="margin:0;background:#F3E9D2;font-family:Georgia,serif;color:#2B1A10">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#FFF8EA;border:2px solid #2B1A10;box-shadow:6px 6px 0 #2B1A10">
<tr><td style="background:#AD3A00;color:#FCC8BA;padding:20px 24px;font:700 22px/1.2 Georgia,serif;letter-spacing:2px">TEQUILA TOWN</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px;font-size:17px">Hola ${first},</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5">Use this code to reset your Tequila Town password. It expires in 15 minutes.</p>
<p style="margin:0 0 20px;font:700 34px/1 'Courier New',monospace;letter-spacing:8px;color:#AD3A00">${code}</p>
<p style="margin:0;font-size:14px;line-height:1.5;color:#5a4636">If you didn't ask for this, you can ignore this email. Your password won't change.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `Hola ${name.split(/\s+/)[0] || 'there'},\n\nYour Tequila Town password reset code is ${code}. It expires in 15 minutes.\n\nIf you didn't ask for this, ignore this email.`;
  try {
    const res = await svc.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: cfg.resetEmailFrom, to: [to], subject: 'Your Tequila Town password reset code', html, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) svc.log.error('auth.reset_email.failed', { status: res.status, body: (await res.text()).slice(0, 300) });
  } catch (e) {
    svc.log.error('auth.reset_email.error', { error: e instanceof Error ? e.message : String(e) });
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** Checks the x-admin-key header in constant time (both sides hashed to equal length). */
export function assertAdmin(req: Request, adminKey: string | null): void {
  if (!adminKey) throw new ApiError('NOT_CONFIGURED', 'Admin API is not configured');
  const given = req.headers.get('x-admin-key') ?? '';
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(adminKey).digest();
  if (!given || !timingSafeEqual(a, b)) throw new ApiError('FORBIDDEN', 'Forbidden');
}
