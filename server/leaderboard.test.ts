import { describe, expect, it } from 'vitest';
import type { LeaderboardResponse, MeResponse } from '../shared/api';
import { bonusPoints } from '../shared/content/festival';
import { LEADERBOARD_SIZE } from './leaderboard';
import type { ScoresDoc } from './types';
import { displayName } from './users';
import { call, makeHarness, PNG_1x1, signup, TEST_ADMIN_KEY } from './test-utils';

describe('displayName', () => {
  it.each([
    ['Maria Lopez Garcia', 'Maria G.'],
    ['maria', 'Maria'],
    ['  josé   ángel  ', 'José Á.'],
    ['Festival Guest', 'Festival G.'],
    ['', 'Guest'],
  ])('%s → %s', (input, out) => expect(displayName(input)).toBe(out));
});

describe('GET /api/leaderboard', () => {
  it('ranks by points (ties → first to reach), uses private names, hides opted-out users', async () => {
    const h = makeHarness();
    const ana = await signup(h, { name: 'Ana Torres' });
    h.clock.advance(1000);
    const ben = await signup(h, { name: 'Benito Juárez' });
    h.clock.advance(1000);
    const cris = await signup(h, { name: 'Cristina Ruiz' });
    h.clock.advance(1000);
    const zero = await signup(h, { name: 'Zero Points' });

    // ben claims a ticket first, then ana, so ben wins the tie; cris completes the ritual only.
    await call(h, 'POST', '/api/tickets/claim', { token: ben.accessToken, body: { code: 'BEN-TICKET-1' } });
    h.clock.advance(1000);
    await call(h, 'POST', '/api/tickets/claim', { token: ana.accessToken, body: { code: 'ANA-TICKET-1' } });
    h.clock.advance(1000);
    await call(h, 'POST', '/api/missions/step', { token: cris.accessToken, body: { missionId: 'mission-agave-explorer', stepId: 's1' } });

    const board = await call<LeaderboardResponse>(h, 'GET', '/api/leaderboard', { token: ana.accessToken });
    expect(board.status).toBe(200);
    expect(board.body.entries.map((e) => [e.rank, e.name, e.points])).toEqual([
      [1, 'Benito J.', bonusPoints.ticketClaim],
      [2, 'Ana T.', bonusPoints.ticketClaim],
    ]);
    expect(board.body.entries[1].isYou).toBe(true);
    expect(board.body.you).toMatchObject({ rank: 2, name: 'Ana T.', isYou: true });
    // Full names and ids never leak.
    expect(JSON.stringify(board.body)).not.toContain('Torres');
    expect(JSON.stringify(board.body)).not.toContain(ana.user.id);

    // zero-point users aren't listed, but still get their true rank.
    const zb = await call<LeaderboardResponse>(h, 'GET', '/api/leaderboard', { token: zero.accessToken });
    expect(zb.body.entries).toHaveLength(2);
    expect(zb.body.you).toMatchObject({ rank: 3, points: 0 });

    // Ben opts out: hidden from everyone else, but still sees his own true rank.
    await call<MeResponse>(h, 'PATCH', '/api/me', { token: ben.accessToken, body: { showOnLeaderboard: false } });
    const after = await call<LeaderboardResponse>(h, 'GET', '/api/leaderboard', { token: ana.accessToken });
    expect(after.body.entries.map((e) => e.name)).toEqual(['Ana T.']);
    expect(after.body.you?.rank).toBe(1);
    const benView = await call<LeaderboardResponse>(h, 'GET', '/api/leaderboard', { token: ben.accessToken });
    expect(benView.body.entries.some((e) => e.isYou)).toBe(false);
    expect(benView.body.you).toMatchObject({ rank: 1, isYou: true });
  });

  it('reflects renames and avatars, and computes true rank beyond the top 50', async () => {
    const h = makeHarness();
    const me = await signup(h, { name: 'Late Arrival' });
    // Seed 60 visible competitors directly.
    const entries: ScoresDoc['entries'] = {};
    for (let i = 0; i < 60; i++) {
      entries[`seed-${i}`] = { name: `Seed ${i}.`, avatarId: null, points: 1000 - i, level: 5, stamps: 3, show: true, at: '2026-10-01T00:00:00.000Z' };
    }
    await h.store.ns('leaderboard').setJSON('scores', { updatedAt: new Date().toISOString(), entries } satisfies ScoresDoc);
    await call(h, 'POST', '/api/tickets/claim', { token: me.accessToken, body: { code: 'LATE-TICKET-1' } });
    await call(h, 'PATCH', '/api/me', { token: me.accessToken, body: { name: 'Late Bloomer' } });
    await call(h, 'PUT', '/api/me/avatar', { token: me.accessToken, body: { image: PNG_1x1.toString('base64') } });

    const board = await call<LeaderboardResponse>(h, 'GET', '/api/leaderboard', { token: me.accessToken });
    expect(board.body.entries).toHaveLength(LEADERBOARD_SIZE);
    expect(board.body.entries[0]).toMatchObject({ rank: 1, points: 1000 });
    expect(board.body.you).toMatchObject({ rank: 61, name: 'Late B.', points: bonusPoints.ticketClaim });
    expect(board.body.you?.avatarUrl).toMatch(/^https:\/\/tt\.test\/api\/media\/avatars\/[A-Za-z0-9_-]{22}$/);

    // Admin rebuild drops the seeded (non-existent) users and keeps real ones.
    const rebuilt = await call(h, 'POST', '/api/admin/leaderboard/rebuild', { headers: { 'x-admin-key': TEST_ADMIN_KEY } });
    expect(rebuilt.body).toEqual({ users: 1 });
    const after = await call<LeaderboardResponse>(h, 'GET', '/api/leaderboard', { token: me.accessToken });
    expect(after.body.entries).toHaveLength(1);
    expect(after.body.you?.rank).toBe(1);
  });
});
