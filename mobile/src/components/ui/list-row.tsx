import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { colors, fonts } from '@/theme/tokens';

import { Text } from './text';

type Props = {
  icon: LucideIcon;
  label: string;
  detail?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  first?: boolean;
};

/** Settings-style row used inside a PrintCard group. */
export function ListRow({ icon: Icon, label, detail, onPress, right, danger, first }: Props) {
  const color = danger ? colors.danger : colors.ink;
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              haptic.tap();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && { backgroundColor: 'rgba(43,26,16,0.05)' }]}
    >
      <View style={[styles.icon, danger && { backgroundColor: '#F8E0DC' }]}>
        <Icon size={18} color={color} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        {detail ? <Text variant="small">{detail}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={colors.inkMuted} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  divider: { borderTopWidth: 1, borderColor: colors.inkFaint },
  icon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.inkFaint },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 15.5 },
});
