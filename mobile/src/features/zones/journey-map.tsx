import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Experience } from '@shared/content/experiences';

import { Text } from '@/components/ui/text';
import { haptic } from '@/lib/haptics';
import { art } from '@/theme/art';
import { colors, fonts } from '@/theme/tokens';

const MAP = art.mapJourney;
const RATIO = MAP.width / MAP.height;
const PIN = 34;

type PinProps = {
  zone: Experience;
  mapW: number;
  mapH: number;
  scale: SharedValue<number>;
  stamped: boolean;
  selected: boolean;
  onPress: (z: Experience) => void;
};

function Pin({ zone, mapW, mapH, scale, stamped, selected, onPress }: PinProps) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (stamped || reduce) return;
    pulse.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
  }, [stamped, reduce, pulse]);

  // Pins live inside the zoomed layer but counter-scale so they stay finger-sized.
  const counter = useAnimatedStyle(() => ({ transform: [{ scale: (selected ? 1.25 : 1) / scale.get() }] }));
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - pulse.get()), transform: [{ scale: 1 + pulse.get() * 1.1 }] }));

  return (
    <Animated.View style={[styles.pinWrap, { left: zone.map.x * mapW - PIN / 2, top: zone.map.y * mapH - PIN / 2 }, counter]}>
      {!stamped ? <Animated.View style={[styles.ring, { borderColor: zone.accent }, ring]} pointerEvents="none" /> : null}
      <View
        onAccessibilityTap={() => onPress(zone)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Zone ${zone.zone}, ${zone.name}${stamped ? ', stamped' : ''}`}
        style={[styles.pin, { backgroundColor: stamped ? colors.agave : selected ? colors.ink : zone.accent }]}
      >
        {stamped ? <Check size={18} color={colors.card} strokeWidth={3.2} /> : <Text style={styles.pinText}>{zone.zone}</Text>}
      </View>
    </Animated.View>
  );
}

type Props = {
  width: number;
  height: number;
  zones: Experience[];
  stampedIds: Set<string>;
  selectedId: string | null;
  onSelect: (z: Experience | null) => void;
};

/** Pinch-zoom / pan illustrated journey map with zone pins. */
export function JourneyMap({ width, height, zones, stampedIds, selectedId, onSelect }: Props) {
  // Lay the art out at "fit height" — the most legible default on a phone — and let guests pan.
  const mapH = height;
  const mapW = height * RATIO;
  const minScale = Math.min(1, width / mapW);
  const maxScale = 3;

  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const tx = useSharedValue(-(mapW - width) / 2);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const clamp = (x: number, y: number, s: number) => {
    'worklet';
    const w = mapW * s;
    const h = mapH * s;
    // The layer scales about its centre: visual left = x - (w - mapW) / 2, right = x + (w + mapW) / 2.
    const minX = width - (w + mapW) / 2;
    const maxX = w > width ? (w - mapW) / 2 : (width - mapW) / 2;
    const cx = w > width ? Math.min(maxX, Math.max(minX, x)) : (width - mapW) / 2;
    const minY = height - (h + mapH) / 2;
    const maxY = (h - mapH) / 2;
    const cy = h > height ? Math.min(maxY, Math.max(minY, y)) : (height - mapH) / 2;
    return { x: cx, y: cy };
  };

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      startX.set(tx.get());
      startY.set(ty.get());
    })
    .onUpdate((e) => {
      const c = clamp(startX.get() + e.translationX, startY.get() + e.translationY, scale.get());
      tx.set(c.x);
      ty.set(c.y);
    })
    .onEnd((e) => {
      const c = clamp(tx.get() + e.velocityX * 0.15, ty.get() + e.velocityY * 0.15, scale.get());
      tx.set(withSpring(c.x, { damping: 22, stiffness: 160 }));
      ty.set(withSpring(c.y, { damping: 22, stiffness: 160 }));
    });

  const pinch = Gesture.Pinch()
    .onStart(() => startScale.set(scale.get()))
    .onUpdate((e) => {
      scale.set(Math.min(maxScale * 1.15, Math.max(minScale * 0.85, startScale.get() * e.scale)));
    })
    .onEnd(() => {
      const s = Math.min(maxScale, Math.max(minScale, scale.get()));
      scale.set(withSpring(s, { damping: 18 }));
      const c = clamp(tx.get(), ty.get(), s);
      tx.set(withSpring(c.x));
      ty.set(withSpring(c.y));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const s = scale.get() > 1.4 ? 1 : 2;
      scale.set(withTiming(s, { duration: 280 }));
      const c = clamp(tx.get(), ty.get(), s);
      tx.set(withTiming(c.x, { duration: 280 }));
      ty.set(withTiming(c.y, { duration: 280 }));
      scheduleOnRN(haptic.tap);
    });

  const pick = (zone: Experience | null) => {
    if (zone) haptic.press();
    onSelect(zone);
  };

  // Hit-test pins in map space so taps never race a child responder.
  const singleTap = Gesture.Tap().onEnd((e) => {
    const s = scale.get();
    const mx = (e.x - tx.get() + (mapW * s - mapW) / 2) / s;
    const my = (e.y - ty.get() + (mapH * s - mapH) / 2) / s;
    const radius = (PIN * 0.85) / s;
    let best: Experience | null = null;
    let bestD = radius;
    for (const z of zones) {
      const d = Math.hypot(z.map.x * mapW - mx, z.map.y * mapH - my);
      if (d < bestD) {
        bestD = d;
        best = z;
      }
    }
    scheduleOnRN(pick, best);
  });

  const gesture = Gesture.Simultaneous(pan, pinch, Gesture.Exclusive(doubleTap, singleTap));

  const layer = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.viewport, { width, height }]} accessibilityLabel="Illustrated journey map. Pinch to zoom, drag to explore.">
        <Animated.View style={[{ width: mapW, height: mapH }, layer]}>
          <Image source={MAP.source} style={StyleSheet.absoluteFill} contentFit="contain" />
          {zones.map((z) => (
            <Pin
              key={z.id}
              zone={z}
              mapW={mapW}
              mapH={mapH}
              scale={scale}
              stamped={stampedIds.has(z.id)}
              selected={selectedId === z.id}
              onPress={pick}
            />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden' },
  pinWrap: { position: 'absolute', width: PIN, height: PIN, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: PIN, height: PIN, borderRadius: PIN / 2, borderWidth: 3 },
  pin: {
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  pinText: { fontFamily: fonts.display, fontSize: 16, color: colors.card, marginTop: 2 },
});
