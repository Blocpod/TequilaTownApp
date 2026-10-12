import type { ComponentType } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  onPress?: () => void;
  label: string;
  tone?: 'paper' | 'ink' | 'glass' | 'terracotta';
  size?: number;
  badge?: number;
  style?: StyleProp<ViewStyle>;
};

const tones = {
  paper: { bg: colors.card, fg: colors.ink, border: colors.ink },
  ink: { bg: colors.ink, fg: colors.paper, border: colors.ink },
  glass: { bg: 'rgba(18,14,12,0.42)', fg: colors.paper, border: 'rgba(243,233,210,0.35)' },
  terracotta: { bg: colors.terracotta, fg: colors.card, border: colors.ink },
} as const;

/** Circular icon control (44pt+ touch target). */
export function IconButton({ icon: Icon, onPress, label, tone = 'paper', size = 44, badge, style }: Props) {
  const t = tones[tone];
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      pressedScale={0.9}
      style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg, borderColor: t.border }, style]}
    >
      <Icon size={size * 0.46} color={t.fg} strokeWidth={2.2} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : String(badge)}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.terracotta,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.card, fontSize: 11, fontFamily: fonts.sansBold, lineHeight: 13 },
});
