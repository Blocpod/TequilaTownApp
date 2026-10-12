/**
 * Agave Persona: AI-written (JSON-schema structured output, validated against the
 * festival catalog) with a deterministic rules-based fallback, so completing the
 * Ritual ALWAYS yields a persona — even with no AI key, a timeout or bad output.
 */
import type { AgavePersona } from '../shared/api';
import { drinks, type Drink, type DrinkCategory } from '../shared/content/drinks';
import { experiences } from '../shared/content/experiences';
import { labelFor, type RitualAnswers } from '../shared/content/ritual';
import { jsonSchemaFormat, messageText, parseJsonObject } from './ai/openrouter';
import { personaPrompt, personaSchema } from './ai/prompts';
import { aiClient } from './ai/usage';
import type { Services } from './context';

const DRINK_IDS = new Set(drinks.map((d) => d.id));
const EXPERIENCE_IDS = new Set(experiences.map((e) => e.id));
const PERSONA_TIMEOUT_MS = 25_000;

// ---------------------------------------------------------------------------
// Validation of AI output
// ---------------------------------------------------------------------------

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s && [...s].length <= max ? s : null;
};

const textList = (v: unknown, min: number, max: number, each: number): string[] | null => {
  if (!Array.isArray(v)) return null;
  const items = [...new Set(v.map((x) => text(x, each)).filter((x): x is string => Boolean(x)))].slice(0, max);
  return items.length >= min ? items : null;
};

const idList = (v: unknown, allowed: Set<string>): string[] | null => {
  if (!Array.isArray(v)) return null;
  const ids = [...new Set(v.filter((x): x is string => typeof x === 'string' && allowed.has(x)))];
  return ids.length >= 2 && ids.length <= 3 ? ids : null;
};

export function validatePersona(raw: Record<string, unknown> | null): AgavePersona | null {
  if (!raw) return null;
  const title = text(raw.title, 80);
  const archetype = text(raw.archetype, 60);
  const description = text(raw.description, 700);
  const flavorNotes = textList(raw.flavorNotes, 2, 5, 40);
  const recommendedDrinkIds = idList(raw.recommendedDrinkIds, DRINK_IDS);
  const mustVisit = idList(raw.mustVisit, EXPERIENCE_IDS);
  const sc = raw.signatureCocktail as Record<string, unknown> | undefined;
  const cocktailName = text(sc?.name, 60);
  const ingredients = textList(sc?.ingredients, 2, 8, 80);
  const method = text(sc?.method, 400);
  if (!title || !archetype || !description || !flavorNotes || !recommendedDrinkIds || !mustVisit || !cocktailName || !ingredients || !method) {
    return null;
  }
  return { title, archetype, description, flavorNotes, recommendedDrinkIds, mustVisit, signatureCocktail: { name: cocktailName, ingredients, method } };
}

// ---------------------------------------------------------------------------
// Deterministic fallback
// ---------------------------------------------------------------------------

type Flavor = 'citrus_bright' | 'herbal_vegetal' | 'sweet_vanilla' | 'smoky' | 'peppery_spice';

const FLAVOR: Record<Flavor, { adjective: string; notes: string[]; categories: DrinkCategory[]; keywords: string[] }> = {
  citrus_bright: { adjective: 'Sunlit', notes: ['Lime zest', 'Grapefruit'], categories: ['blanco', 'cocktail'], keywords: ['citrus', 'refreshing'] },
  herbal_vegetal: { adjective: 'Verdant', notes: ['Fresh agave', 'Mint'], categories: ['blanco', 'cristalino'], keywords: ['agave', 'mint', 'mineral'] },
  sweet_vanilla: { adjective: 'Golden', notes: ['Vanilla', 'Caramel'], categories: ['reposado', 'cristalino', 'anejo'], keywords: ['vanilla', 'caramel', 'honey', 'butterscotch'] },
  smoky: { adjective: 'Smoky', notes: ['Charred oak', 'Tobacco'], categories: ['extra_anejo', 'anejo'], keywords: ['oak', 'tobacco'] },
  peppery_spice: { adjective: 'Fiery', notes: ['White pepper', 'Cinnamon'], categories: ['blanco', 'reposado'], keywords: ['pepper', 'spice'] },
};

