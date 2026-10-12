/**
 * Daily AI allowances (UTC day), stored on the progress record.
 * A use is *reserved* atomically before calling the model and *refunded* if the
 * call fails, so only successful uses count and parallel requests can't overshoot.
 */
import { aiLimits } from '../../shared/content/oracle';
import { OpenRouterClient } from './openrouter';
import type { Ctx, Services } from '../context';
import { ApiError } from '../http';
import { currentUsage, updateProgress } from '../progress';
import { NO_CHANGE } from '../store';

export type AiKind = 'chat' | 'memories' | 'identify';

export const AI_LIMITS: Record<AiKind, number> = {
  chat: aiLimits.chatMessages,
  memories: aiLimits.memories,
  identify: aiLimits.identifications,
};

const LABELS: Record<AiKind, string> = {
  chat: 'chat messages',
  memories: 'memories',
  identify: 'bottle scans',
};

export type Reservation = { kind: AiKind; day: string; remaining: number };

function nextUtcMidnight(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

export async function reserveAi(ctx: Ctx, kind: AiKind): Promise<Reservation> {
  const now = ctx.svc.now();
  const limit = AI_LIMITS[kind];
  const { result } = await updateProgress(ctx.svc, ctx.user.id, (rec) => {
    const u = currentUsage(rec, now);
    if (u[kind] >= limit) {
      throw new ApiError('LIMIT_REACHED', `You've used all ${limit} of today's ${LABELS[kind]}. The Oracle refills at midnight UTC`, {
        details: { kind, limit, resetsAt: nextUtcMidnight(now) },
      });
    }
    rec.usage = { ...u, [kind]: u[kind] + 1 };
    return { kind, day: u.day, remaining: limit - rec.usage[kind] } satisfies Reservation;
  });
  return result!;
}

export async function refundAi(svc: Services, userId: string, r: Reservation): Promise<void> {
  try {
    await updateProgress(svc, userId, (rec) => {
      if (!rec.usage || rec.usage.day !== r.day || rec.usage[r.kind] <= 0) return NO_CHANGE;
      rec.usage = { ...rec.usage, [r.kind]: rec.usage[r.kind] - 1 };
    });
  } catch (e) {
    svc.log.error('ai.refund_failed', { userId, kind: r.kind, error: e instanceof Error ? e.message : String(e) });
  }
}

export function aiClient(svc: Services, origin: string): OpenRouterClient | null {
  if (!svc.config.openrouterKey) return null;
  return new OpenRouterClient({
    apiKey: svc.config.openrouterKey,
    fetch: svc.fetch,
    referer: origin,
    title: 'Tequila Town',
    baseUrl: svc.config.openrouterBaseUrl ?? undefined,
  });
}

export function requireAiClient(ctx: Ctx): OpenRouterClient {
  const client = aiClient(ctx.svc, ctx.origin);
  if (!client) throw new ApiError('NOT_CONFIGURED', 'The Oracle is not configured on this server');
  return client;
}
