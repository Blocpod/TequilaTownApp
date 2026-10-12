import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { colors, fonts, motion } from '@/theme/tokens';

import { Text } from './text';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  night?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Pill segmented control with a sliding thumb. */
export function Segmented<T extends string>({ options, value, onChange, night, style }: Props<T>) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const seg = w / options.length;
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withSpring(idx * seg, motion.spring));
  }, [idx, seg, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const fg = night ? colors.paper : colors.ink;

  return (
    <View
      style={[styles.track, { borderColor: night ? colors.nightLine : colors.ink, backgroundColor: night ? 'rgba(243,233,210,0.06)' : colors.card }, style]}
      onLayout={(e) => setW(e.nativeEvent.layout.width - 6)}
      accessibilityRole="tablist"
    >
      {w ? <Animated.View style={[styles.thumb, { width: seg, backgroundColor: night ? colors.blush : colors.ink }, thumb]} /> : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={styles.item}
            onPress={() => {
              if (!on) {
                haptic.tap();
                onChange(o.value);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            <Text style={[styles.label, { color: on ? (night ? colors.ink : colors.paper) : fg }]}>{o.label.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', height: 44, borderRadius: 22, borderWidth: 1.5, padding: 3 },
  thumb: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 19 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.display, fontSize: 15, lineHeight: 17, letterSpacing: 1, marginTop: 2 },
});
