import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import type { Session } from '../shared/api';
import { assertOfAge, hashPassword, MAX_REFRESH_TOKENS, verifyPassword } from './auth';
import type { AppleVerifier } from './context';
import type { UserRecord } from './types';
import { call, makeHarness, signup, testConfig } from './test-utils';

describe('password hashing', () => {
  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('correct horse battery', 1024);
    const b = await hashPassword('correct horse battery', 1024);
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$1024$8$1$')).toBe(true);
    expect(await verifyPassword('correct horse battery', a)).toBe(true);
    expect(await verifyPassword('correct horse batterz', a)).toBe(false);
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
  });

  it('refuses absurd cost parameters from a tampered record', async () => {
    const h = await hashPassword('pw-12345678', 1024);
    const evil = h.replace('scrypt$1024$', `scrypt$${2 ** 24}$`);
    expect(await verifyPassword('pw-12345678', evil)).toBe(false);
  });
});

describe('age gate', () => {
  const now = new Date('2026-10-12T15:00:00Z');
  it('accepts 21+', () => {
    expect(() => assertOfAge('1990-01-01', now)).not.toThrow();
    expect(() => assertOfAge('2005-10-11', now)).not.toThrow();
  });
  it('rejects under 21 with UNDERAGE', () => {
    expect(() => assertOfAge('2006-01-01', now)).toThrow(expect.objectContaining({ code: 'UNDERAGE', status: 403 }));
    // Turns 21 tomorrow.
    expect(() => assertOfAge('2005-10-13', now)).toThrow(expect.objectContaining({ code: 'UNDERAGE' }));
  });
  it('uses the last time zone on Earth for "today" (no early admission)', () => {
    // 2026-10-12 05:00 UTC is still 2026-10-11 in UTC-12.
    expect(() => assertOfAge('2005-10-12', new Date('2026-10-12T05:00:00Z'))).toThrow(expect.objectContaining({ code: 'UNDERAGE' }));
    expect(() => assertOfAge('2005-10-12', new Date('2026-10-12T13:00:00Z'))).not.toThrow();
  });
  it.each(['', '1990-1-1', '1990-02-30', '1899-12-31', '2099-01-01', 'yesterday', 19900101])('rejects malformed %s', (v) => {
    expect(() => assertOfAge(v, now)).toThrow(expect.objectContaining({ code: 'BAD_REQUEST' }));
  });
});

