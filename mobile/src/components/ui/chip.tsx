import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radii } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type ChipProps = {
  label: string;
  icon?: LucideIcon;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'paper' | 'night';
  style?: StyleProp<ViewStyle>;
};

/** Selectable filter pill. */
export function Chip({ label, icon: Icon, selected, onPress, tone = 'paper', style }: ChipProps) {
  const night = tone === 'night';
  const bg = selected ? (night ? colors.blush : colors.ink) : night ? 'rgba(243,233,210,0.08)' : colors.card;
  const fg = selected ? (night ? colors.ink : colors.paper) : night ? colors.paper : colors.ink;
  const border = night ? (selected ? colors.blush : colors.nightLine) : colors.ink;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={[styles.chip, { backgroundColor: bg, borderColor: border }, style]}
    >
      {Icon ? <Icon size={14} color={fg} strokeWidth={2.4} /> : null}
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </PressableScale>
  );
}

type TagProps = { label: string; color?: string; textColor?: string; style?: StyleProp<ViewStyle>; icon?: LucideIcon };

/** Small static label for cards. */
export function Tag({ label, color = colors.blush, textColor = colors.ink, style, icon: Icon }: TagProps) {
  return (
    <View style={[styles.tag, { backgroundColor: color }, style]}>
      {Icon ? <Icon size={11} color={textColor} strokeWidth={2.6} /> : null}
      <Text style={[styles.tagText, { color: textColor }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  text: { fontFamily: fonts.sansSemiBold, fontSize: 14, lineHeight: 18 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1.2,
    borderColor: colors.ink,
  },
  tagText: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.1, lineHeight: 12 },
});
