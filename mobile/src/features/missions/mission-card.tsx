import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Award, Check, Gift, Lock, Stamp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { experienceById } from '@shared/content/experiences';

import { PressCard } from '@/components/ui/card';
import { Tag } from '@/components/ui/chip';
import { ProgressBar } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { artFor } from '@/theme/art';
import { colors, fonts, radii } from '@/theme/tokens';

import type { MissionView } from './logic';

const rewardIcon = { stamp: Stamp, badge: Award, prize: Gift } as const;

/** Mission summary row: status, reward, progress. */
export function MissionCard({ view }: { view: MissionView }) {
  const { mission, status, doneCount, total } = view;
  const zone = experienceById(mission.experienceId);
  const img = artFor(zone?.image);
  const RewardIcon = rewardIcon[mission.reward.kind];
  const locked = status === 'locked';
  const done = status === 'completed';

  return (
    <PressCard
      onPress={() => router.push({ pathname: '/mission/[id]', params: { id: mission.id } })}
      accessibilityLabel={`${mission.name}. ${status.replace('_', ' ')}. ${mission.points} points.`}
      background={done ? colors.cardWarm : colors.card}
      contentStyle={styles.card}
    >
      <View style={styles.thumbWrap}>
        <Image source={img.source} placeholder={img.blurhash ? { blurhash: img.blurhash } : undefined} style={[styles.thumb, locked && { opacity: 0.35 }]} contentFit="cover" />
        <View style={[styles.status, { backgroundColor: done ? colors.agave : locked ? colors.inkMuted : colors.terracotta }]}>
          {done ? <Check size={13} color={colors.card} strokeWidth={3} /> : locked ? <Lock size={12} color={colors.card} strokeWidth={2.6} /> : <Text style={styles.statusNum}>{zone?.zone ?? '★'}</Text>}
        </View>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {mission.name.toUpperCase()}
          </Text>
          <Text style={styles.points}>+{mission.points}</Text>
        </View>
        <Text variant="small" numberOfLines={2}>
          {locked ? `Complete ${view.missingRequirements.length} more mission${view.missingRequirements.length === 1 ? '' : 's'} to unlock.` : mission.tagline}
        </Text>
        {status === 'in_progress' ? (
          <View style={styles.progressRow}>
            <ProgressBar value={doneCount / total} height={9} style={{ flex: 1 }} />
            <Text variant="small" style={{ fontFamily: fonts.sansBold }}>
              {doneCount}/{total}
            </Text>
          </View>
        ) : (
          <View style={styles.rewardRow}>
            <RewardIcon size={13} color={done ? colors.agave : colors.inkMuted} strokeWidth={2.4} />
            <Text variant="small" color={done ? colors.agave : colors.inkMuted} style={{ fontFamily: fonts.sansSemiBold }} numberOfLines={1}>
              {mission.reward.name}
            </Text>
            {done ? <Tag label="Earned" color={colors.agave} textColor={colors.card} style={{ marginLeft: 'auto' }} /> : null}
          </View>
        )}
      </View>
    </PressCard>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  thumbWrap: { width: 72, height: 72 },
  thumb: { width: 72, height: 72, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.ink },
  status: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusNum: { fontFamily: fonts.display, fontSize: 13, color: colors.card, marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontFamily: fonts.display, fontSize: 17, lineHeight: 19, letterSpacing: 0.7, color: colors.ink, marginTop: 2 },
  points: { fontFamily: fonts.serifBlack, fontSize: 15, color: colors.terracotta },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
});
