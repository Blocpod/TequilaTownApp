import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { colors, fonts, motion, radii } from '@/theme/tokens';

import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'dark' | 'agave' | 'ghost' | 'blush';
type Size = 'lg' | 'md' | 'sm';

const palette: Record<Variant, { bg: string; fg: string; border: string; shadow: string | null }> = {
  primary: { bg: colors.terracotta, fg: colors.card, border: colors.ink, shadow: colors.ink },
  secondary: { bg: colors.card, fg: colors.ink, border: colors.ink, shadow: colors.ink },
  dark: { bg: colors.ink, fg: colors.paper, border: colors.ink, shadow: colors.terracotta },
  agave: { bg: colors.agave, fg: colors.card, border: colors.ink, shadow: colors.ink },
  blush: { bg: colors.blush, fg: colors.ink, border: colors.ink, shadow: colors.ink },
  ghost: { bg: 'transparent', fg: colors.ink, border: 'transparent', shadow: null },
};

const sizes: Record<Size, { h: number; px: number; font: number; icon: number; shadow: number }> = {
  lg: { h: 58, px: 26, font: 19, icon: 20, shadow: 4 },
  md: { h: 48, px: 20, font: 16, icon: 18, shadow: 3 },
  sm: { h: 38, px: 14, font: 13.5, icon: 15, shadow: 2 },
};

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * Letterpress button: a solid offset shadow sits under the face; pressing pushes the face
 * down into it (translate) for a tactile, printed feel.
 */
export function Button({ label, onPress, variant = 'primary', size = 'lg', icon: Icon, iconRight: IconRight, loading, disabled, full, style, accessibilityHint }: Props) {
  const p = palette[variant];
  const s = sizes[size];
  const press = useSharedValue(0);
  const face = useAnimatedStyle(() => ({
    transform: [{ translateX: press.get() * s.shadow }, { translateY: press.get() * s.shadow }],
  }));
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPressIn={() => press.set(withTiming(1, { duration: 70 }))}
      onPressOut={() => press.set(withSpring(0, motion.springBouncy))}
      onPress={() => {
        haptic.press();
        onPress?.();
      }}
      style={[{ alignSelf: full ? 'stretch' : 'flex-start', paddingRight: p.shadow ? s.shadow : 0, paddingBottom: p.shadow ? s.shadow : 0 }, style]}
    >
      {p.shadow ? (
        <View style={[StyleSheet.absoluteFill, { top: s.shadow, left: s.shadow, borderRadius: radii.pill, backgroundColor: p.shadow }]} />
      ) : null}
      <Animated.View
        style={[
          styles.face,
          { height: s.h, paddingHorizontal: s.px, backgroundColor: p.bg, borderColor: p.border, opacity: disabled ? 0.5 : 1 },
          face,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <>
            {Icon ? <Icon size={s.icon} color={p.fg} strokeWidth={2.2} /> : null}
            <Text style={{ fontFamily: fonts.display, fontSize: s.font, letterSpacing: 1, color: p.fg, marginTop: 2 }} numberOfLines={1}>
              {label.toUpperCase()}
            </Text>
            {IconRight ? <IconRight size={s.icon} color={p.fg} strokeWidth={2.2} /> : null}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    borderRadius: radii.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
