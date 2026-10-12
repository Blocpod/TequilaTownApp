/**
 * POST /api/ai/chat — streams the Oracle's answer as Server-Sent Events:
 *
 *   data: {"delta":"¡Hola"}\n\n            (zero or more)
 *   data: {"done":true,"remaining":119}\n\n  (success)
 *   data: {"error":"…","code":"AI_UNAVAILABLE"}\n\n  (failure after the stream started)
 *
 * Validation, auth, allowance (429 LIMIT_REACHED) and upstream connection errors
 * are returned as normal JSON errors *before* the stream starts.
 */
import type { ChatMessage, ChatStreamEvent } from '../../shared/api';
import type { ChatPersona } from '../../shared/content/oracle';
import type { Ctx } from '../context';
import { ApiError, badRequest, isPlainObject, readJson, reqEnum } from '../http';
import { RULES } from '../ratelimit';
import { AiUpstreamError, sseData, toApiError, type ChunkDelta } from './openrouter';
import { chatSystemPrompt } from './prompts';
import { refundAi, requireAiClient, reserveAi } from './usage';

export const MAX_HISTORY = 20;
export const MAX_MESSAGE_CHARS = 2000;
const STREAM_TIMEOUT_MS = 55_000; // Netlify streaming functions stop at 60s

export function validateMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw) || raw.length === 0) throw badRequest('`messages` must be a non-empty array', { field: 'messages' });
  const recent = raw.slice(-MAX_HISTORY);
  const out: ChatMessage[] = recent.map((m, i) => {
    if (!isPlainObject(m)) throw badRequest(`messages[${i}] must be an object`, { field: 'messages' });
    if (m.role !== 'user' && m.role !== 'assistant') throw badRequest(`messages[${i}].role must be "user" or "assistant"`, { field: 'messages' });
    if (typeof m.content !== 'string' || !m.content.trim()) throw badRequest(`messages[${i}].content must be a non-empty string`, { field: 'messages' });
    if (m.content.length > MAX_MESSAGE_CHARS) {
      throw badRequest(`Messages must be at most ${MAX_MESSAGE_CHARS} characters`, { field: 'messages', index: i });
    }
    return { role: m.role, content: m.content.trim() };
  });
  if (out[out.length - 1].role !== 'user') throw badRequest('The last message must be from the user', { field: 'messages' });
  return out;
}

export const SSE_HEADERS = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
  'x-accel-buffering': 'no',
};

export async function chat(ctx: Ctx): Promise<Response> {
  const { svc, user } = ctx;
  const client = requireAiClient(ctx);
  svc.limiter.check(`chat:${user.id}`, RULES.chat);
  // Generous: clients may send their whole history; only the last 20 messages are used.
  const body = await readJson(ctx.req, 1024 * 1024);
  const persona = reqEnum<ChatPersona>(body, 'persona', ['cantinero', 'mesa']);
  const messages = validateMessages(body.messages);
  const reservation = await reserveAi(ctx, 'chat');

  const upstreamAbort = new AbortController();
  let clientGone = false;
  const onClientAbort = () => {
    clientGone = true;
    upstreamAbort.abort();
  };
  ctx.req.signal?.addEventListener('abort', onClientAbort, { once: true });
  const timer = setTimeout(() => upstreamAbort.abort(), STREAM_TIMEOUT_MS);
  const cleanup = () => {
    clearTimeout(timer);
    ctx.req.signal?.removeEventListener('abort', onClientAbort);
  };

  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await client.stream(
      {
        model: svc.config.models.chat,
        messages: [{ role: 'system', content: chatSystemPrompt(persona) }, ...messages],
        max_tokens: 900,
        temperature: 0.7,
      },
      upstreamAbort.signal,
    );
  } catch (e) {
    cleanup();
    await refundAi(svc, user.id, reservation);
    svc.log.error('ai.chat.upstream_failed', { userId: user.id, requestId: ctx.requestId, error: (e as Error).message });
    if (e instanceof AiUpstreamError && e.kind === 'refused') {
      throw new ApiError('AI_REFUSED', "The Oracle can't help with that one — try asking another way");
    }
    throw toApiError(e);
  }

  const encoder = new TextEncoder();
  let delivered = 0;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (evt: ChatStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
        } catch {
          // client already gone
        }
      };
      try {
        for await (const data of sseData(upstream)) {
          if (data === '[DONE]') break;
          let chunk: ChunkDelta;
          try {
            chunk = JSON.parse(data) as ChunkDelta;
          } catch {
            continue;
          }
          const choice = chunk.choices?.[0];
          if (chunk.error || choice?.finish_reason === 'error') {
            throw new AiUpstreamError(`stream error: ${chunk.error?.message ?? 'unknown'}`, 'unavailable');
          }
          const text = choice?.delta?.content;
          if (typeof text === 'string' && text.length) {
            delivered += text.length;
            send({ delta: text });
          }
        }
        if (delivered === 0) throw new AiUpstreamError('empty completion', 'unavailable');
        send({ done: true, remaining: reservation.remaining });
      } catch (e) {
        if (!clientGone) {
          svc.log.error('ai.chat.stream_failed', { userId: user.id, requestId: ctx.requestId, error: (e as Error).message, delivered });
          send({ error: 'The Oracle lost the thread — please try again', code: 'AI_UNAVAILABLE' });
        }
        if (delivered === 0) await refundAi(svc, user.id, reservation);
      } finally {
        cleanup();
        upstreamAbort.abort();
        try {
          controller.close();
        } catch {
          // already closed/cancelled
        }
      }
    },
    cancel() {
      clientGone = true;
      upstreamAbort.abort();
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
