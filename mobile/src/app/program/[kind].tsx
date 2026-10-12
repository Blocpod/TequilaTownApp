import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { experienceById } from '@shared/content/experiences';
import { culture, food, music, type ProgramItem } from '@shared/content/program';

import { PressCard } from '@/components/ui/card';
import { Tag } from '@/components/ui/chip';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { artFor, type ArtKey } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

const KINDS: Record<string, { items: ProgramItem[]; title: string; kicker: string; blurb: string; hero: ArtKey; accent: string }> = {
  food: { items: food, title: 'Food', kicker: 'Antojitos & more', blurb: 'Street stands, signature plates and something sweet — all within a few steps of a pour.', hero: 'heroFood', accent: colors.marigold },
  culture: { items: culture, title: 'Culture', kicker: 'Tradición viva', blurb: 'Jimadors, folklórico, artisans and 250 years of heritage.', hero: 'heroCulture', accent: colors.agave },
  music: { items: music, title: 'Music', kicker: 'From mariachi to midnight', blurb: 'Live performances and DJ sets from the first trumpet to the last song.', hero: 'heroMusic', accent: colors.terracotta },
};

function Featured({ item, width }: { item: ProgramItem; width: number }) {
  const zone = experienceById(item.experienceId);
  return (
    <PressCard onPress={() => router.push({ pathname: '/zone/[id]', params: { id: item.experienceId } })} accessibilityLabel={`${item.title}, ${item.time}`} style={{ width }}>
      <Image source={artFor(item.image).source} style={{ width: '100%', height: width * 0.62 }} contentFit="cover" />
      <View style={{ padding: 12, gap: 4, borderTopWidth: 1.5, borderColor: colors.ink }}>
        {item.tag ? <Tag label={item.tag} /> : null}
        <Text style={styles.title} numberOfLines={1}>
          {item.title.toUpperCase()}
        </Text>
        <Text variant="small">
          {item.time} · {zone?.name}
        </Text>
      </View>
    </PressCard>
  );
}

export default function Program() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const meta = KINDS[kind ?? ''] ?? KINDS.music;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const featured = meta.items.filter((i) => i.featured);
  const timeline = meta.items;

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar title={meta.title} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 70, paddingBottom: insets.bottom + 40, gap: 22 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.springify()} style={styles.hero}>
          <Image source={artFor(meta.hero).source} style={styles.heroImg} contentFit="cover" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="lede" color={meta.accent}>
              {meta.kicker}
            </Text>
            <Text variant="display" accessibilityRole="header">
              {meta.title.toUpperCase()}
            </Text>
            <Text variant="small">{meta.blurb}</Text>
          </View>
        </Animated.View>

        {featured.length ? (
          <View style={{ gap: 12 }}>
            <Text variant="label" color={meta.accent} style={{ paddingHorizontal: gutter }}>
              Featured
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: 14 }}>
              {featured.map((f) => (
                <Featured key={f.id} item={f} width={Math.min(width * 0.68, 280)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: gutter, gap: 4 }}>
          <Text variant="label" color={meta.accent} style={{ marginBottom: 8 }}>
            {kind === 'food' ? 'On the menu' : 'Daily schedule'}
          </Text>
          {timeline.map((item, i) => {
            const zone = experienceById(item.experienceId);
            return (
              <Animated.View key={item.id} entering={FadeInDown.delay(i * 50).springify()} style={styles.tlRow}>
                <View style={styles.tlTime}>
                  <Text style={[styles.time, { color: meta.accent }]}>{item.time}</Text>
                </View>
                <View style={styles.tlRail}>
                  <View style={[styles.tlDot, { backgroundColor: meta.accent }]} />
                  {i < timeline.length - 1 ? <View style={styles.tlLine} /> : null}
                </View>
                <PressCard onPress={() => router.push({ pathname: '/zone/[id]', params: { id: item.experienceId } })} accessibilityLabel={`${item.title} at ${zone?.name}, ${item.time}`} style={{ flex: 1, marginBottom: 12 }} contentStyle={styles.tlCard}>
                  <Image source={artFor(item.image).source} style={styles.tlImg} contentFit="cover" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{item.title}</Text>
                    <Text variant="small" numberOfLines={2}>
                      {item.description}
                    </Text>
                    <View style={styles.where}>
                      <MapPin size={12} color={colors.inkMuted} />
                      <Text variant="small" style={{ fontFamily: fonts.sansSemiBold }}>
                        {zone?.name}
                      </Text>
                    </View>
                  </View>
                </PressCard>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: gutter },
  heroImg: { width: 110, height: 110, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, letterSpacing: 0.8, color: colors.ink, marginTop: 2 },
  tlRow: { flexDirection: 'row', gap: 10 },
  tlTime: { width: 62, paddingTop: 14 },
  time: { fontFamily: fonts.serifBlack, fontSize: 14 },
  tlRail: { width: 14, alignItems: 'center' },
  tlDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.ink, marginTop: 16 },
  tlLine: { flex: 1, width: 2, backgroundColor: colors.inkFaint, marginTop: 4 },
  tlCard: { flexDirection: 'row', gap: 10, padding: 10, alignItems: 'center' },
  tlImg: { width: 56, height: 56, borderRadius: radii.sm, borderWidth: 1.2, borderColor: colors.ink },
  where: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
});
