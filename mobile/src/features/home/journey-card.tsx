import { router } from 'expo-router';
import { ArrowRight, Sparkles, Ticket } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { missions } from '@shared/content/missions';

import { Button } from '@/components/ui/button';
import { PrintCard, PressCard } from '@/components/ui/card';
import { ProgressRing } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/states';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { allMissionViews, completedCount } from '@/features/missions/logic';
import { useMe } from '@/lib/queries';
import { useIsSignedIn } from '@/state/session';
import { colors, fonts } from '@/theme/tokens';

/** Passport progress at a glance, with the next best action. */
export function JourneyCard() {
  const signedIn = useIsSignedIn();
  const { data, isLoading } = useMe();

  if (!signedIn) {
    return (
      <PrintCard background={colors.blush} contentStyle={styles.pad}>
        <Text variant="lede" color={colors.terracotta}>
          Your passport awaits
        </Text>
        <Text variant="title">COLLECT ALL 11 STAMPS</Text>
        <Text variant="body" style={{ marginVertical: 8 }}>
          Create a free passport to complete missions, claim your ticket and unlock the Oracle.
        </Text>
        <Button label="Create passport" icon={Sparkles} onPress={() => router.push('/auth/sign-up')} size="md" />
      </PrintCard>
    );
  }

  if (isLoading || !data) {
    return (
      <PrintCard contentStyle={[styles.pad, { gap: 10 }]}>
        <Skeleton height={20} width="50%" />
        <Skeleton height={60} />
      </PrintCard>
    );
  }

  const { progress } = data;
  const views = allMissionViews(progress);
  const next = views.find((v) => v.status === 'in_progress') ?? views.find((v) => v.status === 'available');
  const stamps = completedCount(progress);

  return (
    <View style={{ gap: 14 }}>
      <PrintCard contentStyle={styles.pad}>
        <PressableScale onPress={() => router.push('/passport')} pressedScale={0.98} accessibilityLabel={`Open passport. Level ${progress.level.level}, ${progress.points} points, ${stamps} stamps`} style={styles.row}>
          <ProgressRing value={progress.level.progress} size={84} stroke={8}>
            <Text style={styles.levelNum}>{progress.level.level}</Text>
            <Text style={styles.levelLbl}>LEVEL</Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label">Your passport</Text>
            <Text variant="title">{progress.level.title.toUpperCase()}</Text>
            <Text variant="body">
              <Text variant="bodyStrong">{progress.points.toLocaleString()}</Text> pts,{' '}
              <Text variant="bodyStrong">
                {stamps}/{missions.length}
              </Text>{' '}
              stamps
            </Text>
            {progress.level.next ? (
              <Text variant="small">{(progress.level.next - progress.points).toLocaleString()} pts to the next level</Text>
            ) : (
              <Text variant="small">Maximum level. You are legend.</Text>
            )}
          </View>
        </PressableScale>
        {next ? (
          <View style={styles.next}>
            <View style={{ flex: 1 }}>
              <Text variant="label" color={colors.terracotta}>
                {next.status === 'in_progress' ? 'Continue mission' : 'Next mission'}
              </Text>
              <Text variant="subheading" numberOfLines={1}>
                {next.mission.name}
              </Text>
            </View>
            <Button
              label={next.status === 'in_progress' ? `${next.doneCount}/${next.total}` : 'Start'}
              iconRight={ArrowRight}
              size="sm"
              onPress={() => router.push({ pathname: '/mission/[id]', params: { id: next.mission.id } })}
            />
          </View>
        ) : null}
      </PrintCard>

      {!progress.ticket ? (
        <PressCard onPress={() => router.push('/ticket')} background={colors.sun} accessibilityLabel="Claim your ticket for 100 points" contentStyle={[styles.pad, styles.ticketRow]}>
          <Ticket size={28} color={colors.ink} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ticketTitle}>CLAIM YOUR TICKET</Text>
            <Text variant="small" color={colors.inkSoft}>
              Link your festival ticket for 100 bonus points
            </Text>
          </View>
          <ArrowRight size={20} color={colors.ink} />
        </PressCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  levelNum: { fontFamily: fonts.serifBlack, fontSize: 28, lineHeight: 32, color: colors.ink },
  levelLbl: { fontFamily: fonts.sansBold, fontSize: 8.5, letterSpacing: 1.4, color: colors.inkMuted },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 14, borderTopWidth: 1.2, borderStyle: 'dashed', borderColor: colors.inkFaint },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ticketTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, letterSpacing: 0.8, color: colors.ink, marginTop: 2 },
});
