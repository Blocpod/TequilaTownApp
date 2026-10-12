/**
 * "The Tequila Town Ritual" — the sponsor-grade onboarding survey (MVP onboarding_v2).
 * Answers are stored server-side, feed the AI "Agave Persona", and roll up into the
 * sponsor aggregates endpoint.
 */
export type RitualQuestion = {
  id: string;
  kind: 'single' | 'multi';
  prompt: string;
  max?: number;
  options: { value: string; label: string; emoji: string }[];
};

export const RITUAL_SLUG = 'onboarding_v2';

export const ritual: RitualQuestion[] = [
  {
    id: 'drinker_identity',
    kind: 'single',
    prompt: 'Which best describes your relationship with tequila?',
    options: [
      { value: 'casual_social', label: 'Casual social sipper', emoji: '🥂' },
      { value: 'cocktail_explorer', label: 'Cocktail explorer', emoji: '🍹' },
      { value: 'tequila_loyalist', label: 'Tequila loyalist', emoji: '🌵' },
      { value: 'whiskey_crossover', label: 'Whiskey crossover', emoji: '🥃' },
      { value: 'flavor_adventurer', label: 'Flavor-first adventurer', emoji: '🧭' },
    ],
  },
  {
    id: 'how_they_drink',
    kind: 'single',
    prompt: 'How do you usually enjoy it?',
    options: [
      { value: 'neat', label: 'Neat', emoji: '🥃' },
      { value: 'rocks', label: 'On the rocks', emoji: '🧊' },
      { value: 'cocktails', label: 'In cocktails', emoji: '🍸' },
      { value: 'shots', label: 'Shots', emoji: '⚡️' },
      { value: 'flights', label: 'Tasting flights', emoji: '🎨' },
    ],
  },
  {
    id: 'brand_behavior',
    kind: 'single',
    prompt: 'When choosing a bottle, which sounds most like you?',
    options: [
      { value: 'stick_to_one', label: 'I stick to one brand I trust', emoji: '🤝' },
      { value: 'usually_one', label: 'I usually have a go-to', emoji: '⭐️' },
      { value: 'rotate_brands', label: 'I rotate between a few', emoji: '🔄' },
      { value: 'always_trying_new', label: "I'm always trying something new", emoji: '✨' },
    ],
  },
  {
    id: 'taste_profile',
    kind: 'multi',
    max: 3,
    prompt: 'Which flavors pull you in?',
    options: [
      { value: 'citrus_bright', label: 'Bright citrus', emoji: '🍋' },
      { value: 'herbal_vegetal', label: 'Herbal & vegetal', emoji: '🌿' },
      { value: 'sweet_vanilla', label: 'Sweet & vanilla', emoji: '🍯' },
      { value: 'smoky', label: 'Smoky', emoji: '🔥' },
      { value: 'peppery_spice', label: 'Peppery spice', emoji: '🌶️' },
    ],
  },
  {
    id: 'discovery_channel',
    kind: 'single',
    prompt: 'Where do you discover new tequilas?',
    options: [
      { value: 'bars_clubs', label: 'Bars & clubs', emoji: '🪩' },
      { value: 'festivals_events', label: 'Festivals & events', emoji: '🎪' },
      { value: 'friends', label: 'Friends & word of mouth', emoji: '🗣️' },
      { value: 'social_media', label: 'Social media', emoji: '📱' },
      { value: 'restaurants', label: 'Restaurants', emoji: '🍽️' },
    ],
  },
  {
    id: 'occasion_context',
    kind: 'single',
    prompt: 'When does tequila show up for you?',
    options: [
      { value: 'nights_out', label: 'Nights out', emoji: '🌙' },
      { value: 'at_home_friends', label: 'At home with friends', emoji: '🏡' },
      { value: 'special_occasions', label: 'Special occasions', emoji: '🎉' },
      { value: 'tastings_events', label: 'Tastings or events', emoji: '🍷' },
      { value: 'rarely_intentionally', label: 'Rarely, but intentionally', emoji: '🕯️' },
    ],
  },
  {
    id: 'culture_draw',
    kind: 'single',
    prompt: 'What draws you into tequila culture?',
    options: [
      { value: 'heritage_tradition', label: 'Heritage & tradition', emoji: '🏛️' },
      { value: 'craft_process', label: 'Craft & process', emoji: '⚗️' },
      { value: 'celebration_energy', label: 'Celebration & energy', emoji: '🎊' },
      { value: 'music_nightlife', label: 'Music & nightlife', emoji: '🎺' },
      { value: 'design_fashion', label: 'Design & aesthetic', emoji: '🎨' },
    ],
  },
];

export type RitualAnswers = Record<string, string | string[]>;

/** Validates a full answer set against the question definitions. Returns an error string or null. */
export function validateRitual(answers: RitualAnswers): string | null {
  for (const q of ritual) {
    const a = answers[q.id];
    const allowed = new Set(q.options.map((o) => o.value));
    if (q.kind === 'single') {
      if (typeof a !== 'string' || !allowed.has(a)) return `Invalid answer for ${q.id}`;
    } else {
      if (!Array.isArray(a) || a.length === 0 || a.length > (q.max ?? q.options.length)) return `Invalid answer for ${q.id}`;
      if (!a.every((v) => typeof v === 'string' && allowed.has(v))) return `Invalid answer for ${q.id}`;
      if (new Set(a).size !== a.length) return `Duplicate answer for ${q.id}`;
    }
  }
  return null;
}

export function labelFor(questionId: string, value: string): string {
  return ritual.find((q) => q.id === questionId)?.options.find((o) => o.value === value)?.label ?? value;
}
