/**
 * Leaderboard: a single `scores` JSON map (userId → ScoreEntry) maintained with
 * CAS whenever a user's points, stamps, name, avatar or visibility change.
 *
 * Entries are derived from the user + progress records (`syncLeaderboard` always
 * converges to the source of truth), so a lost update is repaired by the next
 * change or by POST /api/admin/leaderboard/rebuild.
 */
import type { LeaderboardEntry, LeaderboardResponse } from '../shared/api';
import { levelFor } from '../shared/content/festival';
import { mediaUrl, type Ctx, type Services } from './context';
import { loadProgress, pointsOf, stampsOf } from './progress';
import { casUpdate, NO_CHANGE, type Store } from './store';
import type { ProgressRecord, ScoreEntry, ScoresDoc, UserRecord } from './types';
import { displayName, getUser } from './users';
import { mapLimit } from './util';

const SCORES_KEY = 'scores';
export const LEADERBOARD_SIZE = 50;
const CACHE_MS = 5_000;

/** Per-instance read cache; refreshed on every local write. */
const cache = new WeakMap<Store, { doc: ScoresDoc; at: number }>();

const emptyDoc = (now: Date): ScoresDoc => ({ updatedAt: now.toISOString(), entries: {} });

export function scoreEntryFor(user: UserRecord, rec: ProgressRecord | null): ScoreEntry {
  const points = rec ? pointsOf(rec) : 0;
  const lastAward = rec?.ledger[rec.ledger.length - 1]?.at;
  return {
    name: displayName(user.name),
    avatarId: user.avatar?.id ?? null,
    points,
    level: levelFor(points).level,
    stamps: rec ? stampsOf(rec) : 0,
    show: user.showOnLeaderboard,
    at: lastAward ?? user.createdAt,
  };
}

async function writeEntry(svc: Services, userId: string, entry: ScoreEntry | null): Promise<void> {
  const now = svc.now();
  const { value, changed } = await casUpdate<ScoresDoc>(
    svc.store.ns('leaderboard'),
    SCORES_KEY,
    (doc) => {
      const prev = doc.entries[userId];
      if (!entry) {
        if (!prev) return NO_CHANGE;
        delete doc.entries[userId];
      } else {
        if (prev && JSON.stringify(prev) === JSON.stringify(entry)) return NO_CHANGE;
        doc.entries[userId] = entry;
      }
      doc.updatedAt = now.toISOString();
    },
    // One hot document: allow more attempts than per-user records.
    { init: () => emptyDoc(now), retries: 10 },
  );
  if (changed) cache.set(svc.store, { doc: value, at: Date.now() });
}

/** Recomputes a user's entry from their records (removes it if the user is gone). */
export async function syncLeaderboard(svc: Services, userId: string): Promise<void> {
  const user = await getUser(svc, userId);
  if (!user) return writeEntry(svc, userId, null);
  const rec = await svc.store.ns('progress').getJSON<ProgressRecord>(userId);
  await writeEntry(svc, userId, scoreEntryFor(user, rec?.value ?? null));
}

export const removeFromLeaderboard = (svc: Services, userId: string) => writeEntry(svc, userId, null);

async function readScores(svc: Services): Promise<ScoresDoc> {
  const hit = cache.get(svc.store);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.doc;
  const res = await svc.store.ns('leaderboard').getJSON<ScoresDoc>(SCORES_KEY);
  const doc = res?.value ?? emptyDoc(svc.now());
  cache.set(svc.store, { doc, at: Date.now() });
  return doc;
}

/** Higher points first; ties go to whoever got there first. */
function compare(a: [string, ScoreEntry], b: [string, ScoreEntry]): number {
  if (b[1].points !== a[1].points) return b[1].points - a[1].points;
  if (a[1].at !== b[1].at) return a[1].at < b[1].at ? -1 : 1;
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}

export async function getLeaderboard(ctx: Ctx): Promise<LeaderboardResponse> {
  const { svc, user } = ctx;
  const [doc, rec] = await Promise.all([readScores(svc), loadProgress(svc, user.id)]);
  // The caller's own entry is always computed fresh from their records.
  const mine = scoreEntryFor(user, rec);

  const ranked = Object.entries(doc.entries).filter(([id, e]) => id !== user.id && e.show && e.points > 0);
  if (mine.show && mine.points > 0) ranked.push([user.id, mine]);
  ranked.sort(compare);

  const toEntry = ([id, e]: [string, ScoreEntry], rank: number): LeaderboardEntry => ({
    rank,
    name: e.name,
    avatarUrl: e.avatarId ? mediaUrl(ctx.origin, 'avatars', e.avatarId) : null,
    points: e.points,
    level: e.level,
    stamps: e.stamps,
    isYou: id === user.id,
  });

  const entries = ranked.slice(0, LEADERBOARD_SIZE).map((row, i) => toEntry(row, i + 1));
  // True rank, even when outside the top 50 or hidden from the public board.
  const ahead = ranked.filter((row) => row[0] !== user.id && compare(row, [user.id, mine]) < 0).length;
  const you = toEntry([user.id, mine], ahead + 1);

  return { entries, you, updatedAt: doc.updatedAt };
}

/** Admin: rebuild the whole map from user + progress records. */
export async function rebuildLeaderboard(svc: Services): Promise<{ users: number }> {
  const ids = await svc.store.ns('users').listKeys();
  const entries: Record<string, ScoreEntry> = {};
  await mapLimit(ids, 8, async (id) => {
    const user = await getUser(svc, id);
    if (!user) return;
    const rec = await svc.store.ns('progress').getJSON<ProgressRecord>(id);
    entries[id] = scoreEntryFor(user, rec?.value ?? null);
  });
  const now = svc.now();
  const { value } = await casUpdate<ScoresDoc>(
    svc.store.ns('leaderboard'),
    SCORES_KEY,
    (doc) => {
      doc.entries = entries;
      doc.updatedAt = now.toISOString();
    },
    { init: () => emptyDoc(now), retries: 10 },
  );
  cache.set(svc.store, { doc: value, at: Date.now() });
  return { users: Object.keys(entries).length };
}
