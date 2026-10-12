/**
 * Tequila Town API contract — shared by the Netlify backend and the mobile app.
 * All endpoints live under /api, accept/return JSON (except media + SSE), and use
 * `Authorization: Bearer <accessToken>` for authenticated routes.
 */
import type { DrinkCategory } from './content/drinks';
import type { LevelInfo } from './content/festival';
import type { ChatPersona, MemoryStyle } from './content/oracle';
import type { RitualAnswers } from './content/ritual';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'UNDERAGE'
  | 'RATE_LIMITED'
  | 'LIMIT_REACHED'
  | 'LOCKED'
  | 'NOT_STARTED'
  | 'INVALID_CODE'
  | 'WRONG_ANSWER'
  | 'INCOMPLETE_STEPS'
  | 'TICKET_TAKEN'
  | 'AI_UNAVAILABLE'
  | 'AI_REFUSED'
  | 'NOT_CONFIGURED'
  | 'SERVER_ERROR';

export type ApiErrorBody = { error: string; code: ErrorCode; details?: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export type AuthProvider = 'password' | 'apple';

export type User = {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  providers: AuthProvider[];
  showOnLeaderboard: boolean;
  createdAt: string;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  /** epoch ms when the access token expires */
  expiresAt: number;
  user: User;
};

/** ISO date `YYYY-MM-DD`; server re-verifies the guest is 21+. */
export type BirthDate = string;

export type SignupRequest = { email: string; password: string; name: string; birthDate: BirthDate };
export type LoginRequest = { email: string; password: string };
export type AppleAuthRequest = {
  identityToken: string;
  fullName?: { givenName?: string | null; familyName?: string | null } | null;
  birthDate: BirthDate;
};
export type RefreshRequest = { refreshToken: string };
export type ForgotPasswordRequest = { email: string };
export type ResetPasswordRequest = { email: string; code: string; password: string };

export type PublicConfig = {
  passwordReset: boolean;
  appleSignIn: boolean;
  ai: { chat: boolean; memories: boolean; identify: boolean };
};

// ---------------------------------------------------------------------------
// Profile & progress
// ---------------------------------------------------------------------------
export type UpdateMeRequest = {
  name?: string;
  phone?: string | null;
  showOnLeaderboard?: boolean;
  bookmarks?: string[];
};
export type AvatarRequest = { image: string /* base64 JPEG, no data: prefix, <= 1.5MB */ };

export type UserMission = {
  status: 'in_progress' | 'completed';
  completedSteps: string[];
  startedAt: string;
  completedAt: string | null;
};

export type LedgerEntry = { id: string; amount: number; label: string; at: string };

export type TicketInfo = {
  /** short public reference shown on the ticket and encoded in its QR */
  ref: string;
  type: 'general_admission';
  claimedAt: string;
};

export type AgavePersona = {
  title: string;
  archetype: string;
  description: string;
  flavorNotes: string[];
  recommendedDrinkIds: string[];
  mustVisit: string[];
  signatureCocktail: { name: string; ingredients: string[]; method: string };
};

export type AiAllowance = { chat: number; memories: number; identify: number };

export type Progress = {
  points: number;
  level: LevelInfo;
  missions: Record<string, UserMission>;
  ledger: LedgerEntry[];
  ritual: { completedAt: string; answers: RitualAnswers } | null;
  persona: AgavePersona | null;
  bookmarks: string[];
  ticket: TicketInfo | null;
  /** remaining AI uses today */
  ai: AiAllowance;
};

export type MeResponse = { user: User; progress: Progress };

// ---------------------------------------------------------------------------
// Missions, scanning & tickets
// ---------------------------------------------------------------------------
export type StartMissionRequest = { missionId: string };
export type CompleteStepRequest = { missionId: string; stepId: string; code?: string; answer?: number };
export type CompleteMissionRequest = { missionId: string };
export type CompleteMissionResponse = { progress: Progress; pointsAwarded: number; alreadyCompleted: boolean };

export type ScanRequest = { payload: string };
export type ScanResult =
  | { kind: 'mission_step'; missionId: string; stepId: string; progress: Progress }
  | { kind: 'ticket'; code: string }
  | { kind: 'unknown' };

export type ClaimTicketRequest = { code: string };
export type ClaimTicketResponse = {
  status: 'claimed' | 'already_yours';
  pointsAwarded: number;
  progress: Progress;
};

// ---------------------------------------------------------------------------
// Ritual (onboarding survey) & persona
// ---------------------------------------------------------------------------
export type RitualRequest = { answers: RitualAnswers };
export type RitualResponse = { progress: Progress; pointsAwarded: number };
export type PersonaResponse = { persona: AgavePersona; progress: Progress };

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
export type LeaderboardEntry = {
  rank: number;
  name: string;
  avatarUrl: string | null;
  points: number;
  level: number;
  stamps: number;
  isYou: boolean;
};
export type LeaderboardResponse = { entries: LeaderboardEntry[]; you: LeaderboardEntry | null; updatedAt: string };

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------
export type OrderItemInput = { productId: string; qty: number; size?: string };
export type CreateOrderRequest = { items: OrderItemInput[] };
export type Order = {
  id: string;
  pickupCode: string;
  status: 'reserved' | 'picked_up' | 'cancelled';
  items: { productId: string; name: string; qty: number; size?: string; price: number }[];
  total: number;
  createdAt: string;
};
export type OrdersResponse = { orders: Order[] };
export type ShopRequestInput = { productId: string; message?: string };
export type ShopRequestResponse = { ok: true; kind: 'request' | 'waitlist' };

// ---------------------------------------------------------------------------
// Oracle (AI)
// ---------------------------------------------------------------------------
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
/**
 * POST /api/ai/chat → `text/event-stream`. Each event is `data: <json>\n\n` where json is
 * `{ "delta": string }`, then a final `{ "done": true, "remaining": number }`, or `{ "error": string, "code": ErrorCode }`.
 * Assistant text may embed cocktail recipes as `<recipe>{json Recipe}</recipe>` blocks.
 */
export type ChatRequest = { persona: ChatPersona; messages: ChatMessage[] };
export type ChatStreamEvent = { delta: string } | { done: true; remaining: number } | { error: string; code: ErrorCode };
export type Recipe = { name: string; glass?: string; ingredients: string[]; steps: string[]; garnish?: string };

export type CreateMemoryRequest = { image: string /* base64 JPEG */; style: MemoryStyle };
export type Memory = { id: string; style: MemoryStyle; imageUrl: string; shareUrl: string; createdAt: string };
export type MemoriesResponse = { memories: Memory[] };

export type IdentifyRequest = { image: string /* base64 JPEG */ };
export type Identification = {
  isTequila: boolean;
  name: string;
  brand: string;
  category: DrinkCategory | 'mezcal' | 'other';
  confidence: 'high' | 'medium' | 'low';
  description: string;
  tastingNotes: string[];
  servingSuggestion: string;
  pairing: string;
  funFact: string;
  /** id from shared/content/drinks when the bottle is poured at the festival */
  festivalDrinkId: string | null;
};
