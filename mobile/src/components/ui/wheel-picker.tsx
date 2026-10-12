import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  scrollTo,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { haptic } from '@/lib/haptics';
import { colors, fonts } from '@/theme/tokens';

import { Text } from './text';

const ITEM_H = 46;
const VISIBLE = 5;

type Item = { value: string; label: string };

function Row({ item, index, offset, onSelect }: { item: Item; index: number; offset: SharedValue<number>; onSelect: (i: number) => void }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(offset.get() / ITEM_H - index);
    return {
      opacity: interpolate(d, [0, 1, 2.5], [1, 0.45, 0.12], 'clamp'),
      transform: [{ scale: interpolate(d, [0, 1, 2], [1, 0.9, 0.8], 'clamp') }, { rotateX: `${interpolate(offset.get() / ITEM_H - index, [-2, 0, 2], [50, 0, -50], 'clamp')}deg` }],
    };
  });
  // Tapping a row jumps straight to it (a drag still scrolls the wheel).
  return (
    <Pressable onPress={() => onSelect(index)} accessible={false}>
      <Animated.View style={[styles.row, style]}>
        <Text style={styles.rowText} numberOfLines={1}>
          {item.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

type Props = {
  items: Item[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  style?: StyleProp<ViewStyle>;
};

/** A drum-style picker column: snap scrolling, 3D falloff, haptic ticks, adjustable for screen readers. */
export function WheelPicker({ items, value, onChange, label, style }: Props) {
  const ref = useAnimatedRef<Animated.ScrollView>();
  const offset = useSharedValue(0);
  const lastIndex = useSharedValue(-1);
  const selectedIndex = Math.max(0, items.findIndex((i) => i.value === value));
  const mounted = useRef(false);
  /** set when the wheel itself changed the value, so we don't scroll back under the finger */
  const internal = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (internal.current) {
      internal.current = false;
      return;
    }
    const y = selectedIndex * ITEM_H;
    const animated = mounted.current;
    mounted.current = true;
    scheduleOnUI(() => {
      'worklet';
      scrollTo(ref, 0, y, animated);
    });
  }, [selectedIndex, ref]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      offset.set(e.contentOffset.y);
    },
  });

  const commit = (idx: number) => {
    const i = Math.max(0, Math.min(items.length - 1, idx));
    // Glide to the exact row (web has no native snap; harmless where snapping already happened).
    scheduleOnUI(() => {
      'worklet';
      if (Math.abs(offset.get() - i * ITEM_H) > 1) scrollTo(ref, 0, i * ITEM_H, true);
    });
    if (items[i] && items[i].value !== value) {
      internal.current = true;
      onChange(items[i].value);
    }
  };
  const settle = (y: number) => commit(Math.round(y / ITEM_H));

  // Tick on every row that passes the band; commit shortly after the wheel comes to rest
  // (momentum events don't fire on every platform, so this is the reliable path).
  const onIndex = (idx: number) => {
    haptic.tap();
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => commit(idx), 260);
  };
  useEffect(() => () => void (debounce.current && clearTimeout(debounce.current)), []);

  useAnimatedReaction(
    () => Math.round(offset.get() / ITEM_H),
    (idx, prev) => {
      if (prev !== null && idx !== prev && idx !== lastIndex.get()) {
        lastIndex.set(idx);
        scheduleOnRN(onIndex, idx);
      }
    },
  );

  const step = (dir: 1 | -1) => {
    const idx = Math.max(0, Math.min(items.length - 1, selectedIndex + dir));
    onChange(items[idx].value);
  };

  return (
    <View
      style={[styles.column, style]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[selectedIndex]?.label }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <View pointerEvents="none" style={styles.band} />
      <Animated.ScrollView
        ref={ref}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        // Android only scrolls a vertical list inside another vertical scroller when told to.
        nestedScrollEnabled
        overScrollMode="never"
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => {
          if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.y) < 0.05) settle(e.nativeEvent.contentOffset.y);
        }}
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
      >
        {items.map((item, i) => (
          <Row
            key={item.value}
            item={item}
            index={i}
            offset={offset}
            onSelect={(idx) => {
              haptic.tap();
              commit(idx);
            }}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { height: ITEM_H * VISIBLE, overflow: 'hidden' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_H * Math.floor(VISIBLE / 2),
    height: ITEM_H,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: 'rgba(252,200,186,0.55)',
  },
  row: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  rowText: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
});
