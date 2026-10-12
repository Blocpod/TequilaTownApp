import type { Progress } from '@shared/api';
import { missions, type Mission, type MissionStepType } from '@shared/content/missions';
import { CircleQuestionMark, Eye, Footprints, QrCode, Share2, Wine, type LucideIcon } from 'lucide-react-native';

export type MissionStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export type MissionView = {
  mission: Mission;
  status: MissionStatus;
  done: Set<string>;
  doneCount: number;
  total: number;
  /** index of the next incomplete step, or -1 when all done */
  nextIndex: number;
  missingRequirements: Mission[];
};

export function missionView(mission: Mission, progress: Progress | undefined): MissionView {
  const um = progress?.missions[mission.id];
  const done = new Set(um?.completedSteps ?? []);
  const missingRequirements = mission.requires
    .filter((id) => progress?.missions[id]?.status !== 'completed')
    .map((id) => missions.find((m) => m.id === id)!)
    .filter(Boolean);
  let status: MissionStatus;
  if (um?.status === 'completed') status = 'completed';
  else if (missingRequirements.length > 0) status = 'locked';
  else if (um) status = 'in_progress';
  else status = 'available';
  const nextIndex = mission.steps.findIndex((s) => !done.has(s.id));
  return { mission, status, done, doneCount: done.size, total: mission.steps.length, nextIndex, missingRequirements };
}

export const allMissionViews = (progress: Progress | undefined) => missions.map((m) => missionView(m, progress));

export const completedCount = (progress: Progress | undefined) =>
  Object.values(progress?.missions ?? {}).filter((m) => m.status === 'completed').length;

/** A zone is stamped once any of its missions is complete. */
export const zoneStamped = (zoneId: string, progress: Progress | undefined) =>
  missions.some((m) => m.experienceId === zoneId && progress?.missions[m.id]?.status === 'completed');

export const stepIcon: Record<MissionStepType, LucideIcon> = {
  visit: Footprints,
  scan: QrCode,
  taste: Wine,
  watch: Eye,
  share: Share2,
  quiz: CircleQuestionMark,
};

export const stepVerb: Record<MissionStepType, string> = {
  visit: "I'm here",
  scan: 'Scan',
  taste: 'Tasted',
  watch: 'Watched',
  share: 'Share',
  quiz: 'Answer',
};
