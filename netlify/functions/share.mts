/**
 * Public share pages:
 *   /m/:id    — La Memoria Viva portrait with OpenGraph / Twitter cards
 *   /s/:code  — venue QR landing page that opens tequilatown://scan/<CODE>
 */
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { loadConfig } from '../../server/config';
import { createShareHandler } from '../../server/share';
import { BlobsStore } from '../../server/store';

const handler = createShareHandler({ store: new BlobsStore({ getStore }), config: loadConfig() });

export default async (req: Request): Promise<Response> => handler.fetch(req);

export const config: Config = {
  path: ['/m/:id', '/s/:code'],
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: ['ip', 'domain'],
    windowSize: 60,
    windowLimit: 300,
  },
};
