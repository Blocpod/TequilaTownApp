import { Image } from 'expo-image';
import { Lock } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, Text as SvgText, TextPath } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { art, artFor } from '@/theme/art';
import { colors, fonts } from '@/theme/tokens';

/** Five-point star path centred on (cx, cy). */
function starPath(cx: number, cy: number, outer: number, inner = outer * 0.42) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? inner : outer;
    return `${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`;
  });
  return `M${pts.join(' L')} Z`;
}

/** Circular rubber-stamp seal with curved lettering and a drawn star. */
export function InkSeal({ size = 64, color = colors.terracotta, label = 'TEQUILA TOWN' }: { size?: number; color?: string; label?: string }) {
  const r = size / 2;
  const textR = r - 9;
  const ring = `M ${r},${r} m -${textR},0 a ${textR},${textR} 0 1,1 ${textR * 2},0 a ${textR},${textR} 0 1,1 -${textR * 2},0`;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <Path id="ring" d={ring} />
      </Defs>
      <Circle cx={r} cy={r} r={r - 1.5} stroke={color} strokeWidth={2} fill="none" />
      <Circle cx={r} cy={r} r={r - 16} stroke={color} strokeWidth={1.2} fill="none" />
      <SvgText fill={color} fontSize={size * 0.12} fontWeight="700" letterSpacing={1.5}>
        <TextPath href="#ring" startOffset="0%">
          {`${label}   ${label}   `}
        </TextPath>
      </SvgText>
      <Path d={starPath(r, r, size * 0.14)} fill={color} />
    </Svg>
  );
}

type StampProps = {
  image: string;
  title: string;
  collected: boolean;
  width?: number;
  /** deterministic tilt so the page looks hand-stamped */
  seed?: number;
  /** play the "thunk" landing animation */
  animateIn?: boolean;
  sealColor?: string;
};

/** A perforated passport stamp; collected stamps get an ink seal. */
export function PassportStamp({ image, title, collected, width = 150, seed = 0, animateIn = false, sealColor = colors.terracotta }: StampProps) {
  const frame = art.stampFrame;
  const height = (width * frame.height) / frame.width;
  const tilt = ((seed * 37) % 9) - 4;
  const reduce = useReducedMotion();
  const scale = useSharedValue(animateIn && !reduce ? 2.2 : 1);
  const opacity = useSharedValue(animateIn && !reduce ? 0 : 1);

  useEffect(() => {
    if (!animateIn || reduce) return;
    opacity.set(withDelay(150, withTiming(1, { duration: 120 })));
    scale.set(withDelay(150, withSequence(withTiming(0.92, { duration: 220 }), withSpring(1, { damping: 9, stiffness: 260 }))));
  }, [animateIn, reduce, opacity, scale]);

  const seal = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }, { rotate: `${-12 + tilt}deg` }] }));
  const inset = width * 0.075;

  return (
    <View style={{ width, height, transform: [{ rotate: `${tilt * 0.6}deg` }] }} accessibilityLabel={`${title} stamp${collected ? ', collected' : ', not yet collected'}`}>
      <Image source={frame.source} style={StyleSheet.absoluteFill} contentFit="fill" />
      <View style={[styles.window, { top: inset, left: inset, right: inset, bottom: inset }]}>
        <Image source={artFor(image).source} style={[StyleSheet.absoluteFill, { opacity: collected ? 1 : 0.22 }]} contentFit="cover" />
        {!collected ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(232,218,187,0.55)' }]} /> : null}
        <View style={styles.caption}>
          <Text numberOfLines={1} style={[styles.captionText, { fontSize: width * 0.085 }]}>
            {title.toUpperCase()}
          </Text>
        </View>
        {!collected ? (
          <View style={styles.lock}>
            <Lock size={width * 0.14} color={colors.inkMuted} strokeWidth={2.2} />
          </View>
        ) : null}
      </View>
      {collected ? (
        <Animated.View style={[styles.seal, { right: -width * 0.08, top: -width * 0.06 }, seal]} pointerEvents="none">
          <InkSeal size={width * 0.48} color={sealColor} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  window: { position: 'absolute', overflow: 'hidden', backgroundColor: colors.paperDeep },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(43,26,16,0.78)', paddingVertical: 3, paddingHorizontal: 4 },
  captionText: { fontFamily: fonts.display, color: colors.paper, textAlign: 'center', letterSpacing: 0.8 },
  lock: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingBottom: 12 },
  seal: { position: 'absolute', opacity: 0.92 },
});
