import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { art } from '@/theme/art';
import { colors, fonts, gutter } from '@/theme/tokens';

import { IconButton } from './icon-button';
import { Text } from './text';

/** Space reserved at the bottom of tab screens for the floating tab bar. */
export const TAB_BAR_SPACE = 118;

/** Aged parchment under every paper screen. */
export function PaperBackground({ night = false, style }: { night?: boolean; style?: StyleProp<ViewStyle> }) {
  if (night) return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.night }, style]} />;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.paper }, style]} pointerEvents="none">
      <Image source={art.parchment.source} style={[StyleSheet.absoluteFill, { opacity: 0.7 }]} contentFit="cover" />
    </View>
  );
}

type ScreenProps = {
  children: ReactNode;
  night?: boolean;
  /** pad the top by the safe-area inset (off for screens with a full-bleed hero) */
  safeTop?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Screen({ children, night = false, safeTop = true, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, paddingTop: safeTop ? insets.top : 0 }, style]}>
      <PaperBackground night={night} />
      {children}
    </View>
  );
}

type TopBarProps = {
  title?: string;
  /** 'back' pops; 'close' dismisses a modal */
  leading?: 'back' | 'close' | 'none';
  right?: ReactNode;
  tone?: 'paper' | 'glass' | 'ink';
  /** when given, a paper backdrop + title fade in as the content scrolls past `threshold` */
  scrollY?: SharedValue<number>;
  threshold?: number;
  night?: boolean;
  onBack?: () => void;
};

/** Floating top bar used on every pushed screen. */
export function TopBar({ title, leading = 'back', right, tone = 'paper', scrollY, threshold = 160, night = false, onBack }: TopBarProps) {
  const insets = useSafeAreaInsets();
  const backdrop = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 1 };
    return { opacity: interpolate(scrollY.get(), [threshold - 60, threshold], [0, 1], 'clamp') };
  });
  const goBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const bg = night ? 'rgba(18,14,12,0.96)' : 'rgba(243,233,210,0.97)';
  const fg = night ? colors.paper : colors.ink;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: bg, borderBottomWidth: 1, borderBottomColor: night ? colors.nightLine : colors.inkFaint }, scrollY ? backdrop : null]}
      />
      <View style={styles.side}>
        {leading !== 'none' ? (
          <IconButton icon={leading === 'close' ? X : ChevronLeft} label={leading === 'close' ? 'Close' : 'Back'} tone={tone} onPress={goBack} />
        ) : null}
      </View>
      {title ? (
        <Animated.View style={[styles.titleWrap, scrollY ? backdrop : null]} pointerEvents="none">
          <Text numberOfLines={1} style={[styles.title, { color: fg }]}>
            {title.toUpperCase()}
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.titleWrap} />
      )}
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gutter - 4,
    paddingBottom: 10,
  },
  side: { width: 96, flexDirection: 'row', gap: 8 },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 19, lineHeight: 21, letterSpacing: 1, marginTop: 3 },
});
