/**
 * createApp(deps) → { fetch(req) } — the whole /api surface as a plain
 * WHATWG fetch handler: routing, CORS, auth/admin guards, error mapping.
 * Netlify wiring lives in netlify/functions/api.mts; tests call it in-process.
 */
import { randomUUID } from 'node:crypto';
import type { PublicConfig } from '../shared/api';
import { deleteAccount, getMe, patchMe, putAvatar } from './account';
import { chat } from './ai/chat';
import { identify } from './ai/identify';
import { createMemory, deleteMemory, listMemories } from './ai/memory';
import {
  appleSignIn,
  assertAdmin,
  authenticate,
  forgotPassword,
  login,
  logout,
  refresh,
  resetPassword,
  signup,
  verifyAppleIdentityToken,
} from './auth';
import { passwordResetEnabled } from './config';
import { consoleLogger, type Ctx, type Deps, type Services } from './context';
import { ApiError, CORS_HEADERS, clientIp, errorResponse, json, withHeaders } from './http';
import { getLeaderboard, rebuildLeaderboard } from './leaderboard';
import { serveMedia } from './media';
import { getProgress, postCompleteMission, postCompleteStep, postScan, postStartMission } from './passport';
import { RateLimiter, RULES } from './ratelimit';
import { regeneratePersona, ritualAggregates, submitRitual } from './ritual';
import { adminGetPickup, adminListShopRequests, adminMarkPickedUp, cancelOrder, createOrder, createShopRequest, listOrders } from './shop';
import { claimTicket } from './tickets';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Access = 'public' | 'user' | 'admin';
type Handler = (ctx: Ctx) => Promise<Response>;
type Route = { method: Method; pattern: RegExp; keys: string[]; access: Access; handler: Handler };

export type FetchOptions = {
  /** Netlify `context.waitUntil` — background work after the response. */
  waitUntil?: (p: Promise<unknown>) => void;
  ip?: string;
  requestId?: string;
};

export type App = { fetch(req: Request, opts?: FetchOptions): Promise<Response>; services: Services };

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const src = path.replace(/:([a-zA-Z]+)/g, (_, k: string) => {
    keys.push(k);
    return '([^/]+)';
  });
  return { pattern: new RegExp(`^${src}$`), keys };
}

