import { describe, expect, it } from 'vitest';
import type { MeResponse, Memory, Order, Session } from '../shared/api';
import { createShareHandler } from './share';
import type { RitualAggregate, ScoresDoc } from './types';
import { BASE, call, code, JPEG_STUB, makeHarness, PNG_1x1, signup, TEST_ADMIN_KEY } from './test-utils';

const ANSWERS = {
  drinker_identity: 'cocktail_explorer',
  how_they_drink: 'cocktails',
  brand_behavior: 'always_trying_new',
  taste_profile: ['citrus_bright'],
  discovery_channel: 'friends',
  occasion_context: 'nights_out',
  culture_draw: 'music_nightlife',
};

describe('PATCH /api/me & avatar', () => {
  it('updates profile fields and validates bookmarks', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const res = await call<MeResponse>(h, 'PATCH', '/api/me', {
      token: s.accessToken,
      body: { name: 'Valeria Campos', phone: '+1 (555) 010-2030', bookmarks: ['dobel-diamante', 'classic-margarita', 'dobel-diamante'] },
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Valeria Campos', phone: '+1 (555) 010-2030' });
    expect(res.body.progress.bookmarks).toEqual(['dobel-diamante', 'classic-margarita']);
    expect((await call(h, 'PATCH', '/api/me', { token: s.accessToken, body: { bookmarks: ['not-a-drink'] } })).status).toBe(400);
    expect((await call(h, 'PATCH', '/api/me', { token: s.accessToken, body: { bookmarks: Array(51).fill(0).map((_, i) => `d${i}`) } })).status).toBe(400);
    expect((await call(h, 'PATCH', '/api/me', { token: s.accessToken, body: { phone: 'call me maybe' } })).status).toBe(400);
    expect((await call(h, 'PATCH', '/api/me', { token: s.accessToken, body: { showOnLeaderboard: 'no' } })).status).toBe(400);
    const cleared = await call<MeResponse>(h, 'PATCH', '/api/me', { token: s.accessToken, body: { phone: null } });
    expect(cleared.body.user.phone).toBeNull();
  });

  it('uploads an avatar (magic bytes checked, ≤ 1.5 MB) and replaces the old one', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const a1 = await call<MeResponse>(h, 'PUT', '/api/me/avatar', { token: s.accessToken, body: { image: PNG_1x1.toString('base64') } });
    expect(a1.status).toBe(200);
    const url1 = a1.body.user.avatarUrl!;
    expect(url1.startsWith(`${BASE}/api/media/avatars/`)).toBe(true);
    const img = await h.app.fetch(new Request(url1));
    expect(img.headers.get('content-type')).toBe('image/png');

    const a2 = await call<MeResponse>(h, 'PUT', '/api/me/avatar', { token: s.accessToken, body: { image: `data:image/jpeg;base64,${JPEG_STUB.toString('base64')}` } });
    expect(a2.body.user.avatarUrl).not.toBe(url1);
    expect((await h.app.fetch(new Request(url1))).status).toBe(404);

    expect((await call(h, 'PUT', '/api/me/avatar', { token: s.accessToken, body: { image: Buffer.from('<svg/>').toString('base64') } })).status).toBe(400);
    const huge = Buffer.concat([PNG_1x1, Buffer.alloc(1.6 * 1024 * 1024)]).toString('base64');
    expect((await call(h, 'PUT', '/api/me/avatar', { token: s.accessToken, body: { image: huge } })).status).toBe(413);
  });
});

