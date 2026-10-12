import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { sponsors } from '@shared/content/sponsors';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { haptic } from '@/lib/haptics';
import { artFor } from '@/theme/art';
import { colors, fonts, gutter } from '@/theme/tokens';

const DURATION = 6000;
const AnimatedImage = Animated.createAnimatedComponent(Image);

function Bar({ state, progress }: { state: 'done' | 'active' | 'todo'; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({ width: `${(state === 'done' ? 1 : state === 'active' ? progress.get() : 0) * 100}%` }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

export default function Stories() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const [houseIndex, setHouseIndex] = useState(() => Math.max(0, sponsors.findIndex((s) => s.id === id)));
  const [slide, setSlide] = useState(0);
  const progress = useSharedValue(0);
  const zoom = useSharedValue(1);
  const dragY = useSharedValue(0);
  const paused = useRef(false);

  const house = sponsors[houseIndex];
  const story = house.stories[slide];
  const img = artFor(story?.image);

  useEffect(() => {
    setStatusBarStyle('light', true);
    return () => setStatusBarStyle('dark', true);
  }, []);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const next = () => {
    if (slide < house.stories.length - 1) setSlide((s) => s + 1);
    else if (houseIndex < sponsors.length - 1) {
      setHouseIndex((h) => h + 1);
      setSlide(0);
    } else close();
  };
  const prev = () => {
    if (slide > 0) setSlide((s) => s - 1);
    else if (houseIndex > 0) {
      setHouseIndex((h) => h - 1);
      setSlide(0);
    } else progress.set(0);
  };

  // Drive the progress bar and the Ken Burns zoom for each slide.
  useEffect(() => {
    progress.set(0);
    zoom.set(1);
    progress.set(withTiming(1, { duration: DURATION, easing: Easing.linear }, (finished) => finished && scheduleOnRN(next)));
    if (!reduce) zoom.set(withTiming(1.16, { duration: DURATION + 800, easing: Easing.out(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseIndex, slide]);

  const pause = () => {
    paused.current = true;
    cancelAnimation(progress);
    cancelAnimation(zoom);
  };
  const resume = () => {
    if (!paused.current) return;
    paused.current = false;
    const remaining = (1 - progress.get()) * DURATION;
    progress.set(withTiming(1, { duration: remaining, easing: Easing.linear }, (finished) => finished && scheduleOnRN(next)));
    if (!reduce) zoom.set(withTiming(1.16, { duration: remaining + 800 }));
  };

  const swipeDown = Gesture.Pan()
    .activeOffsetY(18)
    .onUpdate((e) => {
      dragY.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) scheduleOnRN(close);
      else dragY.set(withSpring(0));
    });

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.get() }, { scale: 1 - Math.min(dragY.get(), 300) / 1500 }], borderRadius: dragY.get() > 0 ? 24 : 0 }));
  const ken = useAnimatedStyle(() => ({ transform: [{ scale: zoom.get() }, { translateX: (zoom.get() - 1) * -60 }] }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <GestureDetector gesture={swipeDown}>
        <Animated.View style={[{ flex: 1, overflow: 'hidden' }, sheet]}>
          <AnimatedImage key={`${house.id}-${slide}`} source={img.source} placeholder={img.blurhash ? { blurhash: img.blurhash } : undefined} style={[StyleSheet.absoluteFill, ken]} contentFit="cover" transition={250} />
          <LinearGradient colors={['rgba(18,14,12,0.6)', 'rgba(18,14,12,0)', 'rgba(18,14,12,0.2)', 'rgba(18,14,12,0.92)']} locations={[0, 0.25, 0.55, 1]} style={StyleSheet.absoluteFill} />

          {/* tap zones: left third = back, rest = forward; hold to pause */}
          <View style={StyleSheet.absoluteFill}>
            <View style={{ flexDirection: 'row', flex: 1 }}>
              <Pressable style={{ flex: 1 }} onPress={() => (haptic.tap(), prev())} onLongPress={pause} onPressOut={resume} delayLongPress={180} accessibilityLabel="Previous" />
              <Pressable style={{ flex: 2 }} onPress={() => (haptic.tap(), next())} onLongPress={pause} onPressOut={resume} delayLongPress={180} accessibilityLabel="Next" />
            </View>
          </View>

          <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <View style={styles.bars}>
              {house.stories.map((_, i) => (
                <Bar key={`${house.id}-${i}`} state={i < slide ? 'done' : i === slide ? 'active' : 'todo'} progress={progress} />
              ))}
            </View>
            <View style={styles.head}>
              <View style={[styles.mono, { backgroundColor: house.color }]}>
                <Text style={styles.monoText}>{house.monogram}</Text>
              </View>
              <Text style={styles.name}>{house.name}</Text>
              <IconButton icon={X} label="Close stories" tone="glass" size={40} onPress={close} style={{ marginLeft: 'auto' }} />
            </View>
          </View>

          <Animated.View key={`${house.id}-${slide}-text`} entering={FadeIn.duration(400)} style={[styles.caption, { paddingBottom: insets.bottom + 28, minHeight: height * 0.3 }]} pointerEvents="box-none">
            <Text variant="lede" color={colors.blush}>
              {story?.kicker}
            </Text>
            <Text style={styles.storyText}>{story?.text}</Text>
            <Button label={`Visit ${house.name}`} variant="blush" size="md" onPress={() => router.replace({ pathname: '/sponsors/[id]', params: { id: house.id } })} style={{ marginTop: 14 }} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: gutter - 8, gap: 12 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(243,233,210,0.3)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mono: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  monoText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.card },
  name: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.paper },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: gutter, justifyContent: 'flex-end', gap: 6 },
  storyText: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 33, color: colors.paper },
});
