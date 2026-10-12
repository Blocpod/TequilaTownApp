/**
 * El Ojo — bottle identification with a vision model and JSON-schema structured
 * output. The photo is sent to the AI provider and never stored.
 */
import type { Identification } from '../../shared/api';
import { drinks } from '../../shared/content/drinks';
import type { Ctx } from '../context';
import { decodeImageUpload, json, MAX_JSON_BYTES, readJson } from '../http';
import { RULES } from '../ratelimit';
import { AiUpstreamError, jsonSchemaFormat, messageText, parseJsonObject, toApiError } from './openrouter';
import { identificationSchema, identifyPrompt } from './prompts';
import { refundAi, requireAiClient, reserveAi } from './usage';

const CATEGORIES = ['blanco', 'reposado', 'anejo', 'extra_anejo', 'cristalino', 'cocktail', 'mezcal', 'other'] as const;
const CONFIDENCE = ['high', 'medium', 'low'] as const;
const DRINK_IDS = new Set(drinks.map((d) => d.id));

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s ? [...s].slice(0, max).join('') : null;
};

/** Validates and normalizes model output into an Identification (null if unusable). */
export function validateIdentification(raw: Record<string, unknown> | null): Identification | null {
  if (!raw) return null;
  const name = str(raw.name, 120);
  const brand = str(raw.brand, 80);
  const description = str(raw.description, 600);
  if (!name || !brand || !description || typeof raw.isTequila !== 'boolean') return null;
  const notes = Array.isArray(raw.tastingNotes)
    ? raw.tastingNotes.map((n) => str(n, 40)).filter((n): n is string => Boolean(n)).slice(0, 6)
    : [];
  const category = (CATEGORIES as readonly string[]).includes(raw.category as string) ? (raw.category as Identification['category']) : 'other';
  const confidence = (CONFIDENCE as readonly string[]).includes(raw.confidence as string) ? (raw.confidence as Identification['confidence']) : 'low';
  const festivalDrinkId = typeof raw.festivalDrinkId === 'string' && DRINK_IDS.has(raw.festivalDrinkId) ? raw.festivalDrinkId : null;
  return {
    isTequila: raw.isTequila,
    name,
    brand,
    category,
    confidence,
    description,
    tastingNotes: notes,
    servingSuggestion: str(raw.servingSuggestion, 300) ?? '',
    pairing: str(raw.pairing, 300) ?? '',
    funFact: str(raw.funFact, 400) ?? '',
    festivalDrinkId,
  };
}

export async function identify(ctx: Ctx): Promise<Response> {
  const { svc, user } = ctx;
  const client = requireAiClient(ctx);
  svc.limiter.check(`identify:${user.id}`, RULES.identify);
  const body = await readJson(ctx.req, MAX_JSON_BYTES);
  const photo = decodeImageUpload(body.image, 4 * 1024 * 1024);
  const reservation = await reserveAi(ctx, 'identify');

  try {
    const completion = await client.complete(
      {
        model: svc.config.models.vision,
        messages: [
          { role: 'system', content: identifyPrompt() },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Identify this bottle. Respond with the JSON object only.' },
              { type: 'image_url', image_url: { url: `data:${photo.contentType};base64,${photo.bytes.toString('base64')}` } },
            ],
          },
        ],
        response_format: jsonSchemaFormat('bottle_identification', identificationSchema),
        max_tokens: 800,
        temperature: 0.2,
      },
      { timeoutMs: 45_000, signal: ctx.req.signal },
    );
    const message = completion.choices?.[0]?.message;
    if (message?.refusal) throw new AiUpstreamError(`refusal: ${message.refusal}`, 'refused');
    const result = validateIdentification(parseJsonObject(messageText(message?.content)));
    if (!result) throw new AiUpstreamError('identification did not match the schema', 'unavailable');
    return json(result, 200, { 'x-ai-remaining': String(reservation.remaining) });
  } catch (e) {
    await refundAi(svc, user.id, reservation);
    svc.log.error('ai.identify.failed', { userId: user.id, requestId: ctx.requestId, error: (e as Error).message });
    throw toApiError(e);
  }
}
