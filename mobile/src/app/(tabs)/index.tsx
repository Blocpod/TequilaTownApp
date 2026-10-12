import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowRight, Eye, ScanLine, ShoppingBag } from 'lucide-react-native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { experiences } from '@shared/content/experiences';
import { festival } from '@shared/content/festival';

import { PapelPicado } from '@/components/art/papel-picado';
import { FacebookGlyph, InstagramGlyph, XGlyph } from '@/components/art/social-icons';
import { PressCard } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { PaperBackground, TAB_BAR_SPACE } from '@/components/ui/screen';
import { Ornament, SectionHeader } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { FestivalStatus } from '@/features/home/festival-status';
import { JourneyCard } from '@/features/home/journey-card';
import { StoryBubbles } from '@/features/sponsors/story-bubbles';
import { ZoneCard } from '@/features/zones/zone-card';
import { zoneStamped } from '@/features/missions/logic';
import { useProgress } from '@/lib/queries';
import { usePrefs } from '@/state/prefs';
import { useIsSignedIn, useUser } from '@/state/session';
import { art, type ArtKey } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const TILES: { art: ArtKey; label: string; href: '/drinks' | '/program/food' | '/program/culture' | '/program/music' }[] = [
  { art: 'tileDrinks', label: 'Drinks', href: '/drinks' },
  { art: 'tileFood', label: 'Food', href: '/program/food' },
  { art: 'tileCulture', label: 'Culture', href: '/program/culture' },
  { art: 'tileMusic', label: 'Music', href: '/program/music' },
];

