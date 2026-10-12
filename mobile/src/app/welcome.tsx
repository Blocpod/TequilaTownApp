import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { PaperBackground } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { signInWithApple, useAppleAvailable } from '@/features/auth/apple';
import { errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { usePrefs } from '@/state/prefs';
import { art, type ArtKey } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

const SLIDES: { art: ArtKey; kicker: string; title: string; body: string; bg: string }[] = [
  {
    art: 'posterTown',
    kicker: 'Bienvenidos',
    title: 'Twelve zones.\nOne journey.',
    body: 'From the agave fields to Agave After Dark — your map, schedule and guide to every room in Tequila Town.',
    bg: colors.sun,
  },
  {
    art: 'passportCover',
    kicker: 'Your passport',
    title: 'Collect every\nstamp.',
    body: 'Scan, sip and explore to complete missions, earn points and unlock rewards at the Mercado.',
    bg: colors.agaveMist,
  },
  {
    art: 'oracleMemoria',
    kicker: 'The Oracle',
    title: 'Meet the\nspirits.',
    body: 'An AI bartender, a chef who knows every pairing, a bottle scanner — and a portrait studio that sends you back to 1940s Jalisco.',
    bg: colors.blush,
  },
];

function Slide({ index, scrollX, width, maxArtH }: { index: number; scrollX: SharedValue<number>; width: number; maxArtH: number }) {
  const s = SLIDES[index];
  const a = art[s.art];
  const artW = width - gutter * 2 - 24;
  const artH = Math.min(artW * (a.height / a.width), maxArtH);
  const parallax = useAnimatedStyle(() => {
    const p = (scrollX.get() - index * width) / width;
    return { transform: [{ translateX: p * -60 }, { rotate: `${p * -6}deg` }, { scale: interpolate(Math.abs(p), [0, 1], [1, 0.86]) }] };
  });
  return (
    <View style={{ width, paddingHorizontal: gutter, alignItems: 'center' }}>
      <Animated.View style={[styles.frame, { backgroundColor: s.bg }, parallax]}>
        <Image source={a.source} placeholder={a.blurhash ? { blurhash: a.blurhash } : undefined} style={{ width: artW, height: artH, borderRadius: radii.md }} contentFit="cover" />
      </Animated.View>
      <Text variant="lede" align="center" color={colors.terracotta} style={{ marginTop: 18 }}>
        {s.kicker}
      </Text>
      <Text variant="display" align="center" style={{ marginTop: 4 }}>
        {s.title.toUpperCase()}
      </Text>
      <Text variant="body" align="center" style={{ marginTop: 10, maxWidth: 340 }}>
        {s.body}
      </Text>
    </View>
  );
}

function Dot({ index, scrollX, width }: { index: number; scrollX: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(scrollX.get() / width - index);
    return { width: interpolate(d, [0, 1], [26, 9], 'clamp'), backgroundColor: d < 0.5 ? colors.terracotta : colors.inkFaint };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

export default function Welcome() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollX = useSharedValue(0);
  const appleAvailable = useAppleAvailable();
  const continueAsGuest = () => usePrefs.getState().setGuest(true);
  const [appleBusy, setAppleBusy] = useState(false);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });

  const apple = async () => {
    setAppleBusy(true);
    try {
      await signInWithApple();
    } catch (e) {
      toast.error('Sign in failed', errorMessage(e));
    } finally {
      setAppleBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 16 }}>
      <PaperBackground />
      <LinearGradient colors={['rgba(252,200,186,0.55)', 'rgba(243,233,210,0)']} style={[StyleSheet.absoluteFill, { height: 360 }]} />
      <View style={styles.brand}>
        <Image source={art.logo.source} style={{ width: 44, height: 44 }} contentFit="contain" />
        <Text style={styles.brandText}>TEQUILA TOWN</Text>
      </View>

      <Animated.ScrollView
        horizontal
        pagingEnabled
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={() => haptic.tap()}
        style={{ flexGrow: 0, marginTop: 20 }}
      >
        {SLIDES.map((_, i) => (
          <Slide key={i} index={i} scrollX={scrollX} width={width} maxArtH={Math.max(150, height * 0.27)} />
        ))}
      </Animated.ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <Dot key={i} index={i} scrollX={scrollX} width={width} />
        ))}
      </View>

      <Animated.View entering={FadeInDown.delay(250).springify()} style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Create my passport" onPress={() => router.push('/auth/sign-up')} full />
        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={29}
            style={{ height: 54, width: '100%', opacity: appleBusy ? 0.6 : 1 }}
            onPress={apple}
          />
        ) : null}
        <Button label="I have an account" variant="secondary" onPress={() => router.push('/auth/sign-in')} full />
        <PressableScale onPress={continueAsGuest} accessibilityLabel="Just browsing — continue without an account" style={{ alignSelf: 'center', padding: 8 }}>
          <Text style={styles.browse}>Just browsing →</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  brandText: { fontFamily: fonts.display, fontSize: 20, lineHeight: 22, letterSpacing: 1.4, color: colors.terracotta, marginTop: 3 },
  frame: { padding: 12, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.ink },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 18 },
  dot: { height: 9, borderRadius: 5, borderWidth: 1, borderColor: colors.ink },
  actions: { marginTop: 'auto', paddingHorizontal: gutter, gap: 12 },
  browse: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.inkSoft, textDecorationLine: 'underline' },
});
