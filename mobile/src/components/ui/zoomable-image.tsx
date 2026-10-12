import { Image, type ImageSource } from 'expo-image';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

type Props = { source: ImageSource | number; width: number; height: number; aspect: number; maxScale?: number; accessibilityLabel: string };

/** Pinch / pan / double-tap zoom for a single image, clamped to its edges. */
export function ZoomableImage({ source, width, height, aspect, maxScale = 4, accessibilityLabel }: Props) {
  const imgW = width;
  const imgH = width / aspect;
  const scale = useSharedValue(1);
  const start = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  const clamp = (x: number, y: number, s: number) => {
    'worklet';
    const maxX = Math.max(0, (imgW * s - width) / 2);
    const maxY = Math.max(0, (imgH * s - height) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  };

  const pinch = Gesture.Pinch()
    .onStart(() => start.set(scale.get()))
    .onUpdate((e) => scale.set(Math.min(maxScale * 1.2, Math.max(0.85, start.get() * e.scale))))
    .onEnd(() => {
      const s = Math.min(maxScale, Math.max(1, scale.get()));
      scale.set(withSpring(s));
      const c = clamp(tx.get(), ty.get(), s);
      tx.set(withSpring(c.x));
      ty.set(withSpring(c.y));
    });
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      sx.set(tx.get());
      sy.set(ty.get());
    })
    .onUpdate((e) => {
      const c = clamp(sx.get() + e.translationX, sy.get() + e.translationY, scale.get());
      tx.set(c.x);
      ty.set(c.y);
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const s = scale.get() > 1.2 ? 1 : 2.5;
      scale.set(withTiming(s, { duration: 260 }));
      const c = clamp(tx.get(), ty.get(), s);
      tx.set(withTiming(c.x, { duration: 260 }));
      ty.set(withTiming(c.y, { duration: 260 }));
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }] }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        <Animated.View style={[{ width: imgW, height: imgH }, style]}>
          <Image source={source} style={{ width: imgW, height: imgH }} contentFit="contain" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
