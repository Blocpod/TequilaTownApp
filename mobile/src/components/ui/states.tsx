import { Image } from 'expo-image';
import { RefreshCw } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { art, type ArtKey } from '@/theme/art';
import { colors, gutter, radii } from '@/theme/tokens';

import { Button } from './button';
import { Text } from './text';

type EmptyProps = {
  art?: ArtKey;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  night?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ art: artKey = 'iconAgave', title, message, action, night, style }: EmptyProps) {
  const a = art[artKey];
  return (
    <View style={[styles.empty, style]}>
      <Image source={a.source} style={{ width: 120, height: (120 * a.height) / a.width }} contentFit="contain" accessibilityIgnoresInvertColors />
      <Text variant="heading" align="center" color={night ? colors.paper : colors.ink}>
        {title}
      </Text>
      {message ? (
        <Text variant="body" align="center" color={night ? 'rgba(243,233,210,0.7)' : colors.inkSoft}>
          {message}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} size="md" style={{ alignSelf: 'center', marginTop: 6 }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry, night, style }: { message: string; onRetry?: () => void; night?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.empty, style]}>
      <Text variant="title" align="center" color={night ? colors.blush : colors.terracotta}>
        ¡AY, CARAMBA!
      </Text>
      <Text variant="body" align="center" color={night ? 'rgba(243,233,210,0.75)' : colors.inkSoft}>
        {message}
      </Text>
      {onRetry ? <Button label="Try again" icon={RefreshCw} onPress={onRetry} size="md" variant="secondary" style={{ alignSelf: 'center' }} /> : null}
    </View>
  );
}

/** Breathing agave — the app's loading mark. */
export function AgaveLoader({ size = 64, label }: { size?: number; label?: string }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    s.set(withRepeat(withSequence(withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(0.94, { duration: 700, easing: Easing.inOut(Easing.quad) })), -1, true));
  }, [reduce, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <View style={{ alignItems: 'center', gap: 10 }} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <Animated.View style={style}>
        <Image source={art.iconAgave.source} style={{ width: size, height: size * 0.78 }} contentFit="contain" />
      </Animated.View>
      {label ? <Text variant="lede">{label}</Text> : null}
    </View>
  );
}

export function LoadingState({ label, style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: gutter }, style]}>
      <AgaveLoader label={label} />
    </View>
  );
}

/** Shimmering placeholder block. */
export function Skeleton({ height = 16, width = '100%', radius = radii.sm, style }: { height?: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(0.5);
  useEffect(() => {
    if (reduce) return;
    o.set(withRepeat(withTiming(1, { duration: 850 }), -1, true));
  }, [reduce, o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[{ height, width, borderRadius: radius, backgroundColor: colors.paperDeep }, anim, style]} />;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: gutter * 1.5 },
});
