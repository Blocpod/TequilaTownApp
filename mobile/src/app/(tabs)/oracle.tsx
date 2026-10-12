import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { ArrowRight, Images } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { aiLimits } from '@shared/content/oracle';

import { OracleEye } from '@/components/art/oracle-eye';
import { PressCard } from '@/components/ui/card';
import { Tag } from '@/components/ui/chip';
import { PressableScale } from '@/components/ui/pressable-scale';
import { TAB_BAR_SPACE } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useProgress } from '@/lib/queries';
import { useNightStatusBar } from '@/lib/use-night-status-bar';
import { useIsSignedIn } from '@/state/session';
import { art, type ArtKey } from '@/theme/art';
import { colors, fonts, gutter } from '@/theme/tokens';

type Feature = { href: Href; art: ArtKey; kicker: string; title: string; body: string; tag?: string };

const FEATURES: Feature[] = [
  {
    href: '/oracle/memoria',
    art: 'oracleMemoria',
    kicker: 'The Living Memory',
    title: 'La Memoria Viva',
    body: 'Take a selfie — the Oracle returns you as a jimador in the 1870s, 1940s or 1950s.',
    tag: 'Portrait studio',
  },
  {
    href: '/oracle/chat/cantinero',
    art: 'oracleCantinero',
    kicker: 'The Bartender',
    title: 'El Cantinero',
    body: 'Tell him what you like. He finds your pour or builds you a cocktail, recipe card and all.',
    tag: 'AI bartender',
  },
  {
    href: '/oracle/chat/mesa',
    art: 'oracleMesa',
    kicker: 'The Table',
    title: 'La Mesa',
    body: 'Every dish at Tequila Town and the pour that makes it sing.',
    tag: 'Pairings',
  },
  {
    href: '/oracle/ojo',
    art: 'oracleOjo',
    kicker: 'The Eye',
    title: 'El Ojo',
    body: 'Point at any bottle. Know its style, tasting notes, and how to serve it.',
    tag: 'Bottle scanner',
  },
];

export default function Oracle() {
  useNightStatusBar();
  const insets = useSafeAreaInsets();
  const signedIn = useIsSignedIn();
  const progress = useProgress();

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <LinearGradient colors={['#2A1A12', colors.night, colors.night]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: TAB_BAR_SPACE + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <OracleEye size={170} />
          <Text variant="lede" color={colors.blush} align="center" style={{ marginTop: 6 }}>
            Ask the spirits
          </Text>
          <Text variant="hero" color={colors.paper} align="center" accessibilityRole="header">
            THE ORACLE
          </Text>
          <Text variant="body" color="rgba(243,233,210,0.72)" align="center" style={{ maxWidth: 320 }}>
            Four ways to see Tequila Town through the agave’s eyes.
          </Text>
          {signedIn && progress ? (
            <Text variant="small" color="rgba(243,233,210,0.55)" align="center" style={{ marginTop: 6 }}>
              Today: {progress.ai.chat}/{aiLimits.chatMessages} messages · {progress.ai.memories}/{aiLimits.memories} portraits · {progress.ai.identify}/{aiLimits.identifications} scans
            </Text>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: gutter, gap: 18 }}>
          {FEATURES.map((f, i) => (
            <Animated.View key={f.title} entering={FadeInDown.delay(120 + i * 80).springify()}>
              <PressCard onPress={() => router.push(f.href)} background={colors.nightCard} borderColor={colors.nightLine} shadowColor={colors.terracotta} accessibilityLabel={`${f.title}, ${f.kicker}`} contentStyle={{ minHeight: 210 }}>
                <Image source={art[f.art].source} placeholder={art[f.art].blurhash ? { blurhash: art[f.art].blurhash! } : undefined} style={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient colors={['rgba(18,14,12,0)', 'rgba(18,14,12,0.55)', 'rgba(18,14,12,0.96)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
                <View style={styles.cardBody}>
                  {f.tag ? <Tag label={f.tag} color={colors.blush} style={{ marginBottom: 8 }} /> : null}
                  <Text variant="lede" color={colors.blush} style={{ fontSize: 15 }}>
                    {f.kicker}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.cardTitle}>{f.title.toUpperCase()}</Text>
                    <ArrowRight size={22} color={colors.paper} />
                  </View>
                  <Text variant="small" color="rgba(243,233,210,0.82)">
                    {f.body}
                  </Text>
                </View>
              </PressCard>
              {f.href === '/oracle/memoria' && signedIn ? (
                <PressableScale onPress={() => router.push('/oracle/gallery')} accessibilityLabel="My memories gallery" style={styles.galleryLink}>
                  <Images size={16} color={colors.blush} />
                  <Text style={styles.galleryText}>My memories</Text>
                </PressableScale>
              ) : null}
            </Animated.View>
          ))}

          <PressCard
            onPress={() => router.push(progress?.persona ? '/persona' : signedIn ? '/ritual' : '/auth/sign-up')}
            background={colors.blush}
            shadowColor={colors.terracotta}
            accessibilityLabel="Your agave persona"
            contentStyle={styles.persona}
          >
            <Text variant="lede" color={colors.terracotta}>
              {progress?.persona ? 'Your agave persona' : 'Take the Ritual'}
            </Text>
            <Text variant="title">{progress?.persona ? progress.persona.title.toUpperCase() : 'WHO ARE YOU, AMIGO?'}</Text>
            <Text variant="small" color={colors.inkSoft}>
              {progress?.persona ? progress.persona.archetype : 'Seven quick taps and the Oracle reads your spirit — your pours, your zones, your signature cocktail.'}
            </Text>
          </PressCard>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: gutter, paddingBottom: 26, gap: 2 },
  cardBody: { flex: 1, justifyContent: 'flex-end', padding: 18, gap: 2 },
  cardTitle: { flexShrink: 1, fontFamily: fonts.display, fontSize: 30, lineHeight: 32, letterSpacing: 1, color: colors.paper, marginTop: 2 },
  galleryLink: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-end', paddingVertical: 10, paddingHorizontal: 4 },
  galleryText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.blush },
  persona: { padding: 18, gap: 4 },
});
