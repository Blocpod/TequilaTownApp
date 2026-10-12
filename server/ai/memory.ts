/**
 * La Memoria Viva — turns a selfie into a vintage jimador portrait with an image
 * model (OpenRouter `modalities: ['image','text']`), stores the result in media and
 * indexes it per user.
 */
import type { Memory, MemoriesResponse } from '../../shared/api';
import { memoryStyles, type MemoryStyle } from '../../shared/content/oracle';
import { mediaUrl, type Ctx } from '../context';
import { ApiError, decodeImageUpload, json, MAX_JSON_BYTES, readJson, reqEnum, sniffImage } from '../http';
import { deleteMedia, mediaKey, purgeMedia } from '../media';
import { RULES } from '../ratelimit';
import { casUpdate, NO_CHANGE } from '../store';
import type { MemoryRecord } from '../types';
import { randomId } from '../util';
import { toApiError, type ChatCompletion } from './openrouter';
import { memoryPrompt } from './prompts';
import { refundAi, requireAiClient, reserveAi } from './usage';

export const MAX_SELFIE_BYTES = 4 * 1024 * 1024;
const MAX_RESULT_BYTES = 12 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 50_000; // the whole request must finish inside Netlify's 60s limit

type MemoryIndex = { items: MemoryRecord[] };

export const toMemory = (origin: string, m: MemoryRecord): Memory => ({
  id: m.id,
  style: m.style,
  imageUrl: mediaUrl(origin, 'memories', m.id),
  shareUrl: `${origin}/m/${m.id}`,
  createdAt: m.createdAt,
});

function decodeDataUrl(url: string): Uint8Array | null {
  const m = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/s.exec(url);
  if (!m) return null;
  const isB64 = /;base64/i.test(m[2]);
  try {
    return isB64 ? Buffer.from(m[3].replace(/\s+/g, ''), 'base64') : Buffer.from(decodeURIComponent(m[3]), 'binary');
  } catch {
    return null;
  }
}

/** Pulls the first generated image out of a chat completion (data URL, https URL or bare base64). */
export async function extractGeneratedImage(
  completion: ChatCompletion,
  fetchImpl: typeof fetch,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const msg = completion.choices?.[0]?.message;
  const urls: string[] = [];
  for (const img of msg?.images ?? []) if (typeof img?.image_url?.url === 'string') urls.push(img.image_url.url);
  if (Array.isArray(msg?.content)) {
    for (const part of msg.content) if (part.type === 'image_url' && typeof part.image_url?.url === 'string') urls.push(part.image_url.url);
  }
  for (const url of urls) {
    let bytes: Uint8Array | null = null;
    if (url.startsWith('data:')) {
      bytes = decodeDataUrl(url);
    } else if (/^https:\/\//i.test(url)) {
      try {
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
        const len = Number(res.headers.get('content-length') ?? '0');
        if (res.ok && len <= MAX_RESULT_BYTES) bytes = new Uint8Array(await res.arrayBuffer());
      } catch {
        bytes = null;
      }
    } else if (/^[A-Za-z0-9+/=\s]+$/.test(url) && url.length > 100) {
      bytes = Buffer.from(url.replace(/\s+/g, ''), 'base64');
    }
    if (!bytes || bytes.length === 0 || bytes.length > MAX_RESULT_BYTES) continue;
    const contentType = sniffImage(bytes);
    if (contentType) return { bytes, contentType };
  }
  return null;
}

export async function createMemory(ctx: Ctx): Promise<Response> {
  const { svc, user } = ctx;
  const client = requireAiClient(ctx);
  svc.limiter.check(`memories:${user.id}`, RULES.memories);
  const body = await readJson(ctx.req, MAX_JSON_BYTES);
  const style = reqEnum<MemoryStyle>(body, 'style', memoryStyles.map((s) => s.id));
  const selfie = decodeImageUpload(body.image, MAX_SELFIE_BYTES);
  const reservation = await reserveAi(ctx, 'memories');

  let image: { bytes: Uint8Array; contentType: string } | null;
  try {
    const completion = await client.complete(
      {
        model: svc.config.models.image,
        modalities: ['image', 'text'],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: memoryPrompt(style) },
              { type: 'image_url', image_url: { url: `data:${selfie.contentType};base64,${selfie.bytes.toString('base64')}` } },
            ],
          },
        ],
        image_config: { aspect_ratio: '4:5' },
      },
      { timeoutMs: IMAGE_TIMEOUT_MS, signal: ctx.req.signal },
    );
    image = await extractGeneratedImage(completion, svc.fetch);
    if (!image) {
      svc.log.warn('ai.memory.no_image', {
        userId: user.id,
        requestId: ctx.requestId,
        finish: completion.choices?.[0]?.finish_reason ?? null,
      });
      throw new ApiError('AI_REFUSED', "The Oracle couldn't develop this one — try a clear, well-lit selfie");
    }
  } catch (e) {
    await refundAi(svc, user.id, reservation);
    if (!(e instanceof ApiError)) svc.log.error('ai.memory.failed', { userId: user.id, requestId: ctx.requestId, error: (e as Error).message });
    throw toApiError(e);
  }

  const now = svc.now().toISOString();
  const record: MemoryRecord = { id: randomId(16), style, contentType: image.contentType, createdAt: now };
  await svc.store.ns('media').setBytes(mediaKey('memories', record.id), image.bytes, {
    userId: user.id,
    style,
    createdAt: now,
    contentType: image.contentType,
  });
  await casUpdate<MemoryIndex>(
    svc.store.ns('memories'),
    user.id,
    (idx) => {
      idx.items.unshift(record);
    },
    { init: () => ({ items: [] }) },
  );
  svc.log.info('ai.memory.created', { userId: user.id, style, bytes: image.bytes.length, requestId: ctx.requestId });
  return json(toMemory(ctx.origin, record), 201, { 'x-ai-remaining': String(reservation.remaining) });
}

export async function listMemories(ctx: Ctx): Promise<Response> {
  const res = await ctx.svc.store.ns('memories').getJSON<MemoryIndex>(ctx.user.id);
  const out: MemoriesResponse = { memories: (res?.value.items ?? []).map((m) => toMemory(ctx.origin, m)) };
  return json(out);
}

export async function deleteMemory(ctx: Ctx): Promise<Response> {
  const { svc, user } = ctx;
  const id = ctx.params.id;
  const { result: found } = await casUpdate<MemoryIndex, boolean>(
    svc.store.ns('memories'),
    user.id,
    (idx) => {
      const before = idx.items.length;
      idx.items = idx.items.filter((m) => m.id !== id);
      return idx.items.length === before ? NO_CHANGE : true;
    },
    { init: () => ({ items: [] }) },
  );
  // Not the owner (or already deleted) → 404, without revealing whether it exists.
  if (!found) throw new ApiError('NOT_FOUND', 'Memory not found');
  await deleteMedia(svc, 'memories', id);
  ctx.defer(() => purgeMedia(svc, [id]), 'media.purge');
  return json({ ok: true });
}
