/**
 * The twelve zones of the Tequila Town journey.
 * `image`/`motion` are keys into the mobile art registry (mobile/src/theme/images.generated.ts).
 * `map` is the zone's landmark on the illustrated journey map, normalized 0..1.
 */
export type Experience = {
  id: string;
  zone: number;
  name: string;
  subtitle: string;
  description: string;
  longDescription: string;
  /** What's poured / served here, if anything (from the MVP's sip sequence). */
  pour?: string;
  image: string;
  motion?: string;
  sponsorId?: string;
  duration: string;
  map: { x: number; y: number };
  accent: string;
};

export const experiences: Experience[] = [
  {
    id: 'agave-reflection',
    zone: 1,
    name: 'Agave Reflection',
    subtitle: 'The Journey Begins',
    description: 'Begin your journey in the heart of the agave fields.',
    longDescription:
      'Mirrors surrounded by agave plants invite you to physically, and metaphorically, reflect inward before the journey begins. Stand among the pencas, find your own reflection, and set the intention for the night.',
    image: 'expAgaveReflection',
    motion: 'motionAgaveReflection',
    sponsorId: 'jose-cuervo',
    duration: '15 min',
    map: { x: 0.133, y: 0.645 },
    accent: '#4F7A5E',
  },
  {
    id: 'espiritu-express',
    zone: 2,
    name: 'Espíritu Express',
    subtitle: 'All Aboard',
    description: 'Ride the legendary tequila train through agave country.',
    longDescription:
      'Ride through the agave fields of Jalisco, Mexico, taking you back to where the journey begins. Your welcome drink is poured as the landscape rolls by.',
    pour: 'Welcome drink',
    image: 'expEspirituTrain',
    sponsorId: '1800-tequila',
    duration: '20 min',
    map: { x: 0.138, y: 0.78 },
    accent: '#C9772B',
  },
  {
    id: 'la-rojena',
    zone: 3,
    name: 'La Rojeña',
    subtitle: 'Back to the Roots',
    description: "Tour the world's oldest active tequila distillery.",
    longDescription:
      "Discover how tequila's 18th-century roots shaped the spirit we love today, crafted with care, culture and centuries of tradition. Copper stills, the raven, and your first sip.",
    pour: '1st sip + cocktail bar',
    image: 'expLaRojena',
    sponsorId: 'jose-cuervo',
    duration: '25 min',
    map: { x: 0.237, y: 0.215 },
    accent: '#AD3A00',
  },
  {
    id: 'palette-decoder',
    zone: 4,
    name: 'Palette Decoder',
    subtitle: 'Culture You Can Taste',
    description: 'Master the art of tequila tasting.',
    longDescription:
      'Break the fourth wall of taste as you explore the notes, aromas, and sensations that define your personal flavor profile. Blanco, reposado and añejo, decoded.',
    pour: '2nd sip',
    image: 'expPaletteDecoder',
    motion: 'motionPaletteDecoder',
    sponsorId: 'don-julio',
    duration: '30 min',
    map: { x: 0.13, y: 0.43 },
    accent: '#7A4E8C',
  },
  {
    id: 'barrel-gallery',
    zone: 5,
    name: 'Barrel Gallery',
    subtitle: 'The Art of Aging',
    description: 'Explore the art of aging in oak barrels.',
    longDescription:
      'Tequila barrels become vibrant canvases. Artists use their craft to highlight the deep cultural connection between art and the tequila industry. Add on: pairing dinner + barrel sip.',
    image: 'expBarrelGallery',
    sponsorId: 'herradura',
    duration: '20 min',
    map: { x: 0.298, y: 0.515 },
    accent: '#8A5A2B',
  },
  {
    id: 'la-cava',
    zone: 6,
    name: 'La Cava',
    subtitle: "Beneath Latin America's Oldest Distillery",
    description: 'Descend into the underground tequila vault.',
    longDescription:
      "A recreation of the family cave beneath the distillery. From the bottle shop to barrel sips and the pairing dinner, it's a place untouched by time.",
    image: 'expLaCava',
    sponsorId: 'clase-azul',
    duration: '25 min',
    map: { x: 0.427, y: 0.858 },
    accent: '#6B3A1E',
  },
  {
    id: 'calles-de-noche',
    zone: 7,
    name: 'Calles de Noche',
    subtitle: 'Streets at Night',
    description: 'The magic of Mexican streets after dark.',
    longDescription:
      'With the night as our cover, we slip away from the family cave and onto the shadowy streets of Tequila, with guitars, papel picado and lanterns overhead.',
    image: 'expCallesNoche',
    motion: 'motionCallesNoche',
    sponsorId: 'patron',
    duration: '20 min',
    map: { x: 0.421, y: 0.64 },
    accent: '#2E4A7A',
  },
  {
    id: 'botanas',
    zone: 8,
    name: 'Botanas',
    subtitle: 'Stop for Snacks',
    description: 'Authentic Mexican snacks from a street stand.',
    longDescription:
      'Guests enjoy complimentary snacks from an authentic street stand. The perfect pause between pours.',
    image: 'expBotanas',
    duration: '10 min',
    map: { x: 0.552, y: 0.245 },
    accent: '#D9822B',
  },
  {
    id: 'lazaros-hacienda',
    zone: 9,
    name: "Lázaro's Hacienda",
    subtitle: 'Home of the First Master Distiller',
    description: 'Visit a traditional Mexican estate.',
    longDescription:
      'Welcome to the home of the first master distiller. Marigolds, candlelight and an ofrenda honor the souls that shaped the spirit.',
    pour: '3rd sip',
    image: 'expLazarosHacienda',
    sponsorId: 'gran-centenario',
    duration: '25 min',
    map: { x: 0.495, y: 0.47 },
    accent: '#E07A1F',
  },
  {
    id: 'cristalino-cantina',
    zone: 10,
    name: 'Cristalino Cantina',
    subtitle: 'Portal to the Present Day',
    description: 'Discover the newest style of premium tequila.',
    longDescription:
      'Portal back to the present day, where innovation has shaped tequila\'s future. A vibey, reflective lounge and a full-circle moment reminding you that evolution is beautiful and should be celebrated.',
    pour: '4th sip',
    image: 'expCristalinoCantina',
    motion: 'motionCristalinoCantina',
    sponsorId: 'dobel',
    duration: '30 min',
    map: { x: 0.823, y: 0.78 },
    accent: '#5E8FA3',
  },
  {
    id: 'mercado',
    zone: 11,
    name: 'Mercado',
    subtitle: 'Shop, Sip & Savor',
    description: 'Shop for tequila and Mexican crafts.',
    longDescription:
      'An indoor / outdoor space filled with activations, music, art, food and cocktails. Pick up your shop reservations here, then shop, sip and savor the moment.',
    image: 'expMercado',
    duration: 'Open all day',
    map: { x: 0.693, y: 0.41 },
    accent: '#B5462E',
  },
  {
    id: 'agave-after-dark',
    zone: 12,
    name: 'Agave After Dark',
    subtitle: 'Drink to Remember',
    description: "The festival's electrifying nightlife.",
    longDescription:
      "From day to night, Tequila Town brings a variety of sounds to the main stage as we 'Drink to Remember'.",
    image: 'expAgaveAfterDark',
    sponsorId: 'casamigos',
    duration: 'Until close',
    map: { x: 0.855, y: 0.155 },
    accent: '#3B2A5A',
  },
];

export const experienceById = (id: string) => experiences.find((e) => e.id === id);
