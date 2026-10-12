import { describe, expect, it } from 'vitest';
import type { PublicConfig } from '../shared/api';
import { createShareHandler } from './share';
import { BASE, call, makeHarness, signup } from './test-utils';

describe('HTTP plumbing', () => {
  it('answers CORS preflight for any origin with Authorization allowed', async () => {
    const h = makeHarness();
    const res = await h.app.fetch(
      new Request(`${BASE}/api/me`, {
        method: 'OPTIONS',
        headers: { origin: 'http://localhost:8081', 'access-control-request-method': 'PATCH', 'access-control-request-headers': 'authorization,content-type' },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-headers')).toContain('authorization');
    expect(res.headers.get('access-control-allow-methods')).toContain('PATCH');
  });

  it('returns ApiErrorBody JSON for 404 and 405, with CORS + request id', async () => {
    const h = makeHarness();
    const nf = await call(h, 'GET', '/api/nope');
    expect(nf.status).toBe(404);
    expect(nf.body).toEqual({ error: 'Not found', code: 'NOT_FOUND' });
    expect(nf.headers.get('access-control-allow-origin')).toBe('*');
    expect(nf.headers.get('x-request-id')).toBeTruthy();
    const na = await call(h, 'DELETE', '/api/health');
    expect(na.status).toBe(405);
    expect(na.headers.get('allow')).toContain('GET');
    // trailing slashes are tolerated
    expect((await call(h, 'GET', '/api/health/')).status).toBe(200);
  });

  it('never leaks internals on unexpected errors', async () => {
    const h = makeHarness();
    const s = await signup(h);
    // Corrupt the user's progress record to force an exception deep in a handler.
    h.store.data.get('progress')!.set(s.user.id, { data: '{not json', etag: '"x"', metadata: {} });
    const res = await call(h, 'GET', '/api/progress', { token: s.accessToken });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Something went wrong. Please try again', code: 'SERVER_ERROR' });
    expect(res.text).not.toContain('SyntaxError');
    expect(h.logs.some((l) => l.level === 'error' && l.msg === 'unhandled_error' && l.ctx?.userId === s.user.id)).toBe(true);
  });

  it('health and public config reflect the environment', async () => {
    const bare = makeHarness({ config: { jwtSecretIsDev: true, qrSecretIsDev: true } });
    const health = await call(bare, 'GET', '/api/health');
    expect(health.body).toEqual({ ok: true, configured: { jwt: false, qr: false, openrouter: false, resend: false, apple: true } });
    const cfg = await call<PublicConfig>(bare, 'GET', '/api/config');
    expect(cfg.body).toEqual({ passwordReset: false, appleSignIn: true, ai: { chat: false, memories: false, identify: false } });

    const full = makeHarness({ config: { openrouterKey: 'k', resendKey: 'r', resetEmailFrom: 'a@b.co' } });
    expect((await call(full, 'GET', '/api/health')).body.configured).toEqual({ jwt: true, qr: true, openrouter: true, resend: true, apple: true });
    expect((await call<PublicConfig>(full, 'GET', '/api/config')).body).toEqual({ passwordReset: true, appleSignIn: true, ai: { chat: true, memories: true, identify: true } });
  });

  it('uses PUBLIC_BASE_URL for absolute URLs when set', async () => {
    const h = makeHarness({ config: { publicBaseUrl: 'https://tequilatown.com' } });
    const s = await call(h, 'POST', '/api/auth/signup', {
      body: { email: 'base@example.com', password: 'longenough1', name: 'Base Url', birthDate: '1990-01-01' },
    });
    const me = await call(h, 'PUT', '/api/me/avatar', {
      token: s.body.accessToken,
      body: { image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
    });
    expect(me.body.user.avatarUrl).toMatch(/^https:\/\/tequilatown\.com\/api\/media\/avatars\//);
  });

  it('media ids are validated and unknown media is 404', async () => {
    const h = makeHarness();
    expect((await call(h, 'GET', '/api/media/avatars/..%2F..%2Fusers')).status).toBe(404);
    expect((await call(h, 'GET', '/api/media/secrets/abcdefghijklmnopqrstuv')).status).toBe(404);
    expect((await call(h, 'GET', '/api/media/memories/abcdefghijklmnopqrstuv')).status).toBe(404);
  });
});

describe('share pages', () => {
  it('/s/:code renders a deep-link landing page with a nonce-protected script', async () => {
    const h = makeHarness();
    const share = createShareHandler({ store: h.store, config: h.app.services.config });
    const res = await share.fetch(new Request(`${BASE}/s/agv-shrine-7k2qd`));
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('href="tequilatown://scan/AGV-SHRINE-7K2QD"');
    expect(html).toContain('<span class="code-chip">AGV-SHRINE-7K2QD</span>');
    const csp = res.headers.get('content-security-policy')!;
    const nonce = /'nonce-([^']+)'/.exec(csp)![1];
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(html).not.toMatch(/style="/);
  });

  it('escapes hostile input and 404s on junk', async () => {
    const h = makeHarness();
    const share = createShareHandler({ store: h.store, config: h.app.services.config });
    const xss = await share.fetch(new Request(`${BASE}/s/%3Cscript%3Ealert(1)%3C%2Fscript%3E`));
    expect(xss.status).toBe(404);
    expect(await xss.text()).not.toContain('<script>alert');
    expect((await share.fetch(new Request(`${BASE}/m/short`))).status).toBe(404);
    expect((await share.fetch(new Request(`${BASE}/m/abcdefghijklmnopqrstuv`))).status).toBe(404);
  });
});

describe('netlify dev proxy shim', () => {
  it('maps the CLI static-file retries back to the real route (dev only)', async () => {
    const dev = makeHarness({ config: { netlifyDev: true } });
    const body = { email: 'kid@example.com', password: 'longenough', name: 'Kid', birthDate: '2012-01-01' };
    for (const suffix of ['', '.html', '.htm', '/index.html', '/index.htm']) {
      const res = await call(dev, 'POST', `/api/auth/signup${suffix}`, { body });
      expect(res.status, suffix).toBe(403);
      expect(res.body.code).toBe('UNDERAGE');
    }
    const prod = makeHarness();
    expect((await call(prod, 'POST', '/api/auth/signup/index.html', { body })).status).toBe(404);
  });
});
