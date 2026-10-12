/** HTTP handlers for progress, missions and QR scanning. */
import type { CompleteMissionResponse, ScanResult } from '../shared/api';
import { findScanStep } from '../shared/content/missions';
import { normalizeScanPayload, verifyCode } from './codes';
import { requireQrSecret } from './config';
import type { Ctx } from './context';
import { badRequest, json, readJson } from './http';
import { completeMission, completeStep, getMission, getStep, startMission, validateStepInput } from './missions';
import { loadProgress, mutateProgress, toProgress } from './progress';
import { NO_CHANGE } from './store';
import { TICKET_CODE_RE } from './tickets';

export async function getProgress(ctx: Ctx): Promise<Response> {
  return json(toProgress(await loadProgress(ctx.svc, ctx.user.id), ctx.svc.now()));
}

export async function postStartMission(ctx: Ctx): Promise<Response> {
  const body = await readJson(ctx.req);
  const mission = getMission(body.missionId);
  const now = ctx.svc.now();
  const { record } = await mutateProgress(ctx, (rec) => (startMission(rec, mission, now) ? undefined : NO_CHANGE));
  return json(toProgress(record, now));
}

export async function postCompleteStep(ctx: Ctx): Promise<Response> {
  const body = await readJson(ctx.req);
  const mission = getMission(body.missionId);
  const step = getStep(mission, body.stepId);
  if (step.type === 'scan') requireQrSecret(ctx.svc.config);
  validateStepInput(
    step,
    { code: typeof body.code === 'string' ? body.code : undefined, answer: body.answer as number | undefined },
    ctx.svc.config.qrSecret ?? '',
  );
  const now = ctx.svc.now();
  const { record } = await mutateProgress(ctx, (rec) => (completeStep(rec, mission, step, now) ? undefined : NO_CHANGE));
  return json(toProgress(record, now));
}

export async function postCompleteMission(ctx: Ctx): Promise<Response> {
  const body = await readJson(ctx.req);
  const mission = getMission(body.missionId);
  const now = ctx.svc.now();
  const { record, result } = await mutateProgress(ctx, (rec) => completeMission(rec, mission, now));
  const res: CompleteMissionResponse = {
    progress: toProgress(record, now),
    pointsAwarded: result?.pointsAwarded ?? 0,
    alreadyCompleted: result?.alreadyCompleted ?? true,
  };
  return json(res);
}

/**
 * Universal scanner: signed venue code → completes that mission step;
 * ticket-shaped code → hands back to the app's ticket claim flow; else unknown.
 */
export async function postScan(ctx: Ctx): Promise<Response> {
  const body = await readJson(ctx.req);
  if (typeof body.payload !== 'string') throw badRequest('`payload` is required', { field: 'payload' });
  const code = normalizeScanPayload(body.payload);
  if (!code) return json({ kind: 'unknown' } satisfies ScanResult);

  const secret = requireQrSecret(ctx.svc.config);
  const slug = verifyCode(code, secret);
  const hit = slug ? findScanStep(slug) : null;
  if (hit) {
    const now = ctx.svc.now();
    const { mission, step } = hit;
    const { record } = await mutateProgress(ctx, (rec) => (completeStep(rec, mission, step, now) ? undefined : NO_CHANGE));
    const res: ScanResult = { kind: 'mission_step', missionId: mission.id, stepId: step.id, progress: toProgress(record, now) };
    return json(res);
  }
  if (TICKET_CODE_RE.test(code)) return json({ kind: 'ticket', code } satisfies ScanResult);
  return json({ kind: 'unknown' } satisfies ScanResult);
}
