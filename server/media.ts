/**
 * User media (avatars, La Memoria Viva portraits) stored as raw bytes in the
 * `media` namespace: `avatars/<id>` and `memories/<id>`. Ids are 128-bit random,
 * so URLs are unguessable capabilities and can be cached as immutable.
 *
 * Responses carry a `Netlify-Cache-Tag` so deletions can purge the CDN copy.
 */
import type { Ctx, Services } from './context';
import { ApiError } from './http';

export type MediaKind = 'avatars' | 'memories';
const KINDS: readonly MediaKind[] = ['avatars', 'memories'];
const ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

export const mediaKey = (kind: MediaKind, id: string) => `${kind}/${id}`;
export const mediaCacheTag = (id: string) => `media-${id}`;

export async function deleteMedia(svc: Services, kind: MediaKind, id: string): Promise<void> {
  await svc.store.ns('media').delete(mediaKey(kind, id));
}

/** Best-effort CDN purge after deletion (the bytes are already gone from storage). */
export async function purgeMedia(svc: Services, ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    await svc.purgeCache(ids.map(mediaCacheTag));
  } catch (e) {
    svc.log.warn('media.purge_failed', { count: ids.length, error: e instanceof Error ? e.message : String(e) });
  }
}

/** GET /api/media/:kind/:id */
export async function serveMedia(ctx: Ctx | Omit<Ctx, 'user'>): Promise<Response> {
  const kind = ctx.params.kind as MediaKind;
  const id = ctx.params.id ?? '';
  if (!KINDS.includes(kind) || !ID_RE.test(id)) throw new ApiError('NOT_FOUND', 'Not found');
  const res = await ctx.svc.store.ns('media').getStream(mediaKey(kind, id));
  if (!res) throw new ApiError('NOT_FOUND', 'Not found');
  const contentType = typeof res.metadata.contentType === 'string' ? res.metadata.contentType : 'application/octet-stream';
  const immutable = 'public, max-age=31536000, immutable';
  return new Response(res.stream, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': immutable,
      'netlify-cdn-cache-control': immutable,
      'netlify-cache-tag': mediaCacheTag(id),
      'x-content-type-options': 'nosniff',
      // Personal photos: fetchable for link previews, but kept out of image search.
      'x-robots-tag': 'noindex',
      'content-security-policy': "default-src 'none'; sandbox",
      'cross-origin-resource-policy': 'cross-origin',
    },
  });
}