describe('DELETE /api/me', () => {
  it('erases everything and releases the ticket for re-claiming', async () => {
    const h = makeHarness({ config: { openrouterKey: 'or-key' } });
    h.fetchMock.handler = (url) =>
      url.includes('openrouter')
        ? Response.json({ choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${PNG_1x1.toString('base64')}` } }], content: '{}' } }] })
        : new Response('nope', { status: 500 });

    const keep = await signup(h, { email: 'keeper@example.com' });
    const gone = await signup(h, { email: 'leaver@example.com', name: 'Leaving Soon' });
    const t = gone.accessToken;

    await call(h, 'POST', '/api/ritual', { token: t, body: { answers: ANSWERS } });
    await call(h, 'POST', '/api/ritual', { token: keep.accessToken, body: { answers: ANSWERS } });
    expect((await call(h, 'POST', '/api/tickets/claim', { token: t, body: { code: 'LEAVER-TICKET-01' } })).status).toBe(201);
    await call(h, 'POST', '/api/scan', { token: t, body: { payload: code('AGV-SHRINE') } });
    await call(h, 'PUT', '/api/me/avatar', { token: t, body: { image: PNG_1x1.toString('base64') } });
    const mem = await call<Memory>(h, 'POST', '/api/ai/memories', { token: t, body: { image: JPEG_STUB.toString('base64'), style: 'kodachrome' } });
    expect(mem.status).toBe(201);
    const order = await call<Order>(h, 'POST', '/api/shop/orders', { token: t, body: { items: [{ productId: 'goods-tote', qty: 1 }] } });
    await call(h, 'POST', '/api/shop/requests', { token: t, body: { productId: 'bottle-reposado', message: 'please' } });
    await call(h, 'POST', '/api/auth/login', { body: { email: 'leaver@example.com', password: 'wrong-password!' } });
    const second = await call<Session>(h, 'POST', '/api/auth/login', { body: { email: 'leaver@example.com', password: 'agave-fields-42' } });

    const del = await call(h, 'DELETE', '/api/me', { token: t });
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ ok: true });

    // Nothing in any namespace references the deleted user.
    const uid = gone.user.id;
    const dump = h.store.dump();
    const allKeys = Object.entries(dump).flatMap(([ns, keys]) => keys.map((k) => `${ns}:${k}`));
    expect(allKeys.filter((k) => k.includes(uid))).toEqual([]);
    for (const [ns, map] of h.store.data) {
      for (const [key, entry] of map) {
        const text = typeof entry.data === 'string' ? entry.data : '';
        expect(`${ns}:${key}:${text}`.includes(uid), `${ns}:${key}`).toBe(false);
      }
    }
    // Exactly what should remain: the other user's records + shared docs.
    expect(dump.users).toEqual([keep.user.id]);
    expect(dump.media ?? []).toEqual([]);
    expect(dump.memories ?? []).toEqual([]);
    expect(dump.shop ?? []).toEqual([]);
    expect(dump.tickets ?? []).toEqual([]);
    expect(dump.progress).toEqual([keep.user.id]);
    expect((dump.tokens ?? []).every((k) => k.startsWith('refresh/'))).toBe(true);
    const scores = (await h.store.ns('leaderboard').getJSON<ScoresDoc>('scores'))!.value;
    expect(Object.keys(scores.entries)).toEqual([keep.user.id]);
    const agg = (await h.store.ns('analytics').getJSON<RitualAggregate>('ritual-aggregate/onboarding_v2'))!.value;
    expect(agg.respondents).toBe(1);
    expect(agg.counts.culture_draw.music_nightlife).toBe(1);

    // Sessions are dead, media and share pages are gone, the pickup code is void.
    expect((await call(h, 'GET', '/api/me', { token: t })).status).toBe(401);
    expect((await call(h, 'POST', '/api/auth/refresh', { body: { refreshToken: gone.refreshToken } })).status).toBe(401);
    expect((await call(h, 'POST', '/api/auth/refresh', { body: { refreshToken: second.body.refreshToken } })).status).toBe(401);
    expect((await h.app.fetch(new Request(mem.body.imageUrl))).status).toBe(404);
    const share = createShareHandler({ store: h.store, config: h.app.services.config });
    expect((await share.fetch(new Request(mem.body.shareUrl))).status).toBe(404);
    expect((await call(h, 'GET', `/api/admin/pickup/${order.body.pickupCode}`, { headers: { 'x-admin-key': TEST_ADMIN_KEY } })).status).toBe(404);
    expect((await call(h, 'POST', '/api/auth/login', { body: { email: 'leaver@example.com', password: 'agave-fields-42' } })).status).toBe(401);

    // The email can sign up again, and the ticket can be claimed by someone else.
    const reborn = await signup(h, { email: 'leaver@example.com' });
    expect(reborn.user.id).not.toBe(uid);
    const reclaim = await call(h, 'POST', '/api/tickets/claim', { token: keep.accessToken, body: { code: 'LEAVER-TICKET-01' } });
    expect(reclaim.status).toBe(201);
    expect(reclaim.body.status).toBe('claimed');
  });
});
