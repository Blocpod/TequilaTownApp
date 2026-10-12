import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { colors, motion, radii } from '@/theme/tokens';

type CardLook = {
  /** hard shadow offset in px (0 = flat) */
  offset?: number;
  shadowColor?: string;
  background?: string;
  borderColor?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** styles applied to the face (padding, layout) */
  contentStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * Cross-platform hard shadow: a solid underlay rather than platform shadows,
 * so iOS and Android render the identical printed look.
 */
export function PrintCard({
  offset = 4,
  shadowColor = colors.ink,
  background = colors.card,
  borderColor = colors.ink,
  radius = radii.lg,
  style,
  contentStyle,
  children,
}: CardLook) {
  return (
    <View style={[{ paddingRight: offset, paddingBottom: offset }, style]}>
      {offset > 0 ? (
        <View style={[StyleSheet.absoluteFill, { top: offset, left: offset, borderRadius: radius, backgroundColor: shadowColor }]} />
      ) : null}
      <View style={[styles.face, { backgroundColor: background, borderColor, borderRadius: radius }, contentStyle]}>{children}</View>
    </View>
  );
}

type PressCardProps = CardLook & {
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
};

/** A PrintCard you can press — the face sinks into its shadow. */
export function PressCard({
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  offset = 4,
  shadowColor = colors.ink,
  background = colors.card,
  borderColor = colors.ink,
  radius = radii.lg,
  style,
  contentStyle,
  children,
}: PressCardProps) {
  const press = useSharedValue(0);
  const face = useAnimatedStyle(() => ({
    transform: [{ translateX: press.get() * offset }, { translateY: press.get() * offset }],
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPressIn={() => press.set(withTiming(1, { duration: 80 }))}
      onPressOut={() => press.set(withSpring(0, motion.springBouncy))}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      onLongPress={onLongPress}
      style={[{ paddingRight: offset, paddingBottom: offset }, style]}
    >
      {offset > 0 ? (
        <View style={[StyleSheet.absoluteFill, { top: offset, left: offset, borderRadius: radius, backgroundColor: shadowColor }]} />
      ) : null}
      <Animated.View style={[styles.face, { backgroundColor: background, borderColor, borderRadius: radius }, contentStyle, face]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: { borderWidth: 1.5, overflow: 'hidden' },
});
