import { describe, expect, it } from 'vitest';
import type { CompleteMissionResponse, Progress, ScanResult } from '../shared/api';
import { bonusPoints } from '../shared/content/festival';
import { missionById, missions } from '../shared/content/missions';
import { signCode } from './codes';
import { completeMission, completeStep, startMission, validateStepInput } from './missions';
import { emptyProgress, pointsOf } from './progress';
import { call, code, makeHarness, signup } from './test-utils';

const NOW = new Date('2026-10-12T15:00:00Z');
const agave = missionById('mission-agave-explorer')!;
const grand = missionById('mission-grand-collector')!;

/** Completes every step of a mission through the API. */
async function finishSteps(h: ReturnType<typeof makeHarness>, token: string, missionId: string) {
  const m = missionById(missionId)!;
  for (const s of m.steps) {
    const body: Record<string, unknown> = { missionId, stepId: s.id };
    if (s.type === 'scan') body.code = code(s.code!);
    if (s.type === 'quiz') body.answer = s.answer;
    const res = await call(h, 'POST', '/api/missions/step', { token, body });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }
}

describe('mission rules (pure)', () => {
  it('starts idempotently and locks missions with unmet requirements', () => {
    const rec = emptyProgress('u1', NOW);
    expect(startMission(rec, agave, NOW)).toBe(true);
    expect(startMission(rec, agave, NOW)).toBe(false);
    expect(rec.missions[agave.id].status).toBe('in_progress');
    expect(() => startMission(rec, grand, NOW)).toThrow(expect.objectContaining({ code: 'LOCKED', status: 403 }));
  });

  it('validates scan codes and quiz answers', () => {
    const scan = agave.steps.find((s) => s.type === 'scan')!;
    const quiz = agave.steps.find((s) => s.type === 'quiz')!;
    const secret = 's3cret';
    expect(() => validateStepInput(scan, { code: signCode('AGV-SHRINE', secret) }, secret)).not.toThrow();
    expect(() => validateStepInput(scan, { code: `https://x.y/s/${signCode('AGV-SHRINE', secret)}` }, secret)).not.toThrow();
    expect(() => validateStepInput(scan, { code: signCode('CAV-VAULT', secret) }, secret)).toThrow(expect.objectContaining({ code: 'INVALID_CODE' }));
    expect(() => validateStepInput(scan, { code: 'AGV-SHRINE-AAAAA' }, secret)).toThrow(expect.objectContaining({ code: 'INVALID_CODE' }));
    expect(() => validateStepInput(scan, {}, secret)).toThrow(expect.objectContaining({ code: 'INVALID_CODE' }));
    expect(() => validateStepInput(quiz, { answer: quiz.answer }, secret)).not.toThrow();
    expect(() => validateStepInput(quiz, { answer: (quiz.answer! + 1) % 3 }, secret)).toThrow(expect.objectContaining({ code: 'WRONG_ANSWER' }));
    expect(() => validateStepInput(quiz, {}, secret)).toThrow(expect.objectContaining({ code: 'BAD_REQUEST' }));
  });

  it('awards mission points exactly once', () => {
    const rec = emptyProgress('u1', NOW);
    for (const s of agave.steps) completeStep(rec, agave, s, NOW);
    expect(completeMission(rec, agave, NOW)).toEqual({ pointsAwarded: agave.points, alreadyCompleted: false });
    expect(completeMission(rec, agave, NOW)).toEqual({ pointsAwarded: 0, alreadyCompleted: true });
    expect(pointsOf(rec)).toBe(agave.points);
    expect(rec.ledger.filter((e) => e.id === `mission:${agave.id}`)).toHaveLength(1);
  });

  it('keeps completed steps in canonical order', () => {
    const rec = emptyProgress('u1', NOW);
    const [s1, s2, s3] = agave.steps;
    completeStep(rec, agave, s3, NOW);
    completeStep(rec, agave, s1, NOW);
    completeStep(rec, agave, s2, NOW);
    expect(rec.missions[agave.id].completedSteps).toEqual(['s1', 's2', 's3']);
  });
});

