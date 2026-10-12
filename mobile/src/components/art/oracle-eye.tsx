import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { colors } from '@/theme/tokens';

const ALMOND = 'M28,100 Q100,38 172,100 Q100,162 28,100 Z';

/** The Oracle's eye: slowly turning sun rays, a lid that blinks, an iris that wanders. */
export function OracleEye({ size = 160, color = colors.blush, iris = colors.sun }: { size?: number; color?: string; iris?: string }) {
  const reduce = useReducedMotion();
  const blink = useSharedValue(1);
  const look = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    blink.set(
      withRepeat(
        withSequence(
          withDelay(3200, withTiming(0.06, { duration: 110 })),
          withTiming(1, { duration: 160 }),
          withDelay(900, withTiming(0.06, { duration: 90 })),
          withTiming(1, { duration: 140 }),
        ),
        -1,
      ),
    );
    look.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withDelay(600, withTiming(-1, { duration: 1800, easing: Easing.inOut(Easing.sin) })),
          withDelay(500, withTiming(0, { duration: 1200 })),
        ),
        -1,
      ),
    );
    spin.set(withRepeat(withTiming(1, { duration: 60000, easing: Easing.linear }), -1));
  }, [reduce, blink, look, spin]);

  const unit = size / 200;
  const lid = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.get() }] }));
  const irisStyle = useAnimatedStyle(() => ({ transform: [{ translateX: look.get() * 9 * unit }, { translateY: -Math.abs(look.get()) * 1.5 * unit }] }));
  const rays = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }] }));
  const layer = { position: 'absolute' as const, width: size, height: size };

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[layer, rays]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2;
            const r1 = i % 2 ? 78 : 72;
            const r2 = i % 2 ? 90 : 98;
            return (
              <Line
                key={i}
                x1={100 + Math.cos(a) * r1}
                y1={100 + Math.sin(a) * r1}
                x2={100 + Math.cos(a) * r2}
                y2={100 + Math.sin(a) * r2}
                stroke={color}
                strokeWidth={i % 2 ? 2 : 3}
                strokeLinecap="round"
                opacity={0.75}
              />
            );
          })}
        </Svg>
      </Animated.View>
      <Animated.View style={[layer, lid]}>
        <Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
          <Path d={ALMOND} fill={colors.night} />
        </Svg>
        <Animated.View style={[layer, irisStyle]}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Circle cx={100} cy={100} r={27} fill={iris} stroke={color} strokeWidth={3} />
            <Circle cx={100} cy={100} r={12} fill={colors.night} />
            <Circle cx={108} cy={91} r={5} fill={colors.card} opacity={0.9} />
          </Svg>
        </Animated.View>
        <Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
          <Path d={ALMOND} fill="none" stroke={color} strokeWidth={5} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}