export default function Home() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const signedIn = useIsSignedIn();
  const user = useUser();
  const progress = useProgress();
  const bagCount = usePrefs((s) => s.bag.reduce((n, b) => n + b.qty, 0));
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const heroH = Math.min(width * 1.02, 440);
  const logo = Math.min(width * 0.5, 210);
  const tile = (width - gutter * 2 - 14) / 2;
  const zoneW = Math.min(width * 0.62, 260);

  const heroStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      transform: [{ translateY: y < 0 ? y / 2 : y * 0.45 }, { scale: y < 0 ? 1 + -y / heroH : 1 }],
    };
  });
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.get() * 0.18 }, { rotate: `${interpolate(scrollY.get(), [-100, 0, 300], [-8, 0, 10])}deg` }],
  }));

  const firstName = user?.name?.split(' ')[0];

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }}>
        {/* Hero */}
        <View style={{ height: heroH, overflow: 'visible' }}>
          <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
            <AnimatedImage source={art.heroAgaveBloom.source} placeholder={{ blurhash: art.heroAgaveBloom.blurhash! }} style={[StyleSheet.absoluteFill, heroStyle]} contentFit="cover" />
            <LinearGradient colors={['rgba(18,14,12,0.35)', 'rgba(18,14,12,0)', 'rgba(243,233,210,0)', colors.paper]} locations={[0, 0.3, 0.72, 1]} style={StyleSheet.absoluteFill} />
          </View>
          <PapelPicado width={width} style={{ position: 'absolute', top: insets.top + 54 }} />
          <View style={[styles.topRow, { top: insets.top + 6 }]}>
            <View>
              <Text style={styles.greet}>{signedIn && firstName ? `¡Hola, ${firstName}!` : '¡Bienvenidos!'}</Text>
              <Text style={styles.greetSub}>{festival.tagline}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <IconButton icon={ShoppingBag} label="Mercado shop" tone="glass" badge={bagCount} onPress={() => router.push('/shop')} />
              <IconButton icon={ScanLine} label="Scan a QR code" tone="glass" onPress={() => router.push('/scan')} />
            </View>
          </View>
          <Animated.View style={[styles.logo, { width: logo, height: logo, left: (width - logo) / 2, bottom: -logo * 0.18 }, logoStyle]}>
            <Image source={art.logo.source} style={{ width: logo, height: logo }} contentFit="contain" accessibilityLabel="Tequila Town" />
          </Animated.View>
        </View>

        <View style={{ height: logo * 0.18 + 22 }} />

        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
          <FestivalStatus />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.section}>
          <JourneyCard />
        </Animated.View>

        {/* Explore */}
        <SectionHeader kicker="Sip, savor, celebrate" title="Explore" style={{ marginTop: 30 }} />
        <View style={styles.tiles}>
          {TILES.map((t, i) => (
            <Animated.View key={t.label} entering={FadeInDown.delay(220 + i * 60).springify()}>
              <PressCard onPress={() => router.push(t.href)} accessibilityLabel={t.label} style={{ width: tile }} radius={radii.md}>
                <Image source={art[t.art].source} placeholder={art[t.art].blurhash ? { blurhash: art[t.art].blurhash! } : undefined} style={{ width: '100%', aspectRatio: 1 }} contentFit="cover" />
              </PressCard>
            </Animated.View>
          ))}
        </View>

        <View style={styles.section}>
          <PressCard onPress={() => router.push('/journey')} accessibilityLabel="The Experience — see all twelve zones" radius={radii.lg}>
            <View style={{ height: 150 }}>
              <Image source={art.experienceHero.source} placeholder={{ blurhash: art.experienceHero.blurhash! }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
              <LinearGradient colors={['rgba(18,14,12,0.05)', 'rgba(18,14,12,0.55)']} style={StyleSheet.absoluteFill} />
              <View style={styles.expLabel}>
                <Text style={styles.expTitle}>THE EXPERIENCE</Text>
                <View style={styles.expRow}>
                  <Text variant="lede" color={colors.paper} style={{ fontSize: 15 }}>
                    Twelve zones, one journey
                  </Text>
                  <ArrowRight size={18} color={colors.paper} />
                </View>
              </View>
            </View>
          </PressCard>
        </View>

        {/* Zones carousel */}
        <SectionHeader kicker="Where the night takes you" title="The Zones" action={{ label: 'Map', onPress: () => router.push('/journey') }} style={{ marginTop: 30 }} />
        <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={zoneW + 14} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: gutter, gap: 14 }}>
          {experiences.map((z) => (
            <ZoneCard key={z.id} zone={z} width={zoneW} stamped={zoneStamped(z.id, progress)} />
          ))}
        </Animated.ScrollView>

        {/* Oracle promo */}
        <View style={[styles.section, { marginTop: 30 }]}>
          <PressCard onPress={() => router.push('/oracle')} background={colors.night} shadowColor={colors.terracotta} accessibilityLabel="Consult the Oracle" contentStyle={styles.oracle}>
            <Image source={art.oracleCantinero.source} style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} contentFit="cover" />
            <LinearGradient colors={['rgba(18,14,12,0.2)', 'rgba(18,14,12,0.92)']} style={StyleSheet.absoluteFill} />
            <View style={styles.oracleEye}>
              <Eye size={26} color={colors.blush} />
            </View>
            <Text variant="lede" color={colors.blush}>
              Ask the spirits
            </Text>
            <Text variant="display" color={colors.paper}>
              THE ORACLE
            </Text>
            <Text variant="body" color="rgba(243,233,210,0.8)">
              Your AI cantinero, a pairing-obsessed chef, a bottle scanner and a 1940s portrait studio.
            </Text>
          </PressCard>
        </View>

        {/* Stories */}
        <SectionHeader kicker="From the houses" title="Stories" action={{ label: 'Sponsors', onPress: () => router.push('/sponsors') }} style={{ marginTop: 30 }} />
        <StoryBubbles />

        {/* Mercado */}
        <View style={[styles.section, { marginTop: 30 }]}>
          <PressCard onPress={() => router.push('/shop')} accessibilityLabel="Visit the Mercado shop" contentStyle={styles.shop}>
            <Image source={art.tileShop.source} style={styles.shopImg} contentFit="cover" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="lede" color={colors.terracotta}>
                El Mercado
              </Text>
              <Text variant="title">THE SHOP</Text>
              <Text variant="small">Reserve merch & goods, pick up at the Mercado.</Text>
            </View>
          </PressCard>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Ornament />
          <Text variant="lede" align="center" style={{ marginTop: 14 }}>
            Drink to remember. Please enjoy responsibly.
          </Text>
          <View style={styles.socials}>
            <IconButton icon={InstagramGlyph} label="Instagram" onPress={() => WebBrowser.openBrowserAsync(festival.socials.instagram)} />
            <IconButton icon={FacebookGlyph} label="Facebook" onPress={() => WebBrowser.openBrowserAsync(festival.socials.facebook)} />
            <IconButton icon={XGlyph} label="X" onPress={() => WebBrowser.openBrowserAsync(festival.socials.x)} />
          </View>
          <PressableScale onPress={() => router.push('/leaderboard')} accessibilityLabel="Leaderboard" style={{ alignSelf: 'center', marginTop: 10 }}>
            <Text style={styles.footLink}>Leaderboard · Hall of Legends</Text>
          </PressableScale>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { position: 'absolute', left: gutter, right: gutter, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greet: { fontFamily: fonts.serifBoldItalic, fontSize: 22, color: colors.card, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8 },
  greetSub: { fontFamily: fonts.sansSemiBold, fontSize: 11, letterSpacing: 1.4, color: colors.card, textTransform: 'uppercase', opacity: 0.92 },
  logo: { position: 'absolute' },
  section: { paddingHorizontal: gutter, marginTop: 16 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: gutter },
  expLabel: { position: 'absolute', left: 16, right: 16, bottom: 12 },
  expTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: 1, color: '#E0D8B2' },
  expRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  oracle: { padding: 20, gap: 4, minHeight: 210, justifyContent: 'flex-end' },
  oracleEye: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shop: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  shopImg: { width: 92, height: 92, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.ink },
  footer: { marginTop: 40, paddingBottom: 10 },
  socials: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 14 },
  footLink: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.inkSoft, textDecorationLine: 'underline' },
});
