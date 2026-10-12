import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme/tokens';

const COLORS = [colors.terracotta, colors.sun, colors.agave, colors.blushDeep, colors.sky, colors.marigold, '#7A4E8C', colors.cristal];

type Piece = { x: number; drift: number; delay: number; duration: number; rotate: number; w: number; h: number; color: string; round: boolean };

function makePieces(n: number, width: number): Piece[] {
  // Seeded so a given burst is stable across re-renders.
  let s = 7;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () => ({
    x: rand() * width,
    drift: (rand() - 0.5) * 140,
    delay: rand() * 380,
    duration: 1900 + rand() * 1400,
    rotate: (rand() - 0.5) * 900,
    w: 7 + rand() * 9,
    h: 9 + rand() * 12,
    color: COLORS[Math.floor(rand() * COLORS.length)],
    round: rand() > 0.75,
  }));
}

function Bit({ p, height, fire }: { p: Piece; height: number; fire: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!fire) return;
    t.set(0);
    t.set(withDelay(p.delay, withTiming(1, { duration: p.duration, easing: Easing.out(Easing.quad) })));
  }, [fire, p.delay, p.duration, t]);
  const style = useAnimatedStyle(() => {
    const v = t.get();
    return {
      opacity: v === 0 ? 0 : v > 0.85 ? (1 - v) / 0.15 : 1,
      transform: [
        { translateX: p.x + p.drift * v },
        { translateY: -40 + (height + 80) * v },
        { rotate: `${p.rotate * v}deg` },
        { rotateY: `${v * 720}deg` },
      ],
    };
  });
  return <Animated.View style={[styles.bit, { width: p.w, height: p.round ? p.w : p.h, borderRadius: p.round ? p.w : 1.5, backgroundColor: p.color }, style]} />;
}

/** Festive papel confetti. Change `fire` (e.g. Date.now()) to trigger a burst. */
export function Confetti({ fire, count = 46 }: { fire: number; count?: number }) {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const pieces = useMemo(() => makePieces(count, width), [count, width]);
  if (reduce || !fire) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Bit key={i} p={p} height={height} fire={fire} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bit: { position: 'absolute', top: 0, left: 0 },
});
