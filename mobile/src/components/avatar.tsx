import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { Text } from './ui/text';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'TT';

type Props = { name: string; url?: string | null; size?: number; oval?: boolean; style?: StyleProp<ViewStyle> };

/** Photo or monogram; `oval` gives the passport-photo shape. */
export function Avatar({ name, url, size = 56, oval = false, style }: Props) {
  const w = size;
  const h = oval ? size * 1.25 : size;
  return (
    <View style={[styles.base, { width: w, height: h, borderRadius: oval ? w / 2 : w / 2 }, style]} accessibilityLabel={`${name} avatar`}>
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.blush, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontFamily: fonts.serifBlack, color: colors.terracotta },
});
