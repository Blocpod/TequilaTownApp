import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Award, Check, Gift, Lock, QrCode, Stamp } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { experienceById } from '@shared/content/experiences';
import { missionById, type MissionStep } from '@shared/content/missions';
import { sponsorById } from '@shared/content/sponsors';

import { PassportStamp } from '@/components/art/stamp';
import { SignInGate } from '@/components/sign-in-gate';
import { Button } from '@/components/ui/button';
import { PrintCard } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressBar } from '@/components/ui/progress';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { MissionCelebration } from '@/features/missions/celebration';
import { missionView, stepIcon, stepVerb } from '@/features/missions/logic';
import { api, errorMessage, isApiError } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useMe, useSetProgress } from '@/lib/queries';
import { shareText } from '@/lib/share';
import { useIsSignedIn } from '@/state/session';
import { artFor } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

const rewardIcon = { stamp: Stamp, badge: Award, prize: Gift } as const;

function QuizOptions({ step, onAnswer, busy }: { step: MissionStep; onAnswer: (i: number) => Promise<boolean>; busy: boolean }) {
  const [wrong, setWrong] = useState<number | null>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
  return (
    <Animated.View style={[{ gap: 8, marginTop: 10 }, shakeStyle]}>
      <Text variant="bodyStrong">{step.question}</Text>
      {step.options?.map((opt, i) => (
        <PressableScale
          key={opt}
          disabled={busy}
          onPress={async () => {
            const ok = await onAnswer(i);
            if (!ok) {
              setWrong(i);
              shake.set(withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 })));
            }
          }}
          accessibilityLabel={opt}
          style={[styles.option, wrong === i && { borderColor: colors.danger, backgroundColor: '#F8E0DC' }]}
        >
          <Text style={styles.optionLetter}>{String.fromCharCode(65 + i)}</Text>
          <Text variant="body" color={colors.ink} style={{ flex: 1 }}>
            {opt}
          </Text>
        </PressableScale>
      ))}
    </Animated.View>
  );
}

