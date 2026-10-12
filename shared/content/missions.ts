/**
 * Missions — the passport game. The server validates every step against this file:
 *  - `scan` steps require a signed QR code for `code` (see server/codes.ts + `npm run qr`)
 *  - `quiz` steps require the correct answer index
 *  - `share` steps complete after the native share sheet is used
 *  - `visit` / `taste` / `watch` steps are honor-based check-ins
 * A mission's `requires` list is enforced server-side when starting and completing.
 */
export type MissionStepType = 'visit' | 'scan' | 'taste' | 'watch' | 'share' | 'quiz';

export type MissionStep = {
  id: string;
  type: MissionStepType;
  title: string;
  hint?: string;
  /** scan: the code slug printed on the venue QR (signature appended at print time). */
  code?: string;
  /** quiz */
  question?: string;
  options?: string[];
  answer?: number;
  /** share */
  shareText?: string;
};

export type MissionReward = {
  kind: 'stamp' | 'badge' | 'prize';
  name: string;
  description: string;
};

export type Mission = {
  id: string;
  name: string;
  tagline: string;
  experienceId: string;
  sponsorId?: string;
  points: number;
  requires: string[];
  steps: MissionStep[];
  reward: MissionReward;
};

export const missions: Mission[] = [
  {
    id: 'mission-agave-explorer',
    name: 'Agave Explorer',
    tagline: 'Discover the beauty and history of the blue agave fields.',
    experienceId: 'agave-reflection',
    sponsorId: 'jose-cuervo',
    points: 100,
    requires: [],
    steps: [
      { id: 's1', type: 'visit', title: 'Arrive at Agave Reflection', hint: 'Find the mirrors among the agave.' },
      { id: 's2', type: 'scan', title: 'Scan the QR at the agave shrine', code: 'AGV-SHRINE' },
      {
        id: 's3',
        type: 'quiz',
        title: 'Agave wisdom',
        question: 'Roughly how long does blue Weber agave grow before a jimador harvests it?',
        options: ['1–2 years', '6–8 years', '20+ years'],
        answer: 1,
      },
    ],
    reward: { kind: 'stamp', name: 'Agave Guardian', description: "You've honored the sacred agave." },
  },
  {
    id: 'mission-train-rider',
    name: 'Train Rider',
    tagline: 'Board the Espíritu Express and toast the journey.',
    experienceId: 'espiritu-express',
    sponsorId: '1800-tequila',
    points: 150,
    requires: [],
    steps: [
      { id: 's1', type: 'visit', title: 'Board the Espíritu Express' },
      { id: 's2', type: 'scan', title: 'Scan your boarding pass QR', code: 'EXP-BOARD' },
      { id: 's3', type: 'taste', title: 'Taste the welcome drink' },
      {
        id: 's4',
        type: 'share',
        title: 'Share a moment from the train',
        shareText: 'All aboard the Espíritu Express at Tequila Town 🚂🌵',
      },
    ],
    reward: { kind: 'stamp', name: 'Spirit Traveler', description: "You've journeyed through agave country." },
  },
  {
    id: 'mission-distillery-master',
    name: 'Distillery Master',
    tagline: "Tour the world's oldest active tequila distillery.",
    experienceId: 'la-rojena',
    sponsorId: 'jose-cuervo',
    points: 200,
    requires: [],
    steps: [
      { id: 's1', type: 'visit', title: 'Enter La Rojeña' },
      { id: 's2', type: 'scan', title: 'Scan the QR at the copper stills', code: 'ROJ-STILLS' },
      { id: 's3', type: 'watch', title: 'Watch the distillation story' },
      {
        id: 's4',
        type: 'quiz',
        title: 'Still life',
        question: 'How many times is tequila typically distilled?',
        options: ['Once', 'At least twice', 'Seven times'],
        answer: 1,
      },
      { id: 's5', type: 'taste', title: 'Take your first sip' },
    ],
    reward: { kind: 'badge', name: 'Master Distiller', description: 'You understand the art of tequila making.' },
  },
  {
    id: 'mission-taste-seeker',
    name: 'Taste Seeker',
    tagline: 'Decode the palette of premium tequilas.',
    experienceId: 'palette-decoder',
    sponsorId: 'don-julio',
    points: 175,
    requires: [],
    steps: [
      { id: 's1', type: 'visit', title: 'Join the tasting session' },
      { id: 's2', type: 'taste', title: 'Blanco: bright agave & citrus' },
      { id: 's3', type: 'taste', title: 'Reposado: vanilla & caramel' },
      { id: 's4', type: 'taste', title: 'Añejo: honey, oak & dried fruit' },
      { id: 's5', type: 'scan', title: 'Scan your tasting certificate QR', code: 'PAL-CERT' },
    ],
    reward: { kind: 'badge', name: 'Certified Taster', description: 'Your palate is refined.' },
  },
  {
    id: 'mission-barrel-hunter',
    name: 'Barrel Hunter',
    tagline: 'Explore the aging cellars and their secrets.',
    experienceId: 'barrel-gallery',
    sponsorId: 'herradura',
    points: 125,
    requires: [],
    steps: [
      { id: 's1', type: 'visit', title: 'Enter the Barrel Gallery' },
      { id: 's2', type: 'scan', title: 'Find and scan the golden barrel', code: 'BRL-GOLD' },
      {
        id: 's3',
        type: 'quiz',
        title: 'Oak knowledge',
        question: 'A reposado rests in oak for…',
        options: ['Under 2 months', '2 to 12 months', '3+ years'],
        answer: 1,
      },
    ],
    reward: { kind: 'stamp', name: 'Oak Master', description: "You've discovered the secrets of aging." },
  },
  {
    id: 'mission-cava-keeper',
    name: 'Cava Keeper',
    tagline: 'Access the exclusive underground vault.',
    experienceId: 'la-cava',
    sponsorId: 'clase-azul',
    points: 250,
    requires: [],
    steps: [
      { id: 's1', type: 'visit', title: 'Descend into La Cava' },
      { id: 's2', type: 'scan', title: 'Scan the vault entrance QR', code: 'CAV-VAULT' },
      { id: 's3', type: 'watch', title: "Hear the collector's story" },
      { id: 's4', type: 'taste', title: 'Taste the rare reserve' },
    ],
    reward: { kind: 'prize', name: 'VIP Collector', description: '10% off any bottle at the Mercado.' },
  },
  {
    id: 'mission-night-walker',
    name: 'Night Walker',
    tagline: 'Wander the lantern-lit Calles de Noche.',
    experienceId: 'calles-de-noche',
    sponsorId: 'patron',
    points: 150,
    requires: [],
    steps: [
      { id: 's1', type: 'visit', title: 'Walk the illuminated streets' },
      { id: 's2', type: 'scan', title: 'Scan the QR at the central fountain', code: 'NOC-FOUNT' },
      { id: 's3', type: 'watch', title: 'Catch a street performance' },
      {
        id: 's4',
        type: 'share',
        title: 'Share your night photo',
        shareText: 'Lost in the Calles de Noche at Tequila Town 🌙🏮',
      },
    ],
    reward: { kind: 'stamp', name: 'Noche Explorer', description: "You've captured the night's magic." },
  },
  {
    id: 'mission-hacienda-heritage',
    name: 'Hacienda Heritage',
    tagline: "Honor the legacy of Lázaro's estate.",
    experienceId: 'lazaros-hacienda',
    sponsorId: 'gran-centenario',
    points: 175,
    requires: [],
    steps: [
      { id: 's1', type: 'visit', title: "Enter Lázaro's Hacienda" },
      { id: 's2', type: 'scan', title: 'Scan the QR at the family ofrenda', code: 'LAZ-OFRENDA' },
      {
        id: 's3',
        type: 'quiz',
        title: 'Ofrenda',
        question: 'Which flower lights the way for spirits on an ofrenda?',
        options: ['Marigold (cempasúchil)', 'Rose', 'Lily'],
        answer: 0,
      },
      { id: 's4', type: 'taste', title: 'Take your third sip' },
    ],
    reward: { kind: 'badge', name: 'Heritage Keeper', description: 'You carry the legacy forward.' },
  },
  {
    id: 'mission-cristalino-connoisseur',
    name: 'Cristalino Connoisseur',
    tagline: 'Master the clarity of cristalino.',
    experienceId: 'cristalino-cantina',
    sponsorId: 'dobel',
    points: 200,
    requires: [],
    steps: [
      { id: 's1', type: 'visit', title: 'Step into the Cristalino Cantina' },
      { id: 's2', type: 'scan', title: 'Scan the bar entrance QR', code: 'CRI-BAR' },
      {
        id: 's3',
        type: 'quiz',
        title: 'Crystal clear',
        question: 'How does an aged tequila become a cristalino?',
        options: ['Charcoal filtration', 'Adding water', 'Freezing'],
        answer: 0,
      },
      { id: 's4', type: 'taste', title: 'Complete the cristalino flight' },
    ],
    reward: { kind: 'badge', name: 'Crystal Expert', description: 'You appreciate the clarity of excellence.' },
  },
  {
    id: 'mission-night-owl',
    name: 'Night Owl',
    tagline: 'Own the night at Agave After Dark.',
    experienceId: 'agave-after-dark',
    sponsorId: 'casamigos',
    points: 150,
    requires: [],
    steps: [
      { id: 's1', type: 'visit', title: 'Enter Agave After Dark' },
      { id: 's2', type: 'scan', title: 'Scan the QR at the main stage', code: 'AAD-STAGE' },
      { id: 's3', type: 'taste', title: 'Try the signature cocktail' },
      {
        id: 's4',
        type: 'share',
        title: 'Share a dance-floor moment',
        shareText: 'Drink to remember — Agave After Dark at Tequila Town 🎶🥃',
      },
    ],
    reward: { kind: 'stamp', name: 'Party Legend', description: 'You owned the night.' },
  },
  {
    id: 'mission-grand-collector',
    name: 'Grand Collector',
    tagline: 'Collect every stamp to become a Tequila Town Legend.',
    experienceId: 'mercado',
    points: 500,
    requires: [
      'mission-agave-explorer',
      'mission-train-rider',
      'mission-distillery-master',
      'mission-taste-seeker',
      'mission-barrel-hunter',
      'mission-cava-keeper',
      'mission-night-walker',
      'mission-hacienda-heritage',
      'mission-cristalino-connoisseur',
      'mission-night-owl',
    ],
    steps: [
      { id: 's1', type: 'visit', title: 'Present your passport at the Mercado' },
      { id: 's2', type: 'scan', title: 'Scan the Grand Finale QR', code: 'GRAND-FINALE' },
    ],
    reward: { kind: 'prize', name: 'Tequila Town Legend', description: 'A limited-edition bottle, presented at the Mercado.' },
  },
];

export const missionById = (id: string) => missions.find((m) => m.id === id);
export const missionsForExperience = (experienceId: string) => missions.filter((m) => m.experienceId === experienceId);

/** Lookup a scan step by its printed code slug. */
export function findScanStep(slug: string): { mission: Mission; step: MissionStep } | null {
  for (const mission of missions) {
    for (const step of mission.steps) {
      if (step.type === 'scan' && step.code === slug) return { mission, step };
    }
  }
  return null;
}
