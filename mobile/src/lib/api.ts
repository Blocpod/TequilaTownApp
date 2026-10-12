import { fetch as expoFetch } from 'expo/fetch';
import type {
  ApiErrorBody,
  AppleAuthRequest,
  AvatarRequest,
  ChatRequest,
  ChatStreamEvent,
  ClaimTicketResponse,
  CompleteMissionResponse,
  CompleteStepRequest,
  CreateMemoryRequest,
  CreateOrderRequest,
  ErrorCode,
  Identification,
  LeaderboardResponse,
  LoginRequest,
  MeResponse,
  MemoriesResponse,
  Memory,
  Order,
  OrdersResponse,
  PersonaResponse,
  Progress,
  PublicConfig,
  ResetPasswordRequest,
  RitualRequest,
  RitualResponse,
  ScanResult,
  Session,
  ShopRequestInput,
  ShopRequestResponse,
  SignupRequest,
  UpdateMeRequest,
} from '@shared/api';

import { API_URL } from './config';

export type ClientErrorCode = ErrorCode | 'NETWORK' | 'TIMEOUT';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ClientErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** Human copy for errors, tuned for the festival floor (spotty signal, quick fixes). */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!isApiError(e)) return fallback;
  switch (e.code) {
    case 'NETWORK':
      return "Can't reach Tequila Town right now. Check your connection and try again.";
    case 'TIMEOUT':
      return 'That took too long. Please try again.';
    case 'RATE_LIMITED':
      return 'Easy, amigo. Too many tries, give it a moment.';
    default:
      return e.message || fallback;
  }
}

// ---------------------------------------------------------------------------
// Session plumbing (registered by the session store to avoid an import cycle)
// ---------------------------------------------------------------------------
type AuthHooks = {
  getSession: () => Session | null;
  onSession: (s: Session) => void;
  onSignedOut: () => void;
};
let hooks: AuthHooks = { getSession: () => null, onSession: () => {}, onSignedOut: () => {} };
export function configureAuth(h: AuthHooks) {
  hooks = h;
}

