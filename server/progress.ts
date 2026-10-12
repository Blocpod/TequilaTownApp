/**
 * The per-user progress record: missions, points ledger, ritual, persona,
 * bookmarks, ticket and daily AI usage — one JSON blob per user, updated with
 * optimistic concurrency (ETag + onlyIfMatch, ≤ 5 attempts).
 */
import type { AiAllowance, LedgerEntry, Progress } from '../shared/api';
import { levelFor } from '../shared/content/festival';
import { aiLimits } from '../shared/content/oracle';
import type { Ctx, Services } from './context';
import { syncLeaderboard } from './leaderboard';
import { casUpdate, NO_CHANGE } from './store';
import type { AiUsage, ProgressRecord } from './types';
import { utcDay } from './util';

export const LEDGER_RESPONSE_CAP = 50;

export function emptyProgress(userId: string, now: Date): ProgressRecord {
  return {
    userId,
    missions: {},
    ledger: [],
    ritual: null,
    persona: null,
    bookmarks: [],
    ticket: null,
    ticketHashes: [],
    usage: { day: utcDay(now), chat: 0, memories: 0, identify: 0 },
    updatedAt: now.toISOString(),
  };
}

export async function loadProgress(svc: Services, userId: string): Promise<ProgressRecord> {
  const res = await svc.store.ns('progress').getJSON<ProgressRecord>(userId);
  return res?.value ?? emptyProgress(userId, svc.now());
}

export const pointsOf = (rec: ProgressRecord) => rec.ledger.reduce((sum, e) => sum + e.amount, 0);
export const stampsOf = (rec: ProgressRecord) => Object.values(rec.missions).filter((m) => m.status === 'completed').length;

/**
 * Adds a ledger entry exactly once (entry ids are deterministic).
 * Returns the points actually awarded (0 when already present).
 */
export function award(rec: ProgressRecord, id: string, amount: number, label: string, now: Date): number {
  if (rec.ledger.some((e) => e.id === id)) return 0;
  rec.ledger.push({ id, amount, label, at: now.toISOString() });
  return amount;
}

/** Usage counters for the current UTC day (resets lazily at midnight UTC). */
export function currentUsage(rec: ProgressRecord, now: Date): AiUsage {
  const day = utcDay(now);
  return rec.usage && rec.usage.day === day ? rec.usage : { day, chat: 0, memories: 0, identify: 0 };
}

export function aiRemaining(rec: ProgressRecord, now: Date): AiAllowance {
  const u = currentUsage(rec, now);
  return {
    chat: Math.max(0, aiLimits.chatMessages - u.chat),
    memories: Math.max(0, aiLimits.memories - u.memories),
    identify: Math.max(0, aiLimits.identifications - u.identify),
  };
}

export function toProgress(rec: ProgressRecord, now: Date): Progress {
  const points = pointsOf(rec);
  const ledger: LedgerEntry[] = rec.ledger.slice(-LEDGER_RESPONSE_CAP).reverse();
  return {
    points,
    level: levelFor(points),
    missions: structuredClone(rec.missions),
    ledger,
    ritual: rec.ritual ? structuredClone(rec.ritual) : null,
    persona: rec.persona ? structuredClone(rec.persona) : null,
    bookmarks: [...rec.bookmarks],
    ticket: rec.ticket ? { ...rec.ticket } : null,
    ai: aiRemaining(rec, now),
  };
}

/** Low-level CAS on the progress record (creates it on first write). */
export async function updateProgress<R>(
  svc: Services,
  userId: string,
  mutate: (rec: ProgressRecord) => R | typeof NO_CHANGE | Promise<R | typeof NO_CHANGE>,
): Promise<{ record: ProgressRecord; result: R | undefined; changed: boolean }> {
  const now = svc.now();
  const { value, result, changed } = await casUpdate<ProgressRecord, R>(
    svc.store.ns('progress'),
    userId,
    async (rec) => {
      const snapshot = JSON.stringify(rec);
      const r = await mutate(rec);
      // Only stamp real changes, so idempotent calls stay write-free.
      if (r !== NO_CHANGE && JSON.stringify(rec) !== snapshot) rec.updatedAt = now.toISOString();
      return r;
    },
    { init: () => emptyProgress(userId, now) },
  );
  return { record: value, result, changed };
}

/**
 * Request-level progress mutation: runs the CAS update for the signed-in user and,
 * when points or stamps moved, refreshes their leaderboard entry after the response.
 */
export async function mutateProgress<R>(
  ctx: Ctx,
  mutate: (rec: ProgressRecord) => R | typeof NO_CHANGE | Promise<R | typeof NO_CHANGE>,
): Promise<{ record: ProgressRecord; result: R | undefined }> {
  let before: { points: number; stamps: number } | null = null;
  const out = await updateProgress(ctx.svc, ctx.user.id, (rec) => {
    before = { points: pointsOf(rec), stamps: stampsOf(rec) };
    return mutate(rec);
  });
  const b = before as { points: number; stamps: number } | null;
  if (out.changed && b && (b.points !== pointsOf(out.record) || b.stamps !== stampsOf(out.record))) {
    const userId = ctx.user.id;
    ctx.defer(() => syncLeaderboard(ctx.svc, userId), 'leaderboard.sync');
  }
  return { record: out.record, result: out.result };
}
