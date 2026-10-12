/**
 * Festival-level configuration. Update this file for each edition — the app's
 * countdown, "live now" state, ticket card and share copy all derive from it.
 *
 * CONFIRM BEFORE STORE SUBMISSION: the MVP listed April 14–17 / 12–10 PM /
 * Factory Town for the 2026 edition; the 2027 dates and contact details below
 * are placeholders carried forward from that.
 */
export const festival = {
  name: 'Tequila Town',
  tagline: 'The Immersive Agave Experience',
  edition: '2027',
  // Local festival days (inclusive). Times are local to the venue.
  startDate: '2027-04-14T12:00:00-04:00',
  endDate: '2027-04-17T22:00:00-04:00',
  dailyHours: '12 PM to 10 PM',
  venue: 'Factory Town',
  ageMinimum: 21,
  supportEmail: 'support@tequilatown.com',
  socials: {
    instagram: 'https://instagram.com/tequilatownfest',
    facebook: 'https://facebook.com/tequilatownfest',
    x: 'https://x.com/tequilatownfest',
  },
} as const;

export type FestivalPhase = 'upcoming' | 'live' | 'ended';

export function festivalPhase(now: Date = new Date()): FestivalPhase {
  const start = new Date(festival.startDate).getTime();
  const end = new Date(festival.endDate).getTime();
  const t = now.getTime();
  if (t < start) return 'upcoming';
  if (t <= end) return 'live';
  return 'ended';
}

/** Levels, from the MVP's progression curve. */
export const levels = [
  { level: 1, title: 'Novice', min: 0 },
  { level: 2, title: 'Explorer', min: 100 },
  { level: 3, title: 'Enthusiast', min: 300 },
  { level: 4, title: 'Connoisseur', min: 600 },
  { level: 5, title: 'Expert', min: 1000 },
  { level: 6, title: 'Legend', min: 1500 },
] as const;

export type LevelInfo = {
  level: number;
  title: string;
  min: number;
  next: number | null;
  /** 0..1 progress toward the next level (1 at max level). */
  progress: number;
};

export function levelFor(points: number): LevelInfo {
  let idx = 0;
  for (let i = 0; i < levels.length; i++) if (points >= levels[i].min) idx = i;
  const cur = levels[idx];
  const nxt = levels[idx + 1];
  const progress = nxt ? Math.min(1, (points - cur.min) / (nxt.min - cur.min)) : 1;
  return { level: cur.level, title: cur.title, min: cur.min, next: nxt ? nxt.min : null, progress };
}

/** Points awarded outside of missions. */
export const bonusPoints = {
  ticketClaim: 100,
  ritualComplete: 50,
} as const;
