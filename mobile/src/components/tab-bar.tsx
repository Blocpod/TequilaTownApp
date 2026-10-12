import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BookOpen, CircleUser, Eye, House, Map, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { colors, fonts, motion } from '@/theme/tokens';

import { Text } from './ui/text';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Home', icon: House },
  journey: { label: 'Journey', icon: Map },
  oracle: { label: 'Oracle', icon: Eye },
  passport: { label: 'Passport', icon: BookOpen },
  me: { label: 'Me', icon: CircleUser },
};

const BAR_H = 66;
const ORACLE = 'oracle';

function OracleButton({ focused, onPress }: { focused: boolean; onPress: () => void }) {
  const reduce = useReducedMotion();
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    glow.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduce, glow]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.25 + glow.get() * 0.45, transform: [{ scale: 1 + glow.get() * 0.12 }] }));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel="The Oracle"
      accessibilityHint="AI bartender, chef, portrait studio and bottle scanner"
      style={styles.oracleWrap}
      hitSlop={6}
    >
      <Animated.View style={[styles.halo, halo]} />
      <View style={[styles.oracle, focused && { backgroundColor: colors.terracotta }]}>
        <Eye size={30} color={colors.blush} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const slot = width / state.routes.length;
  const x = useSharedValue(0);
  const pillVisible = useSharedValue(1);
  const active = state.routes[state.index]?.name;
  const placed = useRef(false);

  useEffect(() => {
    if (!slot) return;
    // Snap into place on first layout; spring only when the guest switches tabs.
    const animate = placed.current;
    const visible = active === ORACLE ? 0 : 1;
    x.set(animate ? withSpring(state.index * slot, motion.spring) : state.index * slot);
    pillVisible.set(animate ? withTiming(visible, { duration: 160 }) : visible);
    placed.current = true;
  }, [state.index, slot, active, x, pillVisible]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }], opacity: pillVisible.get() }));

  return (
    <View pointerEvents="box-none" style={[styles.container, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      <View style={styles.shadow} />
      <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
        {slot ? <Animated.View style={[styles.pill, { width: slot - 10 }, pill]} /> : null}
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta = TABS[route.name] ?? { label: route.name, icon: House };
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic.tap();
              navigation.navigate(route.name, route.params);
            }
          };
          if (route.name === ORACLE) return <OracleButton key={route.key} focused={focused} onPress={onPress} />;
          const Icon = meta.icon;
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
              style={styles.tab}
            >
              <Icon size={23} color={focused ? colors.terracotta : colors.inkSoft} strokeWidth={focused ? 2.5 : 2} />
              <Text style={[styles.label, focused ? styles.labelOn : null]} maxFontSizeMultiplier={1.1}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 14, right: 14, height: BAR_H },
  shadow: { position: 'absolute', top: 4, left: 4, right: -4, bottom: -4, borderRadius: BAR_H / 2, backgroundColor: colors.ink },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BAR_H / 2,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.card,
  },
  pill: { position: 'absolute', left: 5, top: 6, bottom: 6, borderRadius: 26, backgroundColor: colors.blush, borderWidth: 1.2, borderColor: colors.ink },
  tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: colors.inkSoft },
  labelOn: { fontFamily: fonts.sansBold, color: colors.terracotta },
  oracleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', top: -30, width: 76, height: 76, borderRadius: 38, backgroundColor: colors.sun },
  oracle: {
    position: 'absolute',
    top: -26,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.night,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