export function createApp(deps: Deps): App {
  const svc: Services = {
    store: deps.store,
    config: deps.config,
    fetch: deps.fetch ?? ((input, init) => fetch(input, init)),
    now: deps.now ?? (() => new Date()),
    log: deps.logger ?? consoleLogger,
    verifyAppleToken: deps.verifyAppleToken ?? verifyAppleIdentityToken,
    purgeCache: deps.purgeCache ?? (async () => undefined),
    limiter: new RateLimiter(() => (deps.now ? deps.now().getTime() : Date.now())),
  };
  const cfg = svc.config;

  const routes: Route[] = [];
  const add = (method: Method, path: string, access: Access, handler: Handler) =>
    routes.push({ method, ...compile(path), access, handler });

  // --- public -------------------------------------------------------------
  add('GET', '/api/health', 'public', async () =>
    json({
      ok: true,
      configured: {
        jwt: Boolean(cfg.jwtSecret) && !cfg.jwtSecretIsDev,
        qr: Boolean(cfg.qrSecret) && !cfg.qrSecretIsDev,
        openrouter: Boolean(cfg.openrouterKey),
        resend: passwordResetEnabled(cfg),
        apple: cfg.appleSignIn && cfg.appleBundleIds.length > 0,
      },
    }),
  );
  add('GET', '/api/config', 'public', async () => {
    const ai = Boolean(cfg.openrouterKey);
    const body: PublicConfig = {
      passwordReset: passwordResetEnabled(cfg),
      appleSignIn: cfg.appleSignIn && cfg.appleBundleIds.length > 0,
      ai: { chat: ai, memories: ai, identify: ai },
    };
    return json(body, 200, { 'cache-control': 'public, max-age=60' });
  });
  add('GET', '/api/media/:kind/:id', 'public', serveMedia);

  // --- auth ---------------------------------------------------------------
  add('POST', '/api/auth/signup', 'public', signup);
  add('POST', '/api/auth/login', 'public', login);
  add('POST', '/api/auth/apple', 'public', appleSignIn);
  add('POST', '/api/auth/refresh', 'public', refresh);
  add('POST', '/api/auth/logout', 'public', logout);
  add('POST', '/api/auth/password/forgot', 'public', forgotPassword);
  add('POST', '/api/auth/password/reset', 'public', resetPassword);

  // --- me -----------------------------------------------------------------
  add('GET', '/api/me', 'user', getMe);
  add('PATCH', '/api/me', 'user', patchMe);
  add('PUT', '/api/me/avatar', 'user', putAvatar);
  add('DELETE', '/api/me', 'user', deleteAccount);

  // --- passport -----------------------------------------------------------
  add('GET', '/api/progress', 'user', getProgress);
  add('POST', '/api/missions/start', 'user', postStartMission);
  add('POST', '/api/missions/step', 'user', postCompleteStep);
  add('POST', '/api/missions/complete', 'user', postCompleteMission);
  add('POST', '/api/scan', 'user', postScan);
  add('POST', '/api/tickets/claim', 'user', claimTicket);
  add('POST', '/api/ritual', 'user', submitRitual);
  add('GET', '/api/leaderboard', 'user', async (ctx) => json(await getLeaderboard(ctx)));

  // --- shop ---------------------------------------------------------------
  add('POST', '/api/shop/orders', 'user', createOrder);
  add('GET', '/api/shop/orders', 'user', listOrders);
  add('DELETE', '/api/shop/orders/:id', 'user', cancelOrder);
  add('POST', '/api/shop/requests', 'user', createShopRequest);

  // --- oracle -------------------------------------------------------------
  add('POST', '/api/ai/chat', 'user', chat);
  add('POST', '/api/ai/memories', 'user', createMemory);
  add('GET', '/api/ai/memories', 'user', listMemories);
  add('DELETE', '/api/ai/memories/:id', 'user', deleteMemory);
  add('POST', '/api/ai/identify', 'user', identify);
  add('POST', '/api/ai/persona', 'user', regeneratePersona);

  // --- admin (x-admin-key) ------------------------------------------------
  add('GET', '/api/admin/ritual-aggregates', 'admin', ritualAggregates);
  add('GET', '/api/admin/pickup/:code', 'admin', adminGetPickup);
  add('POST', '/api/admin/pickup/:code/picked-up', 'admin', adminMarkPickedUp);
  add('GET', '/api/admin/shop/requests', 'admin', adminListShopRequests);
  add('POST', '/api/admin/leaderboard/rebuild', 'admin', async (ctx) => json(await rebuildLeaderboard(ctx.svc)));

  async function handle(req: Request, opts: FetchOptions): Promise<Response> {
    const url = new URL(req.url);
    const requestId = opts.requestId ?? req.headers.get('x-nf-request-id') ?? randomUUID();
    const baseHeaders = { ...CORS_HEADERS, 'x-request-id': requestId, 'x-content-type-options': 'nosniff' };

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: baseHeaders });

    let path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    // netlify-cli's dev proxy answers a function's 403/404 by re-requesting
    // <path>.html, <path>.htm, <path>/index.html and <path>/index.htm (static-file
    // emulation, same body) and returns the LAST response. Map those back so local
    // dev sees the real error (every 403/404 path in this API is side-effect free).
    // Never active when deployed: the CDN returns function responses as-is.
    if (cfg.netlifyDev) path = path.replace(/(?:\/index\.html?|\.html?)$/, '');
    const method = req.method === 'HEAD' ? 'GET' : req.method;
    let match: { route: Route; params: Record<string, string> } | null = null;
    const allowed = new Set<string>();
    for (const route of routes) {
      const m = route.pattern.exec(path);
      if (!m) continue;
      allowed.add(route.method);
      if (route.method !== method) continue;
      const params: Record<string, string> = {};
      try {
        route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      } catch {
        return withHeaders(errorResponse(new ApiError('NOT_FOUND', 'Not found')), baseHeaders);
      }
      match = { route, params };
      break;
    }
    if (!match) {
      const err = allowed.size
        ? new ApiError('BAD_REQUEST', `Method ${req.method} not allowed`, { status: 405, headers: { allow: [...allowed, 'OPTIONS'].join(', ') } })
        : new ApiError('NOT_FOUND', 'Not found');
      return withHeaders(errorResponse(err), baseHeaders);
    }

    const pending: Promise<unknown>[] = [];
    const ctx: Ctx = {
      svc,
      req,
      url,
      params: match.params,
      origin: cfg.publicBaseUrl ?? url.origin,
      ip: clientIp(req, opts.ip),
      requestId,
      defer(task, label) {
        const p = (async () => {
          try {
            await task();
          } catch (e) {
            svc.log.error('deferred_task_failed', { label, requestId, error: e instanceof Error ? e.message : String(e) });
          }
        })();
        if (opts.waitUntil) opts.waitUntil(p);
        else pending.push(p);
      },
      user: undefined as never,
    };

    let res: Response;
    try {
      if (match.route.access === 'user') {
        ctx.user = await authenticate(svc, req);
        svc.limiter.check(`user:${ctx.user.id}`, RULES.user);
      } else if (match.route.access === 'admin') {
        assertAdmin(req, cfg.adminKey);
      }
      res = await match.route.handler(ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status >= 500) svc.log.error('api_error', { code: e.code, msg: e.message, method, path, requestId, userId: ctx.user?.id });
        res = errorResponse(e);
      } else {
        svc.log.error('unhandled_error', {
          method,
          path,
          requestId,
          userId: ctx.user?.id,
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        });
        res = errorResponse(new ApiError('SERVER_ERROR', 'Something went wrong. Please try again'));
      }
    }
    // Without waitUntil (tests, local scripts) background work completes before returning.
    if (pending.length) await Promise.allSettled(pending);
    if (req.method === 'HEAD') res = new Response(null, { status: res.status, headers: res.headers });
    return withHeaders(res, baseHeaders);
  }

  return {
    services: svc,
    fetch: (req, opts = {}) => handle(req, opts),
  };
}
