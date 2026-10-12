/**
 * The Ritual (onboarding survey): answers are stored on the progress record,
 * mirrored into the analytics namespace (per user) and rolled up into a
 * per-survey aggregate document for the sponsor report. The aggregate is
 * maintained incrementally (−old +new answers) with CAS and can be recomputed
 * from the mirrors at any time.
 */
import type { PersonaResponse, RitualResponse } from '../shared/api';
import { bonusPoints } from '../shared/content/festival';
import { labelFor, ritual, RITUAL_SLUG, validateRitual, type RitualAnswers } from '../shared/content/ritual';
import type { Ctx, Services } from './context';
import { ApiError, badRequest, isPlainObject, json, readJson } from './http';
import { generatePersona } from './persona';
import { award, loadProgress, mutateProgress, toProgress } from './progress';
import { RULES } from './ratelimit';
import { casUpdate } from './store';
import type { RitualAggregate, RitualMirror } from './types';
import { mapLimit } from './util';

const mirrorKey = (userId: string) => `ritual/${userId}`;
const aggregateKey = (slug: string) => `ritual-aggregate/${slug}`;

/** Keeps only known question ids (validateRitual already checked values). */
function canonicalAnswers(raw: Record<string, unknown>): RitualAnswers {
  const out: RitualAnswers = {};
  for (const q of ritual) {
    const v = raw[q.id];
    out[q.id] = Array.isArray(v) ? [...(v as string[])] : (v as string);
  }
  return out;
}

function applyAnswers(agg: RitualAggregate, answers: RitualAnswers, sign: 1 | -1) {
  agg.respondents = Math.max(0, agg.respondents + sign);
  for (const q of ritual) {
    const vals = answers[q.id];
    const list = Array.isArray(vals) ? vals : vals ? [vals] : [];
    const bucket = (agg.counts[q.id] ??= {});
    for (const v of list) bucket[v] = Math.max(0, (bucket[v] ?? 0) + sign);
  }
}

const emptyAggregate = (now: Date): RitualAggregate => ({ slug: RITUAL_SLUG, respondents: 0, counts: {}, updatedAt: now.toISOString() });

/** Updates the per-user mirror and the aggregate (pass `null` to remove a respondent). */
export async function recordRitualAnalytics(svc: Services, userId: string, answers: RitualAnswers | null): Promise<void> {
  const analytics = svc.store.ns('analytics');
  const prev = await analytics.getJSON<RitualMirror>(mirrorKey(userId));
  const now = svc.now();
  if (answers) {
    const mirror: RitualMirror = { slug: RITUAL_SLUG, answers, submittedAt: now.toISOString() };
    await analytics.setJSON(mirrorKey(userId), mirror);
  } else if (prev) {
    await analytics.delete(mirrorKey(userId));
  }
  if (!prev && !answers) return;
  await casUpdate<RitualAggregate>(
    analytics,
    aggregateKey(RITUAL_SLUG),
    (agg) => {
      if (prev && prev.value.slug === RITUAL_SLUG) applyAnswers(agg, prev.value.answers, -1);
      if (answers) applyAnswers(agg, answers, 1);
      agg.updatedAt = now.toISOString();
    },
    { init: () => emptyAggregate(now), retries: 10 },
  );
}

export async function submitRitual(ctx: Ctx): Promise<Response> {
  const { svc } = ctx;
  const body = await readJson(ctx.req);
  if (!isPlainObject(body.answers)) throw badRequest('`answers` must be an object', { field: 'answers' });
  const problem = validateRitual(body.answers as RitualAnswers);
  if (problem) throw badRequest(problem, { field: 'answers' });
  const answers = canonicalAnswers(body.answers);

  // The AI call happens before (never inside) the CAS loop. Always yields a persona.
  const { persona, source } = await generatePersona(svc, answers, ctx.origin);
  const now = svc.now();
  const { record, result } = await mutateProgress(ctx, (rec) => {
    rec.ritual = { completedAt: now.toISOString(), answers };
    rec.persona = persona;
    return award(rec, 'ritual', bonusPoints.ritualComplete, 'Completed The Ritual', now);
  });
  await recordRitualAnalytics(svc, ctx.user.id, answers);
  svc.log.info('ritual.submitted', { userId: ctx.user.id, persona: source, requestId: ctx.requestId });
  const res: RitualResponse = { progress: toProgress(record, now), pointsAwarded: result ?? 0 };
  return json(res);
}

/** POST /api/ai/persona — regenerates the persona from stored answers (no allowance used). */
export async function regeneratePersona(ctx: Ctx): Promise<Response> {
  const { svc, user } = ctx;
  svc.limiter.check(`persona:${user.id}`, RULES.persona);
  const current = await loadProgress(svc, user.id);
  if (!current.ritual) throw new ApiError('NOT_STARTED', 'Complete The Ritual first');
  const answers = current.ritual.answers;
  const { persona } = await generatePersona(svc, answers, ctx.origin);
  const now = svc.now();
  const { record } = await mutateProgress(ctx, (rec) => {
    if (!rec.ritual) throw new ApiError('NOT_STARTED', 'Complete The Ritual first');
    rec.persona = persona;
  });
  const res: PersonaResponse = { persona, progress: toProgress(record, now) };
  return json(res);
}

// ---------------------------------------------------------------------------
// Admin aggregates
// ---------------------------------------------------------------------------

export async function recomputeAggregate(svc: Services): Promise<RitualAggregate> {
  const analytics = svc.store.ns('analytics');
  const keys = (await analytics.listKeys('ritual/')).filter((k) => !k.startsWith('ritual-aggregate/'));
  const now = svc.now();
  const agg = emptyAggregate(now);
  const mirrors = await mapLimit(keys, 16, (k) => analytics.getJSON<RitualMirror>(k));
  for (const m of mirrors) if (m && m.value.slug === RITUAL_SLUG) applyAnswers(agg, m.value.answers, 1);
  await analytics.setJSON(aggregateKey(RITUAL_SLUG), agg);
  return agg;
}

export async function ritualAggregates(ctx: Omit<Ctx, 'user'>): Promise<Response> {
  const { svc } = ctx;
  const recompute = ctx.url.searchParams.get('recompute') === '1';
  const agg = recompute
    ? await recomputeAggregate(svc)
    : ((await svc.store.ns('analytics').getJSON<RitualAggregate>(aggregateKey(RITUAL_SLUG)))?.value ?? emptyAggregate(svc.now()));
  const questions = ritual.map((q) => {
    const counts = agg.counts[q.id] ?? {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      id: q.id,
      prompt: q.prompt,
      kind: q.kind,
      responses: total,
      options: q.options.map((o) => {
        const count = counts[o.value] ?? 0;
        return {
          value: o.value,
          label: labelFor(q.id, o.value),
          count,
          // share of respondents choosing this option (multi-select can exceed 100% in sum)
          percent: agg.respondents ? Math.round((count / agg.respondents) * 1000) / 10 : 0,
        };
      }),
    };
  });
  return json({ slug: agg.slug, respondents: agg.respondents, updatedAt: agg.updatedAt, questions });
}
