/**
 * The Tequila Town API — every /api/* route is served by this single function
 * (one warm pool, shared caches). All logic lives in server/; this file only wires
 * Netlify primitives (Blobs, waitUntil, CDN purge) into createApp().
 */
import { getStore } from '@netlify/blobs';
import { purgeCache, type Config, type Context } from '@netlify/functions';
import { createApp } from '../../server/app';
import { loadConfig } from '../../server/config';
import { BlobsStore } from '../../server/store';

const app = createApp({
  store: new BlobsStore({ getStore }),
  config: loadConfig(),
  purgeCache: (tags) => purgeCache({ tags }),
});

export default async (req: Request, context: Context): Promise<Response> =>
  app.fetch(req, {
    waitUntil: typeof context?.waitUntil === 'function' ? (p) => context.waitUntil(p) : undefined,
    ip: context?.ip,
    requestId: context?.requestId,
  });

export const config: Config = {
  path: '/api/*',
  // Platform-level abuse backstop per client IP. Kept generous on purpose: festival
  // guests share venue Wi-Fi / carrier NAT addresses. Per-user limits live in-app.
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: ['ip', 'domain'],
    windowSize: 60,
    windowLimit: 1200,
  },
};
