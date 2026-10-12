/**
 * Persisted record shapes (what lives in Blobs). API shapes live in shared/api.ts;
 * these are the server-private superset.
 *
 * Blobs layout (store `tt-<namespace>`, all strongly consistent):
 *   users        <userId>                          UserRecord
 *   indexes      email/<sha256(email)>             { userId }      (onlyIfNew → uniqueness)
 *                apple/<appleSub>                  { userId }
 *   tokens       refresh/<sha256(token)>           RefreshRecord
 *                reset/<sha256(email)>             ResetRecord
 *                loginfail/<sha256(email)>         { count, windowStart }
 *   progress     <userId>                          ProgressRecord
 *   tickets      <sha256(code)>                    TicketRecord    (onlyIfNew → single owner)
 *   media        avatars/<id> | memories/<id>      bytes + metadata { userId, contentType, ... }
 *   memories     <userId>                          { items: MemoryRecord[] }
 *   shop         orders/<userId>                   { orders: OrderRecord[] }
 *                pickup/<CODE>                     { userId, orderId }   (onlyIfNew → unique code)
 *                requests/<userId>/<productId>     ShopRequestRecord
 *   leaderboard  scores                            ScoresDoc
 *   analytics    ritual/<userId>                   RitualMirror
 *                ritual-aggregate/<slug>           RitualAggregate
 */
import type { AgavePersona, AuthProvider, LedgerEntry, Order, TicketInfo, UserMission } from '../shared/api';
import type { MemoryStyle } from '../shared/content/oracle';
import type { RitualAnswers } from '../shared/content/ritual';

export type UserRecord = {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
  avatar: { id: string; contentType: string } | null;
  providers: AuthProvider[];
  appleSub: string | null;
  passwordHash: string | null;
  showOnLeaderboard: boolean;
  createdAt: string;
  /** When the 21+ check passed. The birth date itself is never stored. */
  ageVerifiedAt: string;
  /** Bumped on password reset → invalidates every outstanding access token. */
  sessionVersion: number;
  /** sha256 hashes of active refresh tokens, oldest first (cap 10). */
  refreshHashes: string[];
};

export type RefreshRecord = { userId: string; expiresAt: number; createdAt: number };
export type ResetRecord = { userId: string; codeHash: string; expiresAt: number; attempts: number; sentAt: number };

export type AiUsage = { day: string; chat: number; memories: number; identify: number };

export type ProgressRecord = {
  userId: string;
  missions: Record<string, UserMission>;
  /** Every award ever, oldest first. Entry ids are deterministic (`mission:<id>`, `ticket`, `ritual`) → exactly-once. */
  ledger: LedgerEntry[];
  ritual: { completedAt: string; answers: RitualAnswers } | null;
  persona: AgavePersona | null;
  bookmarks: string[];
  ticket: TicketInfo | null;
  /** sha256 of every ticket code this user claimed (so account deletion can release them). */
  ticketHashes: string[];
  usage: AiUsage;
  updatedAt: string;
};

export type TicketRecord = { userId: string; ref: string; type: 'general_admission'; claimedAt: string };

export type MemoryRecord = { id: string; style: MemoryStyle; contentType: string; createdAt: string };

export type OrderRecord = Order & { userId: string; updatedAt: string; pickedUpAt?: string; cancelledAt?: string };

export type ShopRequestRecord = {
  userId: string;
  productId: string;
  kind: 'request' | 'waitlist';
  message: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScoreEntry = {
  /** Privacy-safe display name ("First L."). */
  name: string;
  avatarId: string | null;
  points: number;
  level: number;
  stamps: number;
  show: boolean;
  /** When the current point total was reached — earlier wins ties. */
  at: string;
};
export type ScoresDoc = { updatedAt: string; entries: Record<string, ScoreEntry> };

export type RitualMirror = { slug: string; answers: RitualAnswers; submittedAt: string };
export type RitualAggregate = {
  slug: string;
  respondents: number;
  counts: Record<string, Record<string, number>>;
  updatedAt: string;
};
