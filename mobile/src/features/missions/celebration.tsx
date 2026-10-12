import { useEffect, useState } from 'react';
import { Modal, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';

import type { Mission } from '@shared/content/missions';
import { experienceById } from '@shared/content/experiences';

import { Confetti } from '@/components/art/confetti';
import { PassportStamp } from '@/components/art/stamp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { haptic } from '@/lib/haptics';
import { colors, fonts, gutter } from '@/theme/tokens';

function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / 900);
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [to]);
  return <Text style={styles.points}>+{n}</Text>;
}

type Props = { mission: Mission | null; points: number; onClose: () => void };

/** Full-screen reward moment: stamp thunk, confetti, points count-up. */
export function MissionCelebration({ mission, points, onClose }: Props) {
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!mission) return;
    const t = setTimeout(() => haptic.thunk(), 330);
    const t2 = setTimeout(() => haptic.success(), 600);
    glow.set(0);
    glow.set(withDelay(300, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })));
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [mission, glow]);
  const halo = useAnimatedStyle(() => ({ opacity: glow.get() * 0.9, transform: [{ scale: 0.6 + glow.get() * 0.6 }] }));

  if (!mission) return null;
  const zone = experienceById(mission.experienceId);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={styles.backdrop}>
        <Animated.View style={[styles.halo, halo]} />
        <Text variant="lede" color={colors.blush} align="center">
          ¡Felicidades!
        </Text>
        <Text variant="display" color={colors.paper} align="center" style={{ marginBottom: 18 }}>
          MISSION COMPLETE
        </Text>
        <PassportStamp image={zone?.image ?? 'expMercado'} title={mission.reward.name} collected animateIn width={230} seed={3} />
        <Animated.View entering={FadeInDown.delay(650).springify()} style={{ alignItems: 'center', marginTop: 22, gap: 4 }}>
          {points > 0 ? <CountUp to={points} /> : null}
          <Text variant="subheading" color={colors.paper} align="center">
            {mission.reward.name}
          </Text>
          <Text variant="body" color="rgba(243,233,210,0.75)" align="center" style={{ maxWidth: 300 }}>
            {mission.reward.description}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(900).springify()} style={{ marginTop: 28 }}>
          <Button label="Stamp my passport" variant="blush" onPress={onClose} />
        </Animated.View>
        {/* the overlay mounts fresh for every celebration, so confetti fires on mount */}
        <Confetti fire={1} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center', padding: gutter },
  halo: { position: 'absolute', width: 380, height: 380, borderRadius: 190, backgroundColor: 'rgba(242,165,65,0.16)' },
  points: { fontFamily: fonts.serifBlack, fontSize: 46, lineHeight: 52, color: colors.sun },
});
