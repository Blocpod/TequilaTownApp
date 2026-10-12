/**
 * End-to-end through createApp(...).fetch(new Request(...)) — the same code path
 * the Netlify function runs, with the in-memory store standing in for Blobs:
 * signup → ritual → claim ticket → scan → complete mission → leaderboard → delete.
 */
import { describe, expect, it } from 'vitest';
import type {
  ClaimTicketResponse,
  CompleteMissionResponse,
  LeaderboardResponse,
  MeResponse,
  Progress,
  RitualResponse,
  ScanResult,
  Session,
} from '../shared/api';
import { bonusPoints } from '../shared/content/festival';
import { missionById } from '../shared/content/missions';
import { call, code, makeHarness } from './test-utils';

describe('end-to-end festival day', () => {
  it('signup → ritual → ticket → scan → mission → leaderboard → delete', async () => {
    const h = makeHarness();

    // 1. Sign up (21+), see an empty passport.
    const signup = await call<Session>(h, 'POST', '/api/auth/signup', {
      body: { email: 'paloma@example.com', password: 'jimador-2027', name: 'Paloma Reyes', birthDate: '1995-04-14' },
    });
    expect(signup.status).toBe(201);
    const token = signup.body.accessToken;
    const me = await call<MeResponse>(h, 'GET', '/api/me', { token });
    expect(me.body.user).toMatchObject({ name: 'Paloma Reyes', email: 'paloma@example.com', showOnLeaderboard: true });
    expect(me.body.progress).toMatchObject({ points: 0, ticket: null, ritual: null, persona: null });
    expect(me.body.progress.level).toMatchObject({ level: 1, title: 'Novice', next: 100 });

    // 2. The Ritual → persona + bonus.
    const ritual = await call<RitualResponse>(h, 'POST', '/api/ritual', {
      token,
      body: {
        answers: {
          drinker_identity: 'tequila_loyalist',
          how_they_drink: 'flights',
          brand_behavior: 'usually_one',
          taste_profile: ['sweet_vanilla', 'peppery_spice'],
          discovery_channel: 'festivals_events',
          occasion_context: 'special_occasions',
          culture_draw: 'heritage_tradition',
        },
      },
    });
    expect(ritual.body.pointsAwarded).toBe(bonusPoints.ritualComplete);
    expect(ritual.body.progress.persona?.title).toBeTruthy();

    // 3. Claim a ticket.
    const ticket = await call<ClaimTicketResponse>(h, 'POST', '/api/tickets/claim', { token, body: { code: 'TIXR-2027-GA-0042' } });
    expect(ticket.body).toMatchObject({ status: 'claimed', pointsAwarded: bonusPoints.ticketClaim });

    // 4. Scan the agave shrine QR (as a web URL, like the phone camera would read it).
    const scan = await call<ScanResult>(h, 'POST', '/api/scan', { token, body: { payload: `https://tequilatown.com/s/${code('AGV-SHRINE')}` } });
    expect(scan.body).toMatchObject({ kind: 'mission_step', missionId: 'mission-agave-explorer', stepId: 's2' });

    // 5. Finish the mission's other steps and claim the stamp.
    await call<Progress>(h, 'POST', '/api/missions/step', { token, body: { missionId: 'mission-agave-explorer', stepId: 's1' } });
    await call<Progress>(h, 'POST', '/api/missions/step', { token, body: { missionId: 'mission-agave-explorer', stepId: 's3', answer: 1 } });
    const done = await call<CompleteMissionResponse>(h, 'POST', '/api/missions/complete', { token, body: { missionId: 'mission-agave-explorer' } });
    const expected = bonusPoints.ritualComplete + bonusPoints.ticketClaim + missionById('mission-agave-explorer')!.points;
    expect(done.body).toMatchObject({ pointsAwarded: 100, alreadyCompleted: false });
    expect(done.body.progress.points).toBe(expected);
    expect(done.body.progress.level).toMatchObject({ level: 2, title: 'Explorer' });
    expect(done.body.progress.ledger.map((e) => e.id)).toEqual(['mission:mission-agave-explorer', 'ticket', 'ritual']);

    // 6. A rival joins; the leaderboard ranks both, privately.
    const rival = await call<Session>(h, 'POST', '/api/auth/signup', {
      body: { email: 'rival@example.com', password: 'rival-pass-1', name: 'Rodrigo Mendoza', birthDate: '1990-01-01' },
    });
    await call(h, 'POST', '/api/tickets/claim', { token: rival.body.accessToken, body: { code: 'TIXR-2027-GA-0043' } });
    const board = await call<LeaderboardResponse>(h, 'GET', '/api/leaderboard', { token });
    expect(board.body.entries.map((e) => [e.rank, e.name, e.points, e.stamps, e.isYou])).toEqual([
      [1, 'Paloma R.', expected, 1, true],
      [2, 'Rodrigo M.', bonusPoints.ticketClaim, 0, false],
    ]);
    expect(board.body.you?.rank).toBe(1);

    // 7. Delete the account: everything is gone, the rival is untouched.
    expect((await call(h, 'DELETE', '/api/me', { token })).status).toBe(200);
    expect((await call(h, 'GET', '/api/me', { token })).status).toBe(401);
    const after = await call<LeaderboardResponse>(h, 'GET', '/api/leaderboard', { token: rival.body.accessToken });
    expect(after.body.entries.map((e) => e.name)).toEqual(['Rodrigo M.']);
    expect(after.body.you?.rank).toBe(1);
    // The released ticket can now be claimed by the rival.
    const reclaim = await call<ClaimTicketResponse>(h, 'POST', '/api/tickets/claim', { token: rival.body.accessToken, body: { code: 'TIXR-2027-GA-0042' } });
    expect(reclaim.body.status).toBe('claimed');
  });
});
