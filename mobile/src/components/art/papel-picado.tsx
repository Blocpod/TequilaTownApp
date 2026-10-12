import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/tokens';

const FLAG_W = 40;
const FLAG_H = 50;

const circle = (cx: number, cy: number, r: number) => `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0 Z`;

const outline = (() => {
  let d = `M0,0 H${FLAG_W} V40`;
  for (let x = FLAG_W; x > 0; x -= 5) d += ` L${x - 2.5},${x % 10 === 0 ? 47 : 44} L${x - 5},40`;
  return `${d} Z`;
})();

/** Three cut-paper motifs; holes punched with the even-odd rule. */
const motifs = [
  // flower + corner dots
  [circle(20, 20, 4), circle(20, 11, 3.2), circle(20, 29, 3.2), circle(11, 20, 3.2), circle(29, 20, 3.2), circle(6, 6, 2), circle(34, 6, 2), circle(6, 34, 2), circle(34, 34, 2)].join(' '),
  // diamond lattice
  ['M20,7 L28,19 L20,31 L12,19 Z', 'M20,14 L24,19 L20,24 L16,19 Z', circle(7, 35, 2.2), circle(33, 35, 2.2), 'M4,6 L10,6 L7,11 Z', 'M30,6 L36,6 L33,11 Z'].join(' '),
  // sun + rays
  [circle(20, 19, 6), 'M20,4 L22,9 L18,9 Z', 'M20,34 L22,29 L18,29 Z', 'M5,19 L10,17 L10,21 Z', 'M35,19 L30,17 L30,21 Z', circle(8, 7, 1.8), circle(32, 7, 1.8), circle(8, 32, 1.8), circle(32, 32, 1.8)].join(' '),
];

const palette = [colors.terracotta, colors.sun, colors.agave, colors.blushDeep, colors.sky, colors.marigold, '#7A4E8C'];

function Flag({ index, color, sway }: { index: number; color: string; sway: boolean }) {
  const r = useSharedValue(0);
  useEffect(() => {
    if (!sway) return;
    const amp = 3 + (index % 3);
    r.set(
      withDelay(
        index * 140,
        withRepeat(withSequence(withTiming(amp, { duration: 1600 + index * 37, easing: Easing.inOut(Easing.sin) }), withTiming(-amp, { duration: 1600 + index * 37, easing: Easing.inOut(Easing.sin) })), -1, true),
      ),
    );
  }, [index, r, sway]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -FLAG_H / 2 }, { rotate: `${r.get()}deg` }, { translateY: FLAG_H / 2 }],
  }));
  return (
    <Animated.View style={[{ width: FLAG_W, height: FLAG_H }, style]}>
      <Svg width={FLAG_W} height={FLAG_H} viewBox={`0 0 ${FLAG_W} ${FLAG_H}`}>
        <Path d={`${outline} ${motifs[index % motifs.length]}`} fill={color} fillRule="evenodd" />
      </Svg>
    </Animated.View>
  );
}

type Props = { width: number; style?: StyleProp<ViewStyle>; colorsOverride?: string[]; offset?: number };

/** A string of swaying papel picado flags — the festival's signature ornament. */
export function PapelPicado({ width, style, colorsOverride, offset = 0 }: Props) {
  const reduce = useReducedMotion();
  const count = Math.max(3, Math.floor(width / (FLAG_W + 6)));
  const gap = (width - count * FLAG_W) / (count + 1);
  const cols = colorsOverride ?? palette;
  return (
    <View style={[{ width, height: FLAG_H + 8 }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Svg width={width} height={10} style={StyleSheet.absoluteFill}>
        <Path d={`M0,3 Q${width / 2},9 ${width},3`} stroke={colors.ink} strokeWidth={1.2} fill="none" opacity={0.7} />
      </Svg>
      <View style={{ flexDirection: 'row', paddingHorizontal: gap, gap, paddingTop: 4 }}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={{ marginTop: Math.sin((i / Math.max(1, count - 1)) * Math.PI) * 4 }}>
            <Flag index={i + offset} color={cols[(i + offset) % cols.length]} sway={!reduce} />
          </View>
        ))}
      </View>
    </View>
  );
}
