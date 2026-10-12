import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { sponsors } from '@shared/content/sponsors';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { artFor } from '@/theme/art';
import { colors, fonts, gutter } from '@/theme/tokens';

/** Instagram-style story rings for each sponsor house. */
export function StoryBubbles() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: 14 }}>
      {sponsors.map((s) => {
        const img = artFor(s.stories[0]?.image);
        return (
          <PressableScale
            key={s.id}
            onPress={() => router.push({ pathname: '/stories/[id]', params: { id: s.id } })}
            accessibilityLabel={`${s.name} story`}
            style={styles.item}
          >
            <View style={[styles.ring, { borderColor: s.color }]}>
              <Image source={img.source} placeholder={img.blurhash ? { blurhash: img.blurhash } : undefined} style={styles.img} contentFit="cover" />
              <View style={[styles.mono, { backgroundColor: s.color }]}>
                <Text style={styles.monoText}>{s.monogram}</Text>
              </View>
            </View>
            <Text variant="small" numberOfLines={1} style={styles.name}>
              {s.name}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const SIZE = 74;
const styles = StyleSheet.create({
  item: { width: SIZE + 8, alignItems: 'center', gap: 6 },
  ring: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3, padding: 3, backgroundColor: colors.card },
  img: { flex: 1, borderRadius: SIZE / 2, borderWidth: 1.2, borderColor: colors.ink },
  mono: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    minWidth: 28,
    height: 24,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monoText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: colors.card },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 11.5, color: colors.inkSoft, textAlign: 'center' },
});
