import { Minus, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { colors, fonts, radii } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = { value: number; min?: number; max: number; onChange: (v: number) => void; label: string; compact?: boolean };

/** − n + quantity control. */
export function Stepper({ value, min = 1, max, onChange, label, compact }: Props) {
  const size = compact ? 32 : 40;
  const set = (v: number) => {
    if (v < min || v > max) return haptic.warning();
    haptic.tap();
    onChange(v);
  };
  return (
    <View
      style={[styles.wrap, { height: size + 6 }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
    >
      <PressableScale onPress={() => set(value - 1)} hapticOnPress="none" style={[styles.btn, { width: size, height: size }]} accessibilityLabel="Decrease">
        <Minus size={16} color={value <= min ? colors.inkFaint : colors.ink} strokeWidth={2.6} />
      </PressableScale>
      <Text style={[styles.value, compact && { fontSize: 16, minWidth: 24 }]}>{value}</Text>
      <PressableScale onPress={() => set(value + 1)} hapticOnPress="none" style={[styles.btn, { width: size, height: size }]} accessibilityLabel="Increase">
        <Plus size={16} color={value >= max ? colors.inkFaint : colors.ink} strokeWidth={2.6} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 3, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.card, alignSelf: 'flex-start' },
  btn: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  value: { fontFamily: fonts.serifBlack, fontSize: 19, color: colors.ink, minWidth: 30, textAlign: 'center' },
});