let refreshing: Promise<Session> | null = null;
async function refreshSession(): Promise<Session> {
  const current = hooks.getSession();
  if (!current) throw new ApiError('Not signed in', 401, 'UNAUTHORIZED');
  refreshing ??= (async () => {
    try {
      const next = await raw<Session>('/api/auth/refresh', { method: 'POST', body: { refreshToken: current.refreshToken } });
      hooks.onSession(next);
      return next;
    } catch (e) {
      if (isApiError(e) && (e.status === 401 || e.status === 403)) hooks.onSignedOut();
      throw e;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function validToken(): Promise<string | null> {
  let session = hooks.getSession();
  if (!session) return null;
  if (session.expiresAt - Date.now() < 60_000) session = await refreshSession();
  return session.accessToken;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------
type RequestOptions = { method?: string; body?: unknown; token?: string | null; timeoutMs?: number; signal?: AbortSignal };

async function toError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    /* non-JSON error */
  }
  // Netlify's edge rate limiter answers a bare 429 with no JSON body.
  const fallback: ErrorCode = res.status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR';
  return new ApiError(body?.error ?? `Request failed (${res.status})`, res.status, (body?.code as ErrorCode) ?? fallback, body?.details);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function raw<T>(path: string, opts: RequestOptions = {}, attempt = 0): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = 20_000, signal } = opts;
  if (!API_URL) throw new ApiError('API URL is not configured', 0, 'NETWORK');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort());
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted && !signal?.aborted) throw new ApiError('Request timed out', 0, 'TIMEOUT');
    throw new ApiError('Network request failed', 0, 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
  // Two writes raced on the same passport: the server asks us to retry shortly.
  if (res.status === 409 && res.headers.get('retry-after') && attempt < 2) {
    await sleep(Math.min(2, Number(res.headers.get('retry-after')) || 1) * 1000 + attempt * 250);
    return raw<T>(path, opts, attempt + 1);
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Authenticated request with one transparent refresh-and-retry on any 401 (expired *or* rotated
 * signing key — refresh tokens survive both). If the refresh itself is rejected, the session ends.
 */
async function authed<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = await validToken();
  try {
    return await raw<T>(path, { ...opts, token });
  } catch (e) {
    if (isApiError(e) && e.status === 401 && hooks.getSession()) {
      const next = await refreshSession();
      return raw<T>(path, { ...opts, token: next.accessToken });
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------
export const api = {
  config: () => raw<PublicConfig>('/api/config'),

  signup: (body: SignupRequest) => raw<Session>('/api/auth/signup', { method: 'POST', body }),
  login: (body: LoginRequest) => raw<Session>('/api/auth/login', { method: 'POST', body }),
  apple: (body: AppleAuthRequest) => raw<Session>('/api/auth/apple', { method: 'POST', body }),
  logout: (refreshToken: string) => raw<{ ok: true }>('/api/auth/logout', { method: 'POST', body: { refreshToken } }),
  forgotPassword: (email: string) => raw<{ ok: true }>('/api/auth/password/forgot', { method: 'POST', body: { email } }),
  resetPassword: (body: ResetPasswordRequest) => raw<Session>('/api/auth/password/reset', { method: 'POST', body }),

  me: () => authed<MeResponse>('/api/me'),
  updateMe: (body: UpdateMeRequest) => authed<MeResponse>('/api/me', { method: 'PATCH', body }),
  uploadAvatar: (body: AvatarRequest) => authed<MeResponse>('/api/me/avatar', { method: 'PUT', body, timeoutMs: 45_000 }),
  deleteAccount: () => authed<{ ok: true }>('/api/me', { method: 'DELETE' }),

  progress: () => authed<Progress>('/api/progress'),
  startMission: (missionId: string) => authed<Progress>('/api/missions/start', { method: 'POST', body: { missionId } }),
  completeStep: (body: CompleteStepRequest) => authed<Progress>('/api/missions/step', { method: 'POST', body }),
  completeMission: (missionId: string) => authed<CompleteMissionResponse>('/api/missions/complete', { method: 'POST', body: { missionId } }),
  scan: (payload: string) => authed<ScanResult>('/api/scan', { method: 'POST', body: { payload } }),
  claimTicket: (code: string) => authed<ClaimTicketResponse>('/api/tickets/claim', { method: 'POST', body: { code } }),

  submitRitual: (body: RitualRequest) => authed<RitualResponse>('/api/ritual', { method: 'POST', body, timeoutMs: 60_000 }),
  regeneratePersona: () => authed<PersonaResponse>('/api/ai/persona', { method: 'POST', timeoutMs: 60_000 }),

  leaderboard: () => authed<LeaderboardResponse>('/api/leaderboard'),

  orders: () => authed<OrdersResponse>('/api/shop/orders'),
  createOrder: (body: CreateOrderRequest) => authed<Order>('/api/shop/orders', { method: 'POST', body }),
  cancelOrder: (id: string) => authed<Order>(`/api/shop/orders/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  shopRequest: (body: ShopRequestInput) => authed<ShopRequestResponse>('/api/shop/requests', { method: 'POST', body }),

  memories: () => authed<MemoriesResponse>('/api/ai/memories'),
  createMemory: (body: CreateMemoryRequest) => authed<Memory>('/api/ai/memories', { method: 'POST', body, timeoutMs: 75_000 }),
  deleteMemory: (id: string) => authed<{ ok: true }>(`/api/ai/memories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  identify: (image: string) => authed<Identification>('/api/ai/identify', { method: 'POST', body: { image }, timeoutMs: 60_000 }),
};

// ---------------------------------------------------------------------------
// Oracle chat — Server-Sent Events over a streaming fetch
// ---------------------------------------------------------------------------
const NEWLINE = 10;

/**
 * Streams `/api/ai/chat`. Events are split on blank lines at the *byte* level so multi-byte
 * characters (ñ, á, emoji) split across network chunks always decode correctly.
 */
export async function streamChat(
  req: ChatRequest,
  onEvent: (e: ChatStreamEvent) => void,
  signal?: AbortSignal,
  retried = false,
): Promise<void> {
  const token = await validToken();
  let res: Response;
  try {
    res = (await expoFetch(`${API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(req),
      signal,
    })) as unknown as Response;
  } catch {
    if (signal?.aborted) return;
    throw new ApiError('Network request failed', 0, 'NETWORK');
  }
  if (res.status === 401 && hooks.getSession() && !retried) {
    await refreshSession();
    return streamChat(req, onEvent, signal, true);
  }
  if (!res.ok) throw await toError(res);
  if (!res.body) throw new ApiError('Streaming not supported', 0, 'NETWORK');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = new Uint8Array(0);

  const flushEvent = (bytes: Uint8Array) => {
    const text = decoder.decode(bytes);
    for (const line of text.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      let event: ChatStreamEvent;
      try {
        event = JSON.parse(json) as ChatStreamEvent;
      } catch {
        continue; // ignore malformed keep-alives
      }
      onEvent(event); // outside the try: callback errors (e.g. server error events) must propagate
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      const merged = new Uint8Array(buffer.length + value.length);
      merged.set(buffer);
      merged.set(value, buffer.length);
      buffer = merged;
      let start = 0;
      for (let i = 1; i < buffer.length; i++) {
        if (buffer[i] === NEWLINE && buffer[i - 1] === NEWLINE) {
          flushEvent(buffer.subarray(start, i - 1));
          start = i + 1;
        }
      }
      buffer = buffer.slice(start);
    }
    if (buffer.length) flushEvent(buffer);
  } catch (e) {
    if (signal?.aborted) return;
    throw isApiError(e) ? e : new ApiError('Connection lost', 0, 'NETWORK');
  }
}