export default function MissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mission = missionById(id);
  const insets = useSafeAreaInsets();
  const signedIn = useIsSignedIn();
  const { data } = useMe();
  const setProgress = useSetProgress();
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [celebrate, setCelebrate] = useState<{ points: number } | null>(null);

  if (!mission) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <PaperBackground />
        <TopBar leading="close" />
        <EmptyState title="Mission not found" />
      </View>
    );
  }

  const zone = experienceById(mission.experienceId);
  const sponsor = mission.sponsorId ? sponsorById(mission.sponsorId) : undefined;
  const view = missionView(mission, data?.progress);
  const RewardIcon = rewardIcon[mission.reward.kind];
  const allDone = view.doneCount === view.total;

  const runStep = async (step: MissionStep, extra: { code?: string; answer?: number } = {}): Promise<boolean> => {
    setBusyStep(step.id);
    try {
      const progress = await api.completeStep({ missionId: mission.id, stepId: step.id, ...extra });
      setProgress(progress);
      haptic.success();
      return true;
    } catch (e) {
      if (isApiError(e) && e.code === 'WRONG_ANSWER') {
        haptic.error();
        toast.error('Not quite', 'Give it another think — no penalty.');
      } else if (isApiError(e) && e.code === 'LOCKED') {
        toast.error('Locked', 'Finish the required missions first.');
      } else {
        toast.error('Could not save that step', errorMessage(e));
      }
      return false;
    } finally {
      setBusyStep(null);
    }
  };

  const act = async (step: MissionStep) => {
    if (step.type === 'scan') {
      router.push({ pathname: '/scan', params: { missionId: mission.id, stepId: step.id, title: step.title } });
      return;
    }
    if (step.type === 'share') {
      const shared = await shareText(step.shareText ?? `Exploring ${zone?.name} at Tequila Town 🌵`);
      if (shared) await runStep(step);
      return;
    }
    await runStep(step);
  };

  const claim = async () => {
    setClaiming(true);
    try {
      const res = await api.completeMission(mission.id);
      setProgress(res.progress);
      setCelebrate({ points: res.pointsAwarded });
    } catch (e) {
      toast.error('Could not complete the mission', errorMessage(e));
    } finally {
      setClaiming(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar leading="close" tone="glass" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 230 }}>
          <Image source={artFor(zone?.image).source} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(18,14,12,0.5)', 'rgba(18,14,12,0.1)', colors.paper]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        </View>

        <View style={styles.body}>
          <View style={{ gap: 2 }}>
            <Text variant="lede" color={colors.terracotta}>
              {zone ? `Zone ${zone.zone} · ${zone.name}` : 'The Grand Finale'}
            </Text>
            <Text variant="display" accessibilityRole="header">
              {mission.name.toUpperCase()}
            </Text>
            <Text variant="body">{mission.tagline}</Text>
          </View>

          <PrintCard background={colors.cardWarm} contentStyle={styles.reward}>
            <View style={styles.rewardIcon}>
              <RewardIcon size={24} color={colors.terracotta} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{mission.reward.kind === 'prize' ? 'Prize' : mission.reward.kind === 'badge' ? 'Badge' : 'Stamp'}</Text>
              <Text variant="subheading">{mission.reward.name}</Text>
              <Text variant="small">{mission.reward.description}</Text>
            </View>
            <Text style={styles.pts}>+{mission.points}</Text>
          </PrintCard>
          {sponsor ? <Text variant="small">Presented by {sponsor.name}</Text> : null}

          {!signedIn ? (
            <SignInGate message="Create a free passport to track missions, scan codes and collect this stamp." />
          ) : view.status === 'locked' ? (
            <PrintCard contentStyle={{ padding: 16, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Lock size={18} color={colors.inkSoft} />
                <Text variant="subheading">Locked</Text>
              </View>
              <Text variant="body">Complete these first:</Text>
              {view.missingRequirements.map((m) => (
                <PressableScale key={m.id} onPress={() => router.replace({ pathname: '/mission/[id]', params: { id: m.id } })} style={styles.req} accessibilityLabel={m.name}>
                  <Text variant="bodyStrong">{m.name}</Text>
                  <Text variant="small">+{m.points}</Text>
                </PressableScale>
              ))}
            </PrintCard>
          ) : view.status === 'completed' ? (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
              <PassportStamp image={zone?.image ?? 'expMercado'} title={mission.reward.name} collected width={220} seed={5} />
              <Text variant="lede" align="center">
                Stamped {data?.progress.missions[mission.id]?.completedAt ? new Date(data.progress.missions[mission.id].completedAt!).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : ''}
              </Text>
            </View>
          ) : (
            <>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="label">Progress</Text>
                  <Text variant="label" color={colors.ink}>
                    {view.doneCount} / {view.total} steps
                  </Text>
                </View>
                <ProgressBar value={view.doneCount / view.total} />
              </View>

              <View style={{ gap: 12 }}>
                {mission.steps.map((step, i) => {
                  const done = view.done.has(step.id);
                  const current = !done && i === view.nextIndex;
                  const Icon = stepIcon[step.type];
                  return (
                    <Animated.View key={step.id} layout={LinearTransition.springify()} entering={FadeInDown.delay(i * 50).springify()}>
                      <PrintCard
                        offset={current ? 4 : 0}
                        background={done ? '#E3EBDD' : colors.card}
                        borderColor={current ? colors.ink : done ? colors.agave : colors.inkFaint}
                        contentStyle={styles.step}
                      >
                        <View style={styles.stepHead}>
                          <View style={[styles.stepIcon, { backgroundColor: done ? colors.agave : current ? colors.terracotta : colors.paperDeep }]}>
                            {done ? <Check size={16} color={colors.card} strokeWidth={3} /> : <Icon size={16} color={current ? colors.card : colors.inkSoft} strokeWidth={2.4} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text variant="bodyStrong" style={done ? { textDecorationLine: 'line-through', color: colors.inkMuted } : null}>
                              {step.title}
                            </Text>
                            {step.hint && !done ? <Text variant="small">{step.hint}</Text> : null}
                          </View>
                          {!done && step.type !== 'quiz' ? (
                            <Button
                              label={stepVerb[step.type]}
                              icon={step.type === 'scan' ? QrCode : undefined}
                              size="sm"
                              variant={current ? 'primary' : 'secondary'}
                              loading={busyStep === step.id}
                              onPress={() => act(step)}
                            />
                          ) : null}
                        </View>
                        {!done && step.type === 'quiz' ? <QuizOptions step={step} busy={busyStep === step.id} onAnswer={(answer) => runStep(step, { answer })} /> : null}
                      </PrintCard>
                    </Animated.View>
                  );
                })}
              </View>

              <Button label={allDone ? 'Claim your stamp' : `${view.total - view.doneCount} step${view.total - view.doneCount === 1 ? '' : 's'} to go`} icon={Stamp} disabled={!allDone} loading={claiming} onPress={claim} full />
            </>
          )}
        </View>
      </ScrollView>
      <MissionCelebration mission={celebrate ? mission : null} points={celebrate?.points ?? 0} onClose={() => setCelebrate(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: gutter, gap: 18, marginTop: -40 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rewardIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  pts: { fontFamily: fonts.serifBlack, fontSize: 24, color: colors.terracotta },
  req: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: radii.md, borderWidth: 1.2, borderColor: colors.inkFaint, backgroundColor: colors.paper },
  step: { padding: 12 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.paper },
  optionLetter: { width: 26, height: 26, borderRadius: 13, textAlign: 'center', lineHeight: 26, fontFamily: fonts.sansBold, fontSize: 13, color: colors.card, backgroundColor: colors.ink, overflow: 'hidden' },
});
