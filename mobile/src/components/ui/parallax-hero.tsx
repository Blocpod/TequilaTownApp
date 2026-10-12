import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { artFor } from '@/theme/art';
import { colors } from '@/theme/tokens';

const AnimatedImage = Animated.createAnimatedComponent(Image);

type Props = {
  image: string;
  height: number;
  scrollY: SharedValue<number>;
  /** bottom fade colour (defaults to paper) */
  fadeTo?: string;
  children?: ReactNode;
};

/** Full-bleed hero that stretches on pull-down and drifts slower than the content. */
export function ParallaxHero({ image, height, scrollY, fadeTo = colors.paper, children }: Props) {
  const img = artFor(image);
  const style = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      transform: [
        { translateY: y < 0 ? y / 2 : y * 0.5 },
        { scale: y < 0 ? 1 + -y / height : interpolate(y, [0, height], [1, 1.08], 'clamp') },
      ],
    };
  });
  return (
    <View style={{ height, overflow: 'hidden' }}>
      <AnimatedImage source={img.source} placeholder={img.blurhash ? { blurhash: img.blurhash } : undefined} style={[StyleSheet.absoluteFill, style]} contentFit="cover" transition={300} />
      <LinearGradient colors={['rgba(18,14,12,0.45)', 'rgba(18,14,12,0)', 'rgba(18,14,12,0)', fadeTo]} locations={[0, 0.28, 0.6, 1]} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}