describe('missions API', () => {
  it('start → steps → complete, with points awarded once', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const started = await call<Progress>(h, 'POST', '/api/missions/start', { token: s.accessToken, body: { missionId: agave.id } });
    expect(started.body.missions[agave.id]).toMatchObject({ status: 'in_progress', completedSteps: [] });

    const early = await call(h, 'POST', '/api/missions/complete', { token: s.accessToken, body: { missionId: agave.id } });
    expect(early.status).toBe(400);
    expect(early.body.code).toBe('INCOMPLETE_STEPS');
    expect(early.body.details.missing).toEqual(['s1', 's2', 's3']);

    await finishSteps(h, s.accessToken, agave.id);
    const done = await call<CompleteMissionResponse>(h, 'POST', '/api/missions/complete', { token: s.accessToken, body: { missionId: agave.id } });
    expect(done.body.pointsAwarded).toBe(agave.points);
    expect(done.body.alreadyCompleted).toBe(false);
    expect(done.body.progress.points).toBe(agave.points);
    expect(done.body.progress.level).toMatchObject({ level: 2, title: 'Explorer' });
    expect(done.body.progress.ledger[0]).toMatchObject({ id: `mission:${agave.id}`, amount: agave.points });

    const again = await call<CompleteMissionResponse>(h, 'POST', '/api/missions/complete', { token: s.accessToken, body: { missionId: agave.id } });
    expect(again.body).toMatchObject({ pointsAwarded: 0, alreadyCompleted: true });
    expect(again.body.progress.points).toBe(agave.points);
  });

  it('steps auto-start the mission and are idempotent (no extra writes)', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const first = await call<Progress>(h, 'POST', '/api/missions/step', { token: s.accessToken, body: { missionId: agave.id, stepId: 's1' } });
    expect(first.body.missions[agave.id].completedSteps).toEqual(['s1']);
    const writes = h.store.writes;
    const repeat = await call<Progress>(h, 'POST', '/api/missions/step', { token: s.accessToken, body: { missionId: agave.id, stepId: 's1' } });
    expect(repeat.status).toBe(200);
    expect(repeat.body.missions[agave.id].completedSteps).toEqual(['s1']);
    expect(h.store.writes).toBe(writes);
  });

  it('rejects wrong scan codes and wrong quiz answers', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const wrongStep = await call(h, 'POST', '/api/missions/step', {
      token: s.accessToken,
      body: { missionId: agave.id, stepId: 's2', code: code('CAV-VAULT') },
    });
    expect(wrongStep.status).toBe(400);
    expect(wrongStep.body.code).toBe('INVALID_CODE');
    const forged = await call(h, 'POST', '/api/missions/step', { token: s.accessToken, body: { missionId: agave.id, stepId: 's2', code: 'AGV-SHRINE-ZZZZZ' } });
    expect(forged.body.code).toBe('INVALID_CODE');
    const wrong = await call(h, 'POST', '/api/missions/step', { token: s.accessToken, body: { missionId: agave.id, stepId: 's3', answer: 0 } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('WRONG_ANSWER');
    const progress = await call<Progress>(h, 'GET', '/api/progress', { token: s.accessToken });
    expect(progress.body.missions[agave.id]).toBeUndefined();
  });

  it('enforces requirements (403 LOCKED) on start, step and complete', async () => {
    const h = makeHarness();
    const s = await signup(h);
    for (const [path, body] of [
      ['/api/missions/start', { missionId: grand.id }],
      ['/api/missions/step', { missionId: grand.id, stepId: 's1' }],
      ['/api/missions/complete', { missionId: grand.id }],
    ] as const) {
      const res = await call(h, 'POST', path, { token: s.accessToken, body });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('LOCKED');
      expect(res.body.details.missing).toHaveLength(10);
    }
  });

  it('unlocks the Grand Collector once all ten missions are complete', async () => {
    const h = makeHarness();
    const s = await signup(h);
    for (const id of grand.requires) {
      await finishSteps(h, s.accessToken, id);
      expect((await call(h, 'POST', '/api/missions/complete', { token: s.accessToken, body: { missionId: id } })).status).toBe(200);
    }
    await finishSteps(h, s.accessToken, grand.id);
    const done = await call<CompleteMissionResponse>(h, 'POST', '/api/missions/complete', { token: s.accessToken, body: { missionId: grand.id } });
    expect(done.body.pointsAwarded).toBe(grand.points);
    const total = missions.reduce((sum, m) => sum + m.points, 0);
    expect(done.body.progress.points).toBe(total);
    expect(done.body.progress.level.title).toBe('Legend');
  });

  it('reports NOT_STARTED, unknown missions and unknown steps', async () => {
    const h = makeHarness();
    const s = await signup(h);
    expect((await call(h, 'POST', '/api/missions/complete', { token: s.accessToken, body: { missionId: agave.id } })).body.code).toBe('NOT_STARTED');
    expect((await call(h, 'POST', '/api/missions/start', { token: s.accessToken, body: { missionId: 'nope' } })).status).toBe(404);
    expect((await call(h, 'POST', '/api/missions/step', { token: s.accessToken, body: { missionId: agave.id, stepId: 's99' } })).status).toBe(404);
    expect((await call(h, 'POST', '/api/missions/start', { token: s.accessToken, body: {} })).body.code).toBe('BAD_REQUEST');
  });

  it('parallel step completions all land (optimistic concurrency)', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const m = missionById('mission-taste-seeker')!;
    await Promise.all(
      m.steps.map((st) =>
        call(h, 'POST', '/api/missions/step', {
          token: s.accessToken,
          body: { missionId: m.id, stepId: st.id, ...(st.type === 'scan' ? { code: code(st.code!) } : {}) },
        }),
      ),
    );
    const p = await call<Progress>(h, 'GET', '/api/progress', { token: s.accessToken });
    expect(p.body.missions[m.id].completedSteps).toEqual(m.steps.map((x) => x.id));
  });
});

