import { router } from 'expo-router';
import { ArrowRight, Check, ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ritual, type RitualAnswers } from '@shared/content/ritual';

import { OracleEye } from '@/components/art/oracle-eye';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { PaperBackground } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useMe, useSetProgress } from '@/lib/queries';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

export default function Ritual() {
  const insets = useSafeAreaInsets();
  const { data } = useMe();
  const setProgress = useSetProgress();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [answers, setAnswers] = useState<RitualAnswers>(() => data?.progress.ritual?.answers ?? {});
  const [submitting, setSubmitting] = useState(false);

  const q = ritual[step];
  const current = answers[q?.id];
  const selected = new Set(Array.isArray(current) ? current : current ? [current] : []);
  const last = step === ritual.length - 1;

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(to);
  };

  const submit = async (final: RitualAnswers) => {
    setSubmitting(true);
    try {
      const res = await api.submitRitual({ answers: final });
      setProgress(res.progress);
      haptic.success();
      if (res.pointsAwarded) toast.reward(`+${res.pointsAwarded} points`, 'The Ritual is complete.');
      router.replace({ pathname: '/persona', params: { fresh: '1' } });
    } catch (e) {
      setSubmitting(false);
      toast.error('The Oracle could not read you', errorMessage(e));
    }
  };

  const next = (a: RitualAnswers) => (last ? void submit(a) : go(step + 1));

  const choose = (value: string) => {
    if (q.kind === 'single') {
      const a = { ...answers, [q.id]: value };
      setAnswers(a);
      haptic.tap();
      setTimeout(() => next(a), 260);
      return;
    }
    const arr = new Set(selected);
    if (arr.has(value)) arr.delete(value);
    else if (arr.size < (q.max ?? 99)) arr.add(value);
    else return haptic.warning();
    haptic.tap();
    setAnswers({ ...answers, [q.id]: [...arr] });
  };

  if (submitting) {
    return (
      <View style={styles.reading}>
        <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center', gap: 14 }}>
          <OracleEye size={190} />
          <Text variant="lede" color={colors.blush} align="center">
            The Oracle is reading your spirit
          </Text>
          <Text variant="small" color="rgba(243,233,210,0.55)" align="center">
            Choosing your pours, your zones, your signature cocktail.
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        {step > 0 ? <IconButton icon={ChevronLeft} label="Previous question" onPress={() => go(step - 1)} /> : <View style={{ width: 44 }} />}
        <View style={styles.dots} accessibilityLabel={`Question ${step + 1} of ${ritual.length}`}>
          {ritual.map((r, i) => (
            <View key={r.id} style={[styles.dot, i < step && { backgroundColor: colors.agave }, i === step && { backgroundColor: colors.terracotta, width: 22 }]} />
          ))}
        </View>
        <PressableScale onPress={() => router.back()} accessibilityLabel="Skip for now" style={{ padding: 8 }}>
          <Text style={styles.skip}>Later</Text>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 18, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <Animated.View entering={FadeInDown.springify()} style={{ marginBottom: 18 }}>
            <Text variant="lede" color={colors.terracotta}>
              The Tequila Town Ritual
            </Text>
            <Text variant="body">Seven quick taps. The Oracle reads your answers and reveals your agave persona and the pours you&apos;ll love.</Text>
          </Animated.View>
        ) : null}
        <Animated.View key={q.id} entering={(dir > 0 ? SlideInRight : SlideInLeft).springify().damping(20)} exiting={(dir > 0 ? SlideOutLeft : SlideOutRight).duration(160)} style={{ gap: 16 }}>
          <Text variant="label">
            Question {step + 1} of {ritual.length}
            {q.kind === 'multi' ? `, choose up to ${q.max}` : ''}
          </Text>
          <Text variant="heading" style={{ fontSize: 26, lineHeight: 32 }} accessibilityRole="header">
            {q.prompt}
          </Text>
          <View style={{ gap: 10 }}>
            {q.options.map((o) => {
              const on = selected.has(o.value);
              return (
                <PressableScale
                  key={o.value}
                  onPress={() => choose(o.value)}
                  hapticOnPress="none"
                  accessibilityRole={q.kind === 'multi' ? 'checkbox' : 'radio'}
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={o.label}
                  style={[styles.option, on && styles.optionOn]}
                >
                  <Text style={styles.emoji}>{o.emoji}</Text>
                  <Text style={[styles.optionText, on && { color: colors.paper }]}>{o.label}</Text>
                  {on ? (
                    <View style={styles.check}>
                      <Check size={14} color={colors.ink} strokeWidth={3} />
                    </View>
                  ) : null}
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      {q.kind === 'multi' ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button label={last ? 'Reveal my persona' : 'Continue'} iconRight={ArrowRight} disabled={selected.size === 0} onPress={() => next(answers)} full />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  reading: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center', padding: gutter },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter - 4 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.inkFaint, borderWidth: 1, borderColor: colors.ink },
  skip: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.inkSoft },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 60, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.card },
  optionOn: { backgroundColor: colors.ink },
  emoji: { fontSize: 24 },
  optionText: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 16.5, color: colors.ink, paddingVertical: 14 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: gutter, paddingTop: 12, backgroundColor: 'rgba(243,233,210,0.96)' },
});
