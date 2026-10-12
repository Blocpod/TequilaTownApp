import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type BarProps = { value: number; color?: string; track?: string; height?: number; style?: StyleProp<ViewStyle> };

/** Ink-bordered progress bar that eases to its value. */
export function ProgressBar({ value, color = colors.terracotta, track = colors.card, height = 12, style }: BarProps) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withTiming(Math.max(0, Math.min(1, value)), { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [value, v]);
  const fill = useAnimatedStyle(() => ({ width: `${v.get() * 100}%` }));
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: track }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Animated.View style={[{ height: '100%', backgroundColor: color, borderRadius: height / 2 }, fill]} />
    </View>
  );
}

type RingProps = { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode };

/** Circular progress (passport completion, level). */
export function ProgressRing({ value, size = 96, stroke = 9, color = colors.terracotta, track = colors.inkFaint, children }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withTiming(Math.max(0, Math.min(1, value)), { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [value, v]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - v.get()) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          animatedProps={props}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderWidth: 1.5, borderColor: colors.ink, overflow: 'hidden' },
});