describe('POST /api/scan', () => {
  it('completes the matching mission step from any payload form', async () => {
    const h = makeHarness();
    const s = await signup(h);
    for (const payload of [code('EXP-BOARD'), `tequilatown://scan/${code('ROJ-STILLS')}`, `https://tequilatown.com/s/${code('BRL-GOLD').toLowerCase()}`]) {
      const res = await call<ScanResult>(h, 'POST', '/api/scan', { token: s.accessToken, body: { payload } });
      expect(res.status).toBe(200);
      expect(res.body.kind).toBe('mission_step');
    }
    const p = await call<Progress>(h, 'GET', '/api/progress', { token: s.accessToken });
    expect(p.body.missions['mission-train-rider'].completedSteps).toEqual(['s2']);
    expect(p.body.missions['mission-distillery-master'].completedSteps).toEqual(['s2']);
    expect(p.body.missions['mission-barrel-hunter'].completedSteps).toEqual(['s2']);
  });

  it('returns LOCKED for a locked mission code', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const res = await call(h, 'POST', '/api/scan', { token: s.accessToken, body: { payload: code('GRAND-FINALE') } });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('LOCKED');
  });

  it('classifies tickets and unknown payloads', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const ticket = await call<ScanResult>(h, 'POST', '/api/scan', { token: s.accessToken, body: { payload: ' tixr-ga-000123 ' } });
    expect(ticket.body).toEqual({ kind: 'ticket', code: 'TIXR-GA-000123' });
    // A forged venue code is just ticket-shaped text, never a mission step.
    const forged = await call<ScanResult>(h, 'POST', '/api/scan', { token: s.accessToken, body: { payload: 'AGV-SHRINE-AAAAA' } });
    expect(forged.body.kind).toBe('ticket');
    for (const payload of ['https://instagram.com/tequilatownfest', 'hello world!', '']) {
      const res = await call<ScanResult>(h, 'POST', '/api/scan', { token: s.accessToken, body: { payload } });
      expect(res.body).toEqual({ kind: 'unknown' });
    }
  });
});

describe('tickets', () => {
  it('claims once per account, awards the bonus once, and blocks other accounts', async () => {
    const h = makeHarness();
    const a = await signup(h);
    const b = await signup(h);
    const first = await call(h, 'POST', '/api/tickets/claim', { token: a.accessToken, body: { code: 'tixr-abc-123' } });
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('claimed');
    expect(first.body.pointsAwarded).toBe(bonusPoints.ticketClaim);
    expect(first.body.progress.ticket).toMatchObject({ type: 'general_admission' });
    expect(first.body.progress.ticket.ref).toMatch(/^TT-[0-9A-HJKMNP-TV-Z]{8}$/);

    const mine = await call(h, 'POST', '/api/tickets/claim', { token: a.accessToken, body: { code: 'TIXR-ABC-123' } });
    expect(mine.status).toBe(200);
    expect(mine.body).toMatchObject({ status: 'already_yours', pointsAwarded: 0 });
    expect(mine.body.progress.ticket.ref).toBe(first.body.progress.ticket.ref);

    const taken = await call(h, 'POST', '/api/tickets/claim', { token: b.accessToken, body: { code: 'TIXR-ABC-123' } });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('TICKET_TAKEN');

    // A second, different ticket for the same guest: claimed, but no second bonus.
    const second = await call(h, 'POST', '/api/tickets/claim', { token: a.accessToken, body: { code: 'TIXR-XYZ-999' } });
    expect(second.body).toMatchObject({ status: 'claimed', pointsAwarded: 0 });
    expect(second.body.progress.points).toBe(bonusPoints.ticketClaim);

    // Raw codes are never stored.
    expect(JSON.stringify(h.store.dump())).not.toContain('TIXR-ABC-123');
  });

  it('rejects malformed codes', async () => {
    const h = makeHarness();
    const a = await signup(h);
    for (const c of ['abc', 'has spaces in it', 'x'.repeat(51), 'emoji🌵code']) {
      const res = await call(h, 'POST', '/api/tickets/claim', { token: a.accessToken, body: { code: c } });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_CODE');
    }
  });

  it('concurrent claims of one code by two accounts: exactly one wins', async () => {
    const h = makeHarness();
    const a = await signup(h);
    const b = await signup(h);
    const [ra, rb] = await Promise.all([
      call(h, 'POST', '/api/tickets/claim', { token: a.accessToken, body: { code: 'RACE-TICKET-1' } }),
      call(h, 'POST', '/api/tickets/claim', { token: b.accessToken, body: { code: 'RACE-TICKET-1' } }),
    ]);
    expect([ra.status, rb.status].sort()).toEqual([201, 409]);
  });
});