const IDENTITY: Record<string, { noun: string; archetype: string }> = {
  casual_social: { noun: 'Socialite', archetype: 'Social Sipper' },
  cocktail_explorer: { noun: 'Alchemist', archetype: 'Cocktail Alchemist' },
  tequila_loyalist: { noun: 'Purist', archetype: 'Agave Purist' },
  whiskey_crossover: { noun: 'Barrel Hunter', archetype: 'Barrel Convert' },
  flavor_adventurer: { noun: 'Wanderer', archetype: 'Flavor Nomad' },
};

const CULTURE_ZONES: Record<string, { zones: string[]; phrase: string }> = {
  heritage_tradition: { zones: ['la-rojena', 'lazaros-hacienda', 'agave-reflection'], phrase: 'and you sip with a deep respect for heritage' },
  craft_process: { zones: ['la-rojena', 'palette-decoder', 'barrel-gallery'], phrase: 'and you want to know exactly how the magic is made' },
  celebration_energy: { zones: ['agave-after-dark', 'calles-de-noche', 'espiritu-express'], phrase: 'and every pour is a reason to celebrate' },
  music_nightlife: { zones: ['agave-after-dark', 'cristalino-cantina', 'calles-de-noche'], phrase: 'and the night always sounds better with a glass in hand' },
  design_fashion: { zones: ['barrel-gallery', 'cristalino-cantina', 'la-cava'], phrase: 'and you notice the bottle, the glass and the room as much as the pour' },
};

const COCKTAILS: Record<Flavor, AgavePersona['signatureCocktail']> = {
  citrus_bright: {
    name: 'Sol de Jalisco',
    ingredients: ['2 oz blanco tequila', '1 oz fresh grapefruit juice', '0.5 oz fresh lime juice', '0.25 oz agave nectar', 'Soda water to top'],
    method: 'Shake the tequila, citrus and agave with ice, strain over fresh ice and top with a splash of soda.',
  },
  herbal_vegetal: {
    name: 'Jardín Verde',
    ingredients: ['2 oz blanco tequila', '0.75 oz fresh lime juice', '0.5 oz agave nectar', '4 mint leaves', '2 cucumber slices'],
    method: 'Gently muddle the cucumber and mint, shake with the rest over ice and double-strain into a chilled coupe.',
  },
  sweet_vanilla: {
    name: 'Caramelo Viejo',
    ingredients: ['2 oz reposado tequila', '0.25 oz agave nectar', '2 dashes chocolate bitters', 'Orange peel'],
    method: 'Stir with ice until well chilled, strain over a large cube and express the orange peel over the top.',
  },
  smoky: {
    name: 'Humo y Roble',
    ingredients: ['1.5 oz añejo tequila', '0.5 oz mezcal', '0.25 oz agave nectar', '2 dashes Angostura bitters'],
    method: 'Stir over ice, strain onto a large cube and finish with a flamed orange peel.',
  },
  peppery_spice: {
    name: 'Fuego Lento',
    ingredients: ['2 oz blanco tequila', '1 oz fresh lime juice', '0.5 oz agave nectar', '1 thin jalapeño slice', 'Tajín for the rim'],
    method: 'Lightly muddle the jalapeño, shake with tequila, lime and agave, and strain over ice into a Tajín-rimmed glass.',
  },
};

const asArray = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

