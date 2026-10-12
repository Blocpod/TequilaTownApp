import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Copy, Play, Tag as TagIcon } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { experiences } from '@shared/content/experiences';
import { missions } from '@shared/content/missions';
import { sponsorById } from '@shared/content/sponsors';

import { Button } from '@/components/ui/button';
import { PrintCard } from '@/components/ui/card';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { missionView } from '@/features/missions/logic';
import { MissionCard } from '@/features/missions/mission-card';
import { ZoneCard } from '@/features/zones/zone-card';
import { haptic } from '@/lib/haptics';
import { useProgress } from '@/lib/queries';
import { artFor } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

export default function SponsorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sponsor = sponsorById(id);
  const insets = useSafeAreaInsets();
  const progress = useProgress();

  if (!sponsor) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <PaperBackground />
        <TopBar />
        <EmptyState title="House not found" />
      </View>
    );
  }

  const theirMissions = missions.filter((m) => m.sponsorId === sponsor.id).map((m) => missionView(m, progress));
  const theirZones = experiences.filter((e) => e.sponsorId === sponsor.id);
  const cover = artFor(sponsor.stories[0]?.image);

  const copy = async (code: string) => {
    await Clipboard.setStringAsync(code);
    haptic.success();
    toast.success('Code copied', `${code} — show it at the Mercado.`);
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar tone="glass" title={sponsor.name} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 300 }}>
          <Image source={cover.source} placeholder={cover.blurhash ? { blurhash: cover.blurhash } : undefined} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(18,14,12,0.45)', `${sponsor.color}CC`, colors.paper]} locations={[0, 0.65, 1]} style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.body}>
          <Animated.View entering={FadeInDown.springify()} style={styles.head}>
            <View style={[styles.mono, { backgroundColor: sponsor.color }]}>
              <Text style={styles.monoText}>{sponsor.monogram}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="lede" color={colors.terracotta}>
                {sponsor.description}
              </Text>
              <Text variant="display" accessibilityRole="header">
                {sponsor.name.toUpperCase()}
              </Text>
            </View>
          </Animated.View>
          <Text style={styles.story}>{sponsor.story}</Text>
          <Button label="Watch their story" icon={Play} variant="dark" onPress={() => router.push({ pathname: '/stories/[id]', params: { id: sponsor.id } })} />

          {sponsor.offers.length ? (
            <View style={{ gap: 10 }}>
              <Text variant="label" color={colors.terracotta}>
                Festival offers
              </Text>
              {sponsor.offers.map((o) => (
                <PrintCard key={o.title} background={colors.sun} contentStyle={styles.offer}>
                  <TagIcon size={22} color={colors.ink} />
                  <View style={{ flex: 1 }}>
                    <Text variant="subheading">{o.title}</Text>
                    <Text variant="small" color={colors.inkSoft}>
                      {o.description}
                    </Text>
                  </View>
                  {o.code ? <Button label={o.code} icon={Copy} size="sm" variant="secondary" onPress={() => copy(o.code!)} accessibilityHint="Copies the offer code" /> : null}
                </PrintCard>
              ))}
            </View>
          ) : null}

          {theirMissions.length ? (
            <View style={{ gap: 10 }}>
              <Text variant="label" color={colors.terracotta}>
                Missions
              </Text>
              {theirMissions.map((v) => (
                <MissionCard key={v.mission.id} view={v} />
              ))}
            </View>
          ) : null}
        </View>

        {theirZones.length ? (
          <View style={{ gap: 10, marginTop: 18 }}>
            <Text variant="label" color={colors.terracotta} style={{ paddingHorizontal: gutter }}>
              Their zones
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: 14 }}>
              {theirZones.map((z) => (
                <ZoneCard key={z.id} zone={z} width={220} />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: gutter, gap: 18, marginTop: -60 },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  mono: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  monoText: { fontFamily: fonts.serifBlack, fontSize: 24, color: colors.card },
  story: { fontFamily: fonts.serifRegular, fontSize: 17.5, lineHeight: 27, color: colors.inkSoft },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radii.lg },
});
