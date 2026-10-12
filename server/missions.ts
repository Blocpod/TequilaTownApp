/**
 * The passport game — pure functions over a ProgressRecord (no I/O), run inside
 * the progress CAS mutator. Rules (see shared/content/missions.ts):
 *   - `requires` must be completed before a mission can start/advance/complete (403 LOCKED)
 *   - scan steps need a validly signed code whose slug equals the step's `code` (400 INVALID_CODE)
 *   - quiz steps need `answer === step.answer` (400 WRONG_ANSWER)
 *   - share / visit / taste / watch are honor-based
 *   - completing a step auto-starts its mission; everything is idempotent
 *   - mission points are awarded exactly once via the ledger (`mission:<id>`)
 */
import type { CompleteStepRequest, UserMission } from '../shared/api';
import { missionById, type Mission, type MissionStep } from '../shared/content/missions';
import { normalizeScanPayload, verifyCode } from './codes';
import { ApiError, badRequest } from './http';
import { award } from './progress';
import type { ProgressRecord } from './types';

export function getMission(id: unknown): Mission {
  if (typeof id !== 'string' || !id) throw badRequest('`missionId` is required', { field: 'missionId' });
  const m = missionById(id);
  if (!m) throw new ApiError('NOT_FOUND', 'Mission not found', { details: { missionId: id } });
  return m;
}

export function getStep(mission: Mission, stepId: unknown): MissionStep {
  if (typeof stepId !== 'string' || !stepId) throw badRequest('`stepId` is required', { field: 'stepId' });
  const s = mission.steps.find((x) => x.id === stepId);
  if (!s) throw new ApiError('NOT_FOUND', 'Step not found', { details: { missionId: mission.id, stepId } });
  return s;
}

export function missingRequirements(rec: ProgressRecord, mission: Mission): string[] {
  return mission.requires.filter((id) => rec.missions[id]?.status !== 'completed');
}

function assertUnlocked(rec: ProgressRecord, mission: Mission) {
  const missing = missingRequirements(rec, mission);
  if (missing.length) {
    throw new ApiError('LOCKED', `Complete ${missing.length} more mission${missing.length === 1 ? '' : 's'} to unlock ${mission.name}`, {
      details: { missionId: mission.id, missing },
    });
  }
}

/** Starts the mission if needed. Returns true when the record changed. */
export function startMission(rec: ProgressRecord, mission: Mission, now: Date): boolean {
  if (rec.missions[mission.id]) return false;
  assertUnlocked(rec, mission);
  const um: UserMission = { status: 'in_progress', completedSteps: [], startedAt: now.toISOString(), completedAt: null };
  rec.missions[mission.id] = um;
  return true;
}

/**
 * Stateless input validation for a step (signature / quiz answer). Runs before
 * the CAS loop so a wrong answer never touches storage.
 */
export function validateStepInput(step: MissionStep, input: Pick<CompleteStepRequest, 'code' | 'answer'>, qrSecret: string): void {
  if (step.type === 'scan') {
    if (typeof input.code !== 'string' || !input.code.trim()) throw new ApiError('INVALID_CODE', 'Scan the QR code at this spot to continue');
    const code = normalizeScanPayload(input.code);
    const slug = code ? verifyCode(code, qrSecret) : null;
    if (!slug || slug !== step.code) throw new ApiError('INVALID_CODE', "That code doesn't belong to this step. Find the right QR and try again");
  } else if (step.type === 'quiz') {
    if (typeof input.answer !== 'number' || !Number.isInteger(input.answer)) throw badRequest('`answer` must be the index of the chosen option', { field: 'answer' });
    if (input.answer !== step.answer) throw new ApiError('WRONG_ANSWER', 'Not quite. Give it another try');
  }
}

/** Marks a (pre-validated) step done, auto-starting the mission. Returns true when changed. */
export function completeStep(rec: ProgressRecord, mission: Mission, step: MissionStep, now: Date): boolean {
  const existing = rec.missions[mission.id];
  if (existing?.status === 'completed' || existing?.completedSteps.includes(step.id)) return false;
  // Requirements apply to every advance, not just the start.
  assertUnlocked(rec, mission);
  startMission(rec, mission, now);
  const um = rec.missions[mission.id];
  um.completedSteps.push(step.id);
  // Keep the canonical step order regardless of completion order.
  const order = mission.steps.map((s) => s.id);
  um.completedSteps.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return true;
}

/** Completes a mission and awards its points exactly once. */
export function completeMission(rec: ProgressRecord, mission: Mission, now: Date): { pointsAwarded: number; alreadyCompleted: boolean } {
  const um = rec.missions[mission.id];
  if (!um) {
    assertUnlocked(rec, mission);
    throw new ApiError('NOT_STARTED', 'Start this mission first', { details: { missionId: mission.id } });
  }
  if (um.status === 'completed') return { pointsAwarded: 0, alreadyCompleted: true };
  assertUnlocked(rec, mission);
  const missing = mission.steps.filter((s) => !um.completedSteps.includes(s.id)).map((s) => s.id);
  if (missing.length) {
    throw new ApiError('INCOMPLETE_STEPS', 'Finish every step before claiming your stamp', { details: { missionId: mission.id, missing } });
  }
  um.status = 'completed';
  um.completedAt = now.toISOString();
  const pointsAwarded = award(rec, `mission:${mission.id}`, mission.points, `Mission: ${mission.name}`, now);
  return { pointsAwarded, alreadyCompleted: false };
}
