export type StorySlide = { image: string; kicker: string; text: string };

export type Sponsor = {
  id: string;
  name: string;
  monogram: string;
  color: string;
  description: string;
  story: string;
  offers: { title: string; description: string; code?: string }[];
  /** Ken-Burns brand story shown in the Stories viewer. */
  stories: StorySlide[];
};

export const sponsors: Sponsor[] = [
  {
    id: 'jose-cuervo',
    name: 'Jose Cuervo',
    monogram: 'JC',
    color: '#8C1D18',
    description: "The world's #1 selling tequila since 1795.",
    story:
      'For over 250 years, Jose Cuervo has been crafting tequila in the town of Tequila, Jalisco. As the oldest family-owned tequila brand in Mexico, Cuervo represents the rich heritage and tradition of authentic Mexican tequila making.',
    offers: [{ title: 'Reserva de la Familia', description: '20% off limited-edition bottles at the Mercado.', code: 'CUERVO20' }],
    stories: [
      { image: 'expLaRojena', kicker: 'La Rojeña', text: '250 years of history inside the oldest active distillery in the Americas.' },
      { image: 'expAgaveReflection', kicker: "The Jimador's Art", text: 'Every piña is harvested by hand with a coa — a craft passed down for generations.' },
    ],
  },
  {
    id: '1800-tequila',
    name: '1800 Tequila',
    monogram: '18',
    color: '#5B3A1E',
    description: 'Named for the year tequila was first aged in oak barrels.',
    story:
      '1800 Tequila takes its name from a pivotal year in tequila history — when the spirit was first aged in oak casks. This innovation transformed tequila from a rustic drink into a sophisticated spirit worthy of the world stage.',
    offers: [{ title: 'Train Rider Special', description: 'A free 1800 cocktail aboard the Espíritu Express.' }],
    stories: [{ image: 'expEspirituTrain', kicker: 'The 1800 Story', text: 'One year changed everything: the first tequila rested in oak.' }],
  },
  {
    id: 'don-julio',
    name: 'Don Julio',
    monogram: 'DJ',
    color: '#1F3A2E',
    description: 'Premium tequila crafted with passion since 1942.',
    story:
      'Don Julio González founded his distillery with a simple vision: create the finest tequila possible. His dedication to quality over quantity set new standards for premium tequila that continue to this day.',
    offers: [{ title: 'Palette Master', description: 'An exclusive tasting flight of the Don Julio collection.' }],
    stories: [{ image: 'expPaletteDecoder', kicker: "The Don's Legacy", text: 'Quality over quantity — a philosophy poured into every bottle since 1942.' }],
  },
  {
    id: 'herradura',
    name: 'Herradura',
    monogram: 'H',
    color: '#7A4A1C',
    description: 'Crafting tequila at Hacienda San José del Refugio since 1870.',
    story:
      'Named for a horseshoe found at the hacienda, Herradura has made tequila with time-honored methods for over 150 years — including some of the longest resting times in the industry.',
    offers: [{ title: 'Barrel Select', description: '15% off Herradura Selección Suprema.' }],
    stories: [{ image: 'expBarrelGallery', kicker: 'Time in Oak', text: 'Patience is an ingredient. Some barrels rest for years before they speak.' }],
  },
  {
    id: 'clase-azul',
    name: 'Clase Azul',
    monogram: 'CA',
    color: '#24427A',
    description: 'Ultra-premium tequila in handcrafted decanters.',
    story:
      'Each Clase Azul bottle is a work of art, handcrafted by Mexican artisans. The treasure inside is tequila made from the finest agave, aged to perfection.',
    offers: [{ title: 'VIP Vault Access', description: 'An exclusive tasting of rare vintages in La Cava.' }],
    stories: [{ image: 'expLaCava', kicker: 'Art Meets Spirit', text: 'Hand-painted ceramic decanters — no two exactly alike.' }],
  },
  {
    id: 'patron',
    name: 'Patrón',
    monogram: 'P',
    color: '#2F4F3A',
    description: "Proof that tequila belongs among the world's finest spirits.",
    story:
      "Patrón helped prove that tequila could stand alongside the world's finest spirits. Each bottle is a testament to the pursuit of perfection.",
    offers: [{ title: 'Night Walker Pack', description: 'A Patrón gift set with qualifying purchase.' }],
    stories: [{ image: 'expCallesNoche', kicker: 'Perfection in Every Detail', text: 'Lanterns, guitars and a pour worth slowing down for.' }],
  },
  {
    id: 'dobel',
    name: 'Dobel',
    monogram: 'D',
    color: '#4E7C8C',
    description: 'Pioneers of the cristalino tequila category.',
    story:
      'Maestro Dobel created a breakthrough — the first cristalino tequila. By filtering añejo through charcoal, they achieved aged flavor with crystal clarity.',
    offers: [{ title: 'Diamante Experience', description: 'An exclusive Dobel Diamante tasting flight.' }],
    stories: [{ image: 'expCristalinoCantina', kicker: 'The Cristalino Revolution', text: 'All the depth of an añejo. None of the color.' }],
  },
  {
    id: 'casamigos',
    name: 'Casamigos',
    monogram: 'C',
    color: '#3B2A5A',
    description: 'Tequila made by friends, for friends.',
    story:
      'What started as a private tequila among friends became one of the fastest-growing spirits brands in history. Smooth, drinkable and always ready for a good time.',
    offers: [{ title: 'House of Friends', description: 'VIP access to the Agave After Dark lounge.' }],
    stories: [{ image: 'expAgaveAfterDark', kicker: 'House of Friends', text: 'Good tequila, better company — all night long.' }],
  },
  {
    id: 'gran-centenario',
    name: 'Gran Centenario',
    monogram: 'GC',
    color: '#9A5B13',
    description: 'The legacy of Lázaro Gallardo since 1857.',
    story:
      "Lázaro Gallardo's techniques transformed tequila making. His approach to distilling and aging created tequilas of remarkable smoothness that defined a new standard.",
    offers: [{ title: 'Heritage Package', description: 'Limited-edition Leyenda bottle at the Mercado.' }],
    stories: [{ image: 'expLazarosHacienda', kicker: 'The Legend of Lázaro', text: 'A home, an ofrenda, and the first master distiller.' }],
  },
];

export const sponsorById = (id: string) => sponsors.find((s) => s.id === id);
