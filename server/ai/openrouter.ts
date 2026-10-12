/**
 * Minimal OpenRouter client (OpenAI-compatible chat completions).
 *
 *   POST https://openrouter.ai/api/v1/chat/completions
 *   - images in:   content parts `{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,…' } }`
 *   - images out:  `modalities: ['image', 'text']` → `choices[0].message.images[].image_url.url` (data URL)
 *   - JSON out:    `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }`
 *   - streaming:   SSE `data: {chunk}` lines, `data: [DONE]` terminator, `: OPENROUTER PROCESSING`
 *                  keep-alive comments; mid-stream errors arrive as a chunk with a top-level `error`.
 */
import { ApiError } from '../http';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type OrMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] };

export type ChatCompletion = {
  id?: string;
  error?: { code?: number | string; message?: string };
  choices?: {
    finish_reason?: string | null;
    error?: { code?: number | string; message?: string };
    message?: {
      content?: string | ContentPart[] | null;
      refusal?: string | null;
      images?: { type?: string; image_url?: { url?: string } }[];
    };
  }[];
};

export type ChunkDelta = {
  error?: { code?: number | string; message?: string };
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
};

export class AiUpstreamError extends Error {
  constructor(
    message: string,
    readonly kind: 'unavailable' | 'refused',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AiUpstreamError';
  }
}

export type OpenRouterOptions = {
  apiKey: string;
  fetch: typeof fetch;
  /** Site origin, sent as HTTP-Referer for OpenRouter attribution. */
  referer: string;
  title?: string;
  /** API base (default https://openrouter.ai/api/v1); override for a proxy or a local mock. */
  baseUrl?: string;
};

export class OpenRouterClient {
  constructor(private readonly opts: OpenRouterOptions) {}

  private async post(body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
    let res: Response;
    try {
      const base = (this.opts.baseUrl ?? OPENROUTER_BASE_URL).replace(/\/+$/, '');
      res = await this.opts.fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.opts.apiKey}`,
          'content-type': 'application/json',
          'http-referer': this.opts.referer,
          'x-title': this.opts.title ?? 'Tequila Town',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      const aborted = signal.aborted;
      throw new AiUpstreamError(aborted ? 'AI request timed out or was cancelled' : `AI network error: ${(e as Error).message}`, 'unavailable');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let message = text.slice(0, 300);
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        // not JSON
      }
      // 403 = input flagged by moderation; everything else is an availability problem.
      throw new AiUpstreamError(`OpenRouter ${res.status}: ${message}`, res.status === 403 ? 'refused' : 'unavailable', res.status);
    }
    return res;
  }

  /** Non-streaming completion with an overall timeout. */
  async complete(body: Record<string, unknown>, opts: { timeoutMs: number; signal?: AbortSignal }): Promise<ChatCompletion> {
    const signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(opts.timeoutMs)]) : AbortSignal.timeout(opts.timeoutMs);
    const res = await this.post({ ...body, stream: false }, signal);
    let data: ChatCompletion;
    try {
      data = (await res.json()) as ChatCompletion;
    } catch {
      throw new AiUpstreamError('AI returned an unreadable response', 'unavailable');
    }
    const err = data.error ?? data.choices?.[0]?.error;
    if (err) throw new AiUpstreamError(`AI provider error: ${err.message ?? err.code ?? 'unknown'}`, 'unavailable');
    return data;
  }

  /** Streaming completion. Resolves once upstream answered with 2xx headers. */
  async stream(body: Record<string, unknown>, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    const res = await this.post({ ...body, stream: true }, signal);
    if (!res.body) throw new AiUpstreamError('AI returned an empty stream', 'unavailable');
    return res.body;
  }
}

/** Maps upstream failures to API errors. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof AiUpstreamError && e.kind === 'refused') {
    return new ApiError('AI_REFUSED', "The AI couldn't work with that image — try a different photo");
  }
  return new ApiError('AI_UNAVAILABLE', 'The Oracle is resting — please try again in a moment');
}

/**
 * Parses an SSE byte stream into `data:` payloads. Handles CRLF, multi-line data
 * fields and comment lines (e.g. `: OPENROUTER PROCESSING`), which are skipped.
 */
export async function* sseData(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data: string[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.search(/\r?\n/)) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + (buffer[nl] === '\r' ? 2 : 1));
        if (line === '') {
          if (data.length) yield data.join('\n');
          data = [];
        } else if (line.startsWith(':')) {
          continue;
        } else if (line.startsWith('data:')) {
          data.push(line.slice(5).replace(/^ /, ''));
        }
        // other fields (event:, id:, retry:) are not used by OpenRouter
      }
      if (done) {
        if (buffer.startsWith('data:')) data.push(buffer.slice(5).replace(/^ /, ''));
        if (data.length) yield data.join('\n');
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function messageText(content: string | ContentPart[] | null | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof (p as { text?: unknown }).text === 'string')
    .map((p) => p.text)
    .join('');
}

/** Extracts a JSON object from model output, tolerating code fences / stray prose. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const candidates = [trimmed];
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const v = JSON.parse(c);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      // try next
    }
  }
  return null;
}

export const jsonSchemaFormat = (name: string, schema: Record<string, unknown>) => ({
  type: 'json_schema',
  json_schema: { name, strict: true, schema },
});
