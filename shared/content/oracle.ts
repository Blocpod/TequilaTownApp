/** Public-facing Oracle configuration. Prompts live server-side in server/ai/prompts.ts. */
export type MemoryStyle = 'tintype' | 'black-white' | 'sepia' | 'kodachrome';

export const memoryStyles: { id: MemoryStyle; name: string; era: string; description: string; tint: string }[] = [
  { id: 'tintype', name: 'Tintype', era: '1870s', description: 'Wet-plate collodion on iron. Silver, solemn, elemental.', tint: '#6E6E6A' },
  { id: 'black-white', name: 'Tri-X', era: '1940s', description: 'Documentary black & white with deep grain.', tint: '#2B2B2B' },
  { id: 'sepia', name: 'Sepia', era: '1930s–50s', description: 'Warm, aged, found in a family album.', tint: '#8A5A2B' },
  { id: 'kodachrome', name: 'Kodachrome', era: '1950s', description: 'Rich mid-century color at golden hour.', tint: '#C9772B' },
];

export type ChatPersona = 'cantinero' | 'mesa';

export const personas: Record<ChatPersona, { name: string; title: string; greeting: string; suggestions: string[] }> = {
  cantinero: {
    name: 'El Cantinero',
    title: 'The Bartender',
    greeting:
      '¡Bienvenido, amigo! I pour, you sip. Tell me what you like — sweet, smoky, bright, bold — and I\'ll find your tequila or build you a cocktail.',
    suggestions: [
      'Build me a cocktail with reposado',
      "What's the difference between añejo and extra añejo?",
      'I like smoky whiskey — where do I start?',
      'A refreshing drink for a hot day',
    ],
  },
  mesa: {
    name: 'La Mesa',
    title: 'The Table',
    greeting:
      'Pásale, siéntate. I know every dish at Tequila Town and which pour makes it sing. What are you craving — or what are you drinking?',
    suggestions: [
      'What pairs with Don Julio Añejo?',
      'Vegetarian bites at the festival?',
      'Dessert to go with a cristalino',
      'Tell me about quesabirria',
    ],
  },
};

/** Daily AI allowances per user — enforced server-side. */
export const aiLimits = {
  chatMessages: 120,
  memories: 6,
  identifications: 25,
} as const;
