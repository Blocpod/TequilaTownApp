import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Clock, GlassWater, MapPin, Share2 } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { drinks } from '@shared/content/drinks';
import { experienceById, experiences } from '@shared/content/experiences';
import { missionsForExperience } from '@shared/content/missions';
import { culture, food, music } from '@shared/content/program';
import { sponsorById } from '@shared/content/sponsors';

import { PressCard } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { ParallaxHero } from '@/components/ui/parallax-hero';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { Ornament } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { missionView } from '@/features/missions/logic';
import { MissionCard } from '@/features/missions/mission-card';
import { ZoneBadge } from '@/features/zones/zone-card';
import { useProgress } from '@/lib/queries';
import { shareText } from '@/lib/share';
import { artFor } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

function Pill({ icon: Icon, label }: { icon: typeof Clock; label: string }) {
  return (
    <View style={styles.pill}>
      <Icon size={14} color={colors.ink} strokeWidth={2.2} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export default function ZoneDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const zone = experienceById(id);
  const insets = useSafeAreaInsets();
  const progress = useProgress();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  if (!zone) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <PaperBackground />
        <TopBar />
        <EmptyState title="Zone not found" message="That corner of Tequila Town doesn't exist." />
      </View>
    );
  }

  const sponsor = zone.sponsorId ? sponsorById(zone.sponsorId) : undefined;
  const zoneMissions = missionsForExperience(zone.id).map((m) => missionView(m, progress));
  const poured = drinks.filter((d) => d.whereToTry.includes(zone.id));
  const program = [...music, ...culture, ...food].filter((p) => p.experienceId === zone.id);
  const next = experiences.find((e) => e.zone === zone.zone + 1) ?? experiences[0];
  const [first, ...rest] = zone.longDescription;

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar
        title={zone.name}
        tone="glass"
        scrollY={scrollY}
        threshold={300}
        right={<IconButton icon={Share2} tone="glass" label="Share this zone" onPress={() => shareText(`${zone.name} — ${zone.subtitle}. Zone ${zone.zone} of the Tequila Town journey 🌵`)} />}
      />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <ParallaxHero image={zone.motion ?? zone.image} height={400} scrollY={scrollY} />

        <View style={styles.body}>
          <Animated.View entering={FadeInDown.springify()} style={styles.titleBlock}>
            <ZoneBadge zone={zone.zone} color={zone.accent} size={44} />
            <View style={{ flex: 1 }}>
              <Text variant="lede" color={colors.terracotta}>
                {zone.subtitle}
              </Text>
              <Text variant="display" accessibilityRole="header">
                {zone.name.toUpperCase()}
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.pills}>
            <Pill icon={MapPin} label={`Zone ${zone.zone}`} />
            <Pill icon={Clock} label={zone.duration} />
            {zone.pour ? <Pill icon={GlassWater} label={zone.pour} /> : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(140).springify()}>
            <Text style={styles.story}>
              <Text style={styles.dropCap}>{first}</Text>
              {rest.join('')}
            </Text>
          </Animated.View>

          {zoneMissions.length ? (
            <View style={styles.section}>
              <Text variant="label" color={colors.terracotta}>
                Mission
              </Text>
              {zoneMissions.map((v) => (
                <MissionCard key={v.mission.id} view={v} />
              ))}
            </View>
          ) : null}

          {poured.length ? (
            <View style={styles.section}>
              <Text variant="label" color={colors.terracotta}>
                Poured here
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: gutter }} style={{ marginHorizontal: -gutter, paddingLeft: gutter }}>
                {poured.map((d) => (
                  <PressCard key={d.id} onPress={() => router.push({ pathname: '/drinks/[id]', params: { id: d.id } })} accessibilityLabel={`${d.name} by ${d.brand}`} style={{ width: 150 }} contentStyle={{ padding: 8, gap: 6 }}>
                    <Image source={artFor(d.image).source} style={styles.drinkImg} contentFit="cover" />
                    <Text style={styles.drinkName} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text variant="small" numberOfLines={1}>
                      {d.brand}
                    </Text>
                  </PressCard>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {program.length ? (
            <View style={styles.section}>
              <Text variant="label" color={colors.terracotta}>
                Happening here
              </Text>
              {program.map((p) => (
                <View key={p.id} style={styles.programRow}>
                  <Text style={styles.programTime}>{p.time}</Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{p.title}</Text>
                    <Text variant="small">{p.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {sponsor ? (
            <PressCard onPress={() => router.push({ pathname: '/sponsors/[id]', params: { id: sponsor.id } })} accessibilityLabel={`Presented by ${sponsor.name}`} background={sponsor.color} contentStyle={styles.sponsor}>
              <View style={styles.mono}>
                <Text style={styles.monoText}>{sponsor.monogram}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label" color="rgba(251,246,234,0.75)">
                  Presented by
                </Text>
                <Text variant="subheading" color={colors.card}>
                  {sponsor.name}
                </Text>
                <Text variant="small" color="rgba(251,246,234,0.85)" numberOfLines={2}>
                  {sponsor.description}
                </Text>
              </View>
              <ArrowRight size={20} color={colors.card} />
            </PressCard>
          ) : null}

          <Ornament style={{ marginVertical: 8, paddingHorizontal: 0 }} />

          <PressCard onPress={() => router.replace({ pathname: '/zone/[id]', params: { id: next.id } })} accessibilityLabel={`Next on the trail: ${next.name}`} contentStyle={styles.next}>
            <Image source={artFor(next.image).source} style={styles.nextImg} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text variant="label">Next on the trail</Text>
              <Text style={styles.drinkName}>{next.name.toUpperCase()}</Text>
              <Text variant="small">{next.subtitle}</Text>
            </View>
            <ArrowRight size={20} color={colors.ink} />
          </PressCard>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: gutter, gap: 18, marginTop: -36 },
  titleBlock: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: radii.pill, borderWidth: 1.2, borderColor: colors.ink, backgroundColor: colors.card },
  pillText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink },
  story: { fontFamily: fonts.serifRegular, fontSize: 18, lineHeight: 28, color: colors.inkSoft },
  dropCap: { fontFamily: fonts.serifBlack, fontSize: 44, lineHeight: 44, color: colors.terracotta },
  section: { gap: 10 },
  drinkImg: { width: '100%', height: 110, borderRadius: radii.sm },
  drinkName: { fontFamily: fonts.display, fontSize: 15, lineHeight: 17, letterSpacing: 0.6, color: colors.ink, marginTop: 2 },
  programRow: { flexDirection: 'row', gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.inkFaint },
  programTime: { width: 72, fontFamily: fonts.serifBlack, fontSize: 15, color: colors.terracotta },
  sponsor: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  mono: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  monoText: { fontFamily: fonts.serifBlack, fontSize: 18, color: colors.ink },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  nextImg: { width: 64, height: 64, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.ink },
});
