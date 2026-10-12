import { ArrowRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, gutter } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = {
  kicker?: string;
  title: string;
  action?: { label: string; onPress: () => void };
  night?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/** Kicker (serif italic) + stencil title + optional "see all" link. */
export function SectionHeader({ kicker, title, action, night, style }: Props) {
  const fg = night ? colors.paper : colors.ink;
  return (
    <View style={[styles.row, style]}>
      <View style={{ flex: 1 }}>
        {kicker ? (
          <Text variant="lede" style={{ fontSize: 15, lineHeight: 19, color: night ? colors.blush : colors.terracotta }}>
            {kicker}
          </Text>
        ) : null}
        <Text variant="title" style={{ color: fg }} accessibilityRole="header">
          {title.toUpperCase()}
        </Text>
      </View>
      {action ? (
        <PressableScale onPress={action.onPress} accessibilityLabel={action.label} hitSlop={10} style={styles.action}>
          <Text style={[styles.actionText, { color: fg }]}>{action.label}</Text>
          <ArrowRight size={15} color={fg} strokeWidth={2.4} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Hand-drawn style rule with a center ornament. */
export function Ornament({ color = colors.ink, style }: { color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.ornament, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.rule, { backgroundColor: color }]} />
      <View style={[styles.diamond, { backgroundColor: color }]} />
      <View style={[styles.rule, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: gutter, marginBottom: 14, gap: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 4 },
  actionText: { fontFamily: fonts.sansBold, fontSize: 13, letterSpacing: 0.4 },
  ornament: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter },
  rule: { flex: 1, height: 1.2, opacity: 0.5 },
  diamond: { width: 7, height: 7, marginHorizontal: 10, transform: [{ rotate: '45deg' }] },
});