describe('signup & login', () => {
  it('creates an account without storing the birth date', async () => {
    const h = makeHarness();
    const s = await signup(h, { email: 'Maria@Example.com', name: '  Maria   Lopez ' });
    expect(s.user.email).toBe('maria@example.com');
    expect(s.user.name).toBe('Maria Lopez');
    expect(s.user.providers).toEqual(['password']);
    expect(s.expiresAt).toBe(h.clock.t + 3600_000);
    const rec = (await h.store.ns('users').getJSON<UserRecord>(s.user.id))!.value;
    expect(JSON.stringify(rec)).not.toContain('1990-05-17');
    expect(rec.ageVerifiedAt).toBeTruthy();
    expect(rec.passwordHash).not.toContain('agave-fields-42');
  });

  it('validates input', async () => {
    const h = makeHarness();
    const base = { email: 'a@b.co', password: 'longenough', name: 'Ana', birthDate: '1990-01-01' };
    expect((await call(h, 'POST', '/api/auth/signup', { body: { ...base, email: 'nope' } })).body.code).toBe('BAD_REQUEST');
    expect((await call(h, 'POST', '/api/auth/signup', { body: { ...base, password: 'short' } })).body.code).toBe('BAD_REQUEST');
    expect((await call(h, 'POST', '/api/auth/signup', { body: { ...base, name: '' } })).body.code).toBe('BAD_REQUEST');
    expect((await call(h, 'POST', '/api/auth/signup', { body: { ...base, name: 'x'.repeat(61) } })).body.code).toBe('BAD_REQUEST');
    const under = await call(h, 'POST', '/api/auth/signup', { body: { ...base, birthDate: '2010-01-01' } });
    expect(under.status).toBe(403);
    expect(under.body.code).toBe('UNDERAGE');
    expect((await call(h, 'POST', '/api/auth/signup', { body: 'not-json' as unknown })).status).toBe(400);
  });

  it('enforces email uniqueness (409 EMAIL_TAKEN), case-insensitively', async () => {
    const h = makeHarness();
    await signup(h, { email: 'dup@example.com' });
    const res = await call(h, 'POST', '/api/auth/signup', {
      body: { email: 'DUP@example.com', password: 'another-password', name: 'Other', birthDate: '1980-01-01' },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('logs in, and gives one generic error for a wrong password or unknown email', async () => {
    const h = makeHarness();
    await signup(h, { email: 'login@example.com', password: 'right-password' });
    const ok = await call<Session>(h, 'POST', '/api/auth/login', { body: { email: 'LOGIN@example.com', password: 'right-password' } });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();
    const wrong = await call(h, 'POST', '/api/auth/login', { body: { email: 'login@example.com', password: 'wrong-password' } });
    const unknown = await call(h, 'POST', '/api/auth/login', { body: { email: 'ghost@example.com', password: 'wrong-password' } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('locks an email after 10 failed attempts within 15 minutes', async () => {
    const h = makeHarness();
    await signup(h, { email: 'lock@example.com', password: 'right-password' });
    for (let i = 0; i < 10; i++) {
      expect((await call(h, 'POST', '/api/auth/login', { body: { email: 'lock@example.com', password: `bad-${i}-xxxx` } })).status).toBe(401);
    }
    const locked = await call(h, 'POST', '/api/auth/login', { body: { email: 'lock@example.com', password: 'right-password' } });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('RATE_LIMITED');
    expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(0);
    h.clock.advance(15 * 60_000 + 1);
    expect((await call(h, 'POST', '/api/auth/login', { body: { email: 'lock@example.com', password: 'right-password' } })).status).toBe(200);
  });
});

describe('access tokens', () => {
  it('rejects missing/garbage tokens with UNAUTHORIZED', async () => {
    const h = makeHarness();
    expect((await call(h, 'GET', '/api/me')).body.code).toBe('UNAUTHORIZED');
    expect((await call(h, 'GET', '/api/me', { token: 'abc.def.ghi' })).body.code).toBe('UNAUTHORIZED');
  });

  it('returns TOKEN_EXPIRED after one hour so the app knows to refresh', async () => {
    const h = makeHarness();
    const s = await signup(h);
    expect((await call(h, 'GET', '/api/me', { token: s.accessToken })).status).toBe(200);
    h.clock.advance(60 * 60_000 + 1000);
    const res = await call(h, 'GET', '/api/me', { token: s.accessToken });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects tokens signed with another secret or for another audience', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const forged = await new SignJWT({ ver: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(s.user.id)
      .setIssuer('tequila-town')
      .setAudience('tt-app')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('some-other-secret-that-is-long-enough'));
    expect((await call(h, 'GET', '/api/me', { token: forged })).body.code).toBe('UNAUTHORIZED');
    const wrongAud = await new SignJWT({ ver: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(s.user.id)
      .setIssuer('tequila-town')
      .setAudience('someone-else')
      .setIssuedAt(Math.floor(h.clock.t / 1000))
      .setExpirationTime(Math.floor(h.clock.t / 1000) + 3600)
      .sign(new TextEncoder().encode(testConfig().jwtSecret!));
    expect((await call(h, 'GET', '/api/me', { token: wrongAud })).body.code).toBe('UNAUTHORIZED');
  });

  it('answers 500 NOT_CONFIGURED when deployed without JWT_SECRET', async () => {
    const h = makeHarness({ config: { deployed: true, jwtSecret: null } });
    const res = await call(h, 'POST', '/api/auth/signup', {
      body: { email: 'a@b.co', password: 'longenough', name: 'Ana', birthDate: '1990-01-01' },
    });
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('NOT_CONFIGURED');
  });
});

describe('refresh tokens', () => {
  it('rotates: the old token dies, the new one works', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const r1 = await call<Session>(h, 'POST', '/api/auth/refresh', { body: { refreshToken: s.refreshToken } });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(s.refreshToken);
    expect((await call(h, 'GET', '/api/me', { token: r1.body.accessToken })).status).toBe(200);
    const replay = await call(h, 'POST', '/api/auth/refresh', { body: { refreshToken: s.refreshToken } });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('UNAUTHORIZED');
    expect((await call(h, 'POST', '/api/auth/refresh', { body: { refreshToken: r1.body.refreshToken } })).status).toBe(200);
  });

  it('stores only token hashes', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const dump = JSON.stringify([...h.store.data.get('tokens')!.entries()]) + JSON.stringify([...h.store.data.get('users')!.entries()]);
    expect(dump).not.toContain(s.refreshToken);
  });

  it('two concurrent refreshes with the same token: exactly one wins', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const [a, b] = await Promise.all([
      call(h, 'POST', '/api/auth/refresh', { body: { refreshToken: s.refreshToken } }),
      call(h, 'POST', '/api/auth/refresh', { body: { refreshToken: s.refreshToken } }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
  });

  it('expires after 60 days', async () => {
    const h = makeHarness();
    const s = await signup(h);
    h.clock.advance(61 * 24 * 3600_000);
    expect((await call(h, 'POST', '/api/auth/refresh', { body: { refreshToken: s.refreshToken } })).status).toBe(401);
  });

  it('keeps at most 10 active sessions per user (oldest evicted)', async () => {
    const h = makeHarness();
    const first = await signup(h, { email: 'many@example.com', password: 'many-sessions-1' });
    const sessions: Session[] = [first];
    for (let i = 0; i < MAX_REFRESH_TOKENS; i++) {
      sessions.push((await call<Session>(h, 'POST', '/api/auth/login', { body: { email: 'many@example.com', password: 'many-sessions-1' } })).body);
    }
    const user = (await h.store.ns('users').getJSON<UserRecord>(first.user.id))!.value;
    expect(user.refreshHashes).toHaveLength(MAX_REFRESH_TOKENS);
    expect((await call(h, 'POST', '/api/auth/refresh', { body: { refreshToken: sessions[0].refreshToken } })).status).toBe(401);
    expect((await call(h, 'POST', '/api/auth/refresh', { body: { refreshToken: sessions[10].refreshToken } })).status).toBe(200);
  });

  it('logout revokes the refresh token', async () => {
    const h = makeHarness();
    const s = await signup(h);
    expect((await call(h, 'POST', '/api/auth/logout', { body: { refreshToken: s.refreshToken } })).body).toEqual({ ok: true });
    expect((await call(h, 'POST', '/api/auth/refresh', { body: { refreshToken: s.refreshToken } })).status).toBe(401);
    const user = (await h.store.ns('users').getJSON<UserRecord>(s.user.id))!.value;
    expect(user.refreshHashes).toHaveLength(0);
    // Unknown tokens are fine (idempotent).
    expect((await call(h, 'POST', '/api/auth/logout', { body: { refreshToken: 'nope' } })).status).toBe(200);
  });
});

describe('Sign in with Apple', () => {
  const verifier = (claims: Record<string, { sub: string; email: string | null; emailVerified: boolean }>): AppleVerifier =>
    async (token, audiences) => {
      expect(audiences).toEqual(['com.tequilatown.app']);
      const c = claims[token];
      if (!c) throw new Error('bad token');
      return c;
    };

  it('creates an account (21+ required), then signs the same Apple ID back in', async () => {
    const h = makeHarness({ verifyAppleToken: verifier({ t1: { sub: '001.abc.002', email: 'relay@privaterelay.appleid.com', emailVerified: true } }) });
    const noDob = await call(h, 'POST', '/api/auth/apple', { body: { identityToken: 't1' } });
    expect(noDob.body.code).toBe('BAD_REQUEST');
    const minor = await call(h, 'POST', '/api/auth/apple', { body: { identityToken: 't1', birthDate: '2012-02-02' } });
    expect(minor.body.code).toBe('UNDERAGE');
    const created = await call<Session>(h, 'POST', '/api/auth/apple', {
      body: { identityToken: 't1', birthDate: '1988-08-08', fullName: { givenName: 'Lázaro', familyName: 'Gallardo' } },
    });
    expect(created.status).toBe(201);
    expect(created.body.user.name).toBe('Lázaro Gallardo');
    expect(created.body.user.providers).toEqual(['apple']);
    expect(created.body.user.email).toBe('relay@privaterelay.appleid.com');
    const again = await call<Session>(h, 'POST', '/api/auth/apple', { body: { identityToken: 't1' } });
    expect(again.status).toBe(200);
    expect(again.body.user.id).toBe(created.body.user.id);
  });

  it('defaults the name and links to an existing account by verified email', async () => {
    const h = makeHarness({
      verifyAppleToken: verifier({
        anon: { sub: 'sub-anon', email: null, emailVerified: false },
        link: { sub: 'sub-link', email: 'linked@example.com', emailVerified: true },
      }),
    });
    const anon = await call<Session>(h, 'POST', '/api/auth/apple', { body: { identityToken: 'anon', birthDate: '1990-01-01' } });
    expect(anon.body.user.name).toBe('Festival Guest');
    const pw = await signup(h, { email: 'linked@example.com' });
    const linked = await call<Session>(h, 'POST', '/api/auth/apple', { body: { identityToken: 'link' } });
    expect(linked.status).toBe(200);
    expect(linked.body.user.id).toBe(pw.user.id);
    expect(linked.body.user.providers.sort()).toEqual(['apple', 'password']);
  });

  it('rejects an invalid identity token', async () => {
    const h = makeHarness({ verifyAppleToken: verifier({}) });
    const res = await call(h, 'POST', '/api/auth/apple', { body: { identityToken: 'forged', birthDate: '1990-01-01' } });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});

describe('password reset', () => {
  it('is 501 NOT_CONFIGURED without Resend', async () => {
    const h = makeHarness();
    const res = await call(h, 'POST', '/api/auth/password/forgot', { body: { email: 'a@b.co' } });
    expect(res.status).toBe(501);
    expect(res.body.code).toBe('NOT_CONFIGURED');
  });

  it('emails a 6-digit code, resets the password and revokes old sessions', async () => {
    const h = makeHarness({ config: { resendKey: 're_test', resetEmailFrom: 'Tequila Town <no-reply@tequilatown.com>' } });
    h.fetchMock.handler = () => Response.json({ id: 'email_1' });
    const s = await signup(h, { email: 'reset@example.com', password: 'old-password-1' });

    // Unknown emails get the same answer and send nothing.
    expect((await call(h, 'POST', '/api/auth/password/forgot', { body: { email: 'nobody@example.com' } })).body).toEqual({ ok: true });
    expect(h.fetchMock.calls).toHaveLength(0);

    expect((await call(h, 'POST', '/api/auth/password/forgot', { body: { email: 'reset@example.com' } })).body).toEqual({ ok: true });
    expect(h.fetchMock.calls).toHaveLength(1);
    const sent = h.fetchMock.calls[0];
    expect(sent.url).toBe('https://api.resend.com/emails');
    expect((sent.init?.headers as Record<string, string>).authorization).toBe('Bearer re_test');
    const mail = sent.body as { to: string[]; text: string; html: string; from: string };
    expect(mail.to).toEqual(['reset@example.com']);
    const code = /\b(\d{6})\b/.exec(mail.text)![1];
    expect(JSON.stringify([...h.store.data.get('tokens')!.values()])).not.toContain(code);

    const wrong = await call(h, 'POST', '/api/auth/password/reset', {
      body: { email: 'reset@example.com', code: code === '000000' ? '111111' : '000000', password: 'new-password-2' },
    });
    expect(wrong.body.code).toBe('INVALID_CODE');
    expect(wrong.body.details.attemptsRemaining).toBe(4);

    const ok = await call<Session>(h, 'POST', '/api/auth/password/reset', { body: { email: 'reset@example.com', code, password: 'new-password-2' } });
    expect(ok.status).toBe(200);
    // Old access + refresh tokens are dead; the code is single-use.
    expect((await call(h, 'GET', '/api/me', { token: s.accessToken })).status).toBe(401);
    expect((await call(h, 'POST', '/api/auth/refresh', { body: { refreshToken: s.refreshToken } })).status).toBe(401);
    expect((await call(h, 'GET', '/api/me', { token: ok.body.accessToken })).status).toBe(200);
    expect((await call(h, 'POST', '/api/auth/password/reset', { body: { email: 'reset@example.com', code, password: 'x-password-3' } })).body.code).toBe(
      'INVALID_CODE',
    );
    expect((await call(h, 'POST', '/api/auth/login', { body: { email: 'reset@example.com', password: 'new-password-2' } })).status).toBe(200);
    expect((await call(h, 'POST', '/api/auth/login', { body: { email: 'reset@example.com', password: 'old-password-1' } })).status).toBe(401);
  });

  it('burns the code after 5 wrong attempts and expires it after 15 minutes', async () => {
    const h = makeHarness({ config: { resendKey: 're_test', resetEmailFrom: 'no-reply@tequilatown.com' } });
    h.fetchMock.handler = () => Response.json({ id: 'x' });
    await signup(h, { email: 'burn@example.com' });
    await call(h, 'POST', '/api/auth/password/forgot', { body: { email: 'burn@example.com' } });
    const code = /\b(\d{6})\b/.exec((h.fetchMock.calls[0].body as { text: string }).text)![1];
    const bad = code === '999999' ? '888888' : '999999';
    for (let i = 0; i < 5; i++) {
      await call(h, 'POST', '/api/auth/password/reset', { body: { email: 'burn@example.com', code: bad, password: 'whatever-123' } });
    }
    expect((await call(h, 'POST', '/api/auth/password/reset', { body: { email: 'burn@example.com', code, password: 'whatever-123' } })).body.code).toBe('INVALID_CODE');

    h.clock.advance(61_000);
    await call(h, 'POST', '/api/auth/password/forgot', { body: { email: 'burn@example.com' } });
    const code2 = /\b(\d{6})\b/.exec((h.fetchMock.calls[1].body as { text: string }).text)![1];
    h.clock.advance(15 * 60_000 + 1);
    expect((await call(h, 'POST', '/api/auth/password/reset', { body: { email: 'burn@example.com', code: code2, password: 'whatever-123' } })).body.code).toBe(
      'INVALID_CODE',
    );
  });
});