function scoreDrink(d: Drink, flavors: Flavor[], how: string): number {
  let score = 0;
  for (const f of flavors) {
    const spec = FLAVOR[f];
    if (spec.categories.includes(d.category)) score += 3;
    const notes = d.tastingNotes.join(' ').toLowerCase();
    for (const k of spec.keywords) if (notes.includes(k)) score += 1;
  }
  if (how === 'cocktails' && d.category === 'cocktail') score += 3;
  if ((how === 'neat' || how === 'flights') && (d.category === 'anejo' || d.category === 'extra_anejo')) score += 2;
  if (how === 'rocks' && (d.category === 'reposado' || d.category === 'cristalino')) score += 2;
  if (how === 'shots' && d.category === 'blanco') score += 1;
  return score;
}

export function fallbackPersona(answers: RitualAnswers): AgavePersona {
  const flavors = asArray(answers.taste_profile).filter((f): f is Flavor => f in FLAVOR);
  if (flavors.length === 0) flavors.push('sweet_vanilla');
  const primary = flavors[0];
  const identityKey = typeof answers.drinker_identity === 'string' ? answers.drinker_identity : 'casual_social';
  const identity = IDENTITY[identityKey] ?? IDENTITY.casual_social;
  const how = typeof answers.how_they_drink === 'string' ? answers.how_they_drink : 'cocktails';
  const cultureKey = typeof answers.culture_draw === 'string' ? answers.culture_draw : 'heritage_tradition';
  const culture = CULTURE_ZONES[cultureKey] ?? CULTURE_ZONES.heritage_tradition;

  const ranked = [...drinks].sort((a, b) => scoreDrink(b, flavors, how) - scoreDrink(a, flavors, how) || b.rating - a.rating || a.id.localeCompare(b.id));
  const recommended = ranked.slice(0, 3);

  const mustVisit = [...new Set([...culture.zones, ...recommended.flatMap((d) => d.whereToTry)])].filter((id) => EXPERIENCE_IDS.has(id)).slice(0, 3);

  const notes = [...new Set(flavors.flatMap((f) => FLAVOR[f].notes))];
  for (const extra of ['Cooked agave', 'Toasted oak', 'Citrus peel']) if (notes.length < 3 && !notes.includes(extra)) notes.push(extra);

  const flavorLabels = flavors.map((f) => labelFor('taste_profile', f).toLowerCase());
  const flavorText = flavorLabels.length > 1 ? `${flavorLabels.slice(0, -1).join(', ')} and ${flavorLabels[flavorLabels.length - 1]}` : flavorLabels[0];
  const identityLabel = labelFor('drinker_identity', identityKey).toLowerCase();
  const zoneNames = mustVisit.map((id) => experiences.find((e) => e.id === id)?.name ?? id);

  return {
    title: `The ${FLAVOR[primary].adjective} ${identity.noun}`,
    archetype: identity.archetype,
    description:
      `You're a ${identityLabel} drawn to ${flavorText} flavors, ${culture.phrase}. ` +
      `Start your night with the ${recommended[0].name}, and make time for ${zoneNames.slice(0, 2).join(' and ')}. ¡Salud!`,
    flavorNotes: notes.slice(0, 5),
    recommendedDrinkIds: recommended.map((d) => d.id),
    mustVisit,
    signatureCocktail: COCKTAILS[primary],
  };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export async function generatePersona(
  svc: Services,
  answers: RitualAnswers,
  origin: string,
): Promise<{ persona: AgavePersona; source: 'ai' | 'fallback' }> {
  const client = aiClient(svc, origin);
  if (client) {
    try {
      const completion = await client.complete(
        {
          model: svc.config.models.chat,
          messages: [{ role: 'user', content: personaPrompt(answers) }],
          response_format: jsonSchemaFormat('agave_persona', personaSchema),
          max_tokens: 900,
          temperature: 0.8,
        },
        { timeoutMs: PERSONA_TIMEOUT_MS },
      );
      const persona = validatePersona(parseJsonObject(messageText(completion.choices?.[0]?.message?.content)));
      if (persona) return { persona, source: 'ai' };
      svc.log.warn('persona.invalid_ai_output');
    } catch (e) {
      svc.log.warn('persona.ai_failed', { error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { persona: fallbackPersona(answers), source: 'fallback' };
}
