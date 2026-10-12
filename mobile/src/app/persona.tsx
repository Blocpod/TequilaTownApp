import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { RefreshCw, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { drinkById } from '@shared/content/drinks';
import { experienceById } from '@shared/content/experiences';

import { Confetti } from '@/components/art/confetti';
import { PapelPicado } from '@/components/art/papel-picado';
import { InkSeal } from '@/components/art/stamp';
import { Button } from '@/components/ui/button';
import { PressCard, PrintCard } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { Ornament } from '@/components/ui/section';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { RecipeCard } from '@/features/oracle/recipe-card';
import { haptic } from '@/lib/haptics';
import { useMe } from '@/lib/queries';
import { shareText } from '@/lib/share';
import { artFor } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

export default function Persona() {
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data, isLoading } = useMe();
  const reduce = useReducedMotion();
  const flip = useSharedValue(fresh && !reduce ? 180 : 0);
  const [fire, setFire] = useState(0);

  useEffect(() => {
    if (!fresh || reduce) return;
    flip.set(withDelay(250, withTiming(0, { duration: 900, easing: Easing.out(Easing.back(1.2)) })));
    const t = setTimeout(() => {
      haptic.success();
      setFire((f) => f + 1);
    }, 800);
    return () => clearTimeout(t);
  }, [fresh, reduce, flip]);

  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 1200 }, { rotateY: `${flip.get()}deg` }], opacity: flip.get() > 90 ? 0 : 1 }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 1200 }, { rotateY: `${flip.get() - 180}deg` }], opacity: flip.get() > 90 ? 1 : 0 }));

  if (isLoading) return <LoadingState />;
  const persona = data?.progress.persona;
  if (!persona) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <PaperBackground />
        <TopBar leading="close" />
        <EmptyState art="iconAgaveFlower" title="No persona yet" message="Take the Ritual and the Oracle will reveal who you are." action={{ label: 'Take the Ritual', onPress: () => router.replace('/ritual') }} />
      </View>
    );
  }

  const pours = persona.recommendedDrinkIds.map(drinkById).filter(Boolean);
  const zones = persona.mustVisit.map(experienceById).filter(Boolean);
  const share = () => shareText(`The Oracle says I'm ${persona.title}: ${persona.archetype}. Find your agave persona at Tequila Town 🌵🥃`);

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar leading="close" right={<IconButton icon={Share2} label="Share my persona" onPress={share} />} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 70, paddingHorizontal: gutter, paddingBottom: insets.bottom + 40, gap: 20 }} showsVerticalScrollIndicator={false}>
        <Text variant="lede" color={colors.terracotta} align="center">
          The Oracle has spoken
        </Text>

        <View style={{ minHeight: 440 }}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.cardBack, back]} pointerEvents="none">
            <InkSeal size={180} color={colors.blush} label="TEQUILA TOWN" />
          </Animated.View>
          <Animated.View style={front}>
            <PrintCard background={colors.terracotta} shadowColor={colors.ink} offset={6} radius={radii.xl} contentStyle={styles.card}>
              <PapelPicado width={width - gutter * 2 - 40} colorsOverride={[colors.blush, colors.sun, colors.card]} />
              <Text variant="label" color={colors.blush} align="center" style={{ marginTop: 8 }}>
                Your agave persona
              </Text>
              <Text style={styles.title}>{persona.title.toUpperCase()}</Text>
              <Text variant="lede" color={colors.card} align="center" style={{ fontSize: 18 }}>
                {persona.archetype}
              </Text>
              <Ornament color={colors.blush} style={{ marginVertical: 12, paddingHorizontal: 0 }} />
              <Text variant="body" color={colors.card} align="center" style={{ fontSize: 16, lineHeight: 25 }}>
                {persona.description}
              </Text>
              <View style={styles.notes}>
                {persona.flavorNotes.map((n) => (
                  <View key={n} style={styles.note}>
                    <Text style={styles.noteText}>{n}</Text>
                  </View>
                ))}
              </View>
            </PrintCard>
          </Animated.View>
        </View>

        {pours.length ? (
          <Animated.View entering={FadeInDown.delay(300).springify()} style={{ gap: 10 }}>
            <Text variant="label" color={colors.terracotta}>
              Your pours
            </Text>
            {pours.map((d) => (
              <PressCard key={d!.id} onPress={() => router.push({ pathname: '/drinks/[id]', params: { id: d!.id } })} accessibilityLabel={`${d!.name} by ${d!.brand}`} contentStyle={styles.row}>
                <Image source={artFor(d!.image).source} style={styles.rowImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading">{d!.name}</Text>
                  <Text variant="small">
                    {d!.brand}. Notes of {d!.tastingNotes.slice(0, 3).join(', ').toLowerCase()}
                  </Text>
                </View>
              </PressCard>
            ))}
          </Animated.View>
        ) : null}

        {zones.length ? (
          <Animated.View entering={FadeInDown.delay(380).springify()} style={{ gap: 10 }}>
            <Text variant="label" color={colors.terracotta}>
              Don&apos;t miss
            </Text>
            {zones.map((z) => (
              <PressCard key={z!.id} onPress={() => router.push({ pathname: '/zone/[id]', params: { id: z!.id } })} accessibilityLabel={z!.name} contentStyle={styles.row}>
                <Image source={artFor(z!.image).source} style={styles.rowImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.zoneName}>{z!.name.toUpperCase()}</Text>
                  <Text variant="small">
                    Zone {z!.zone}: {z!.subtitle}
                  </Text>
                </View>
              </PressCard>
            ))}
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(460).springify()} style={{ gap: 10 }}>
          <Text variant="label" color={colors.terracotta}>
            Your signature cocktail
          </Text>
          <RecipeCard recipe={{ name: persona.signatureCocktail.name, ingredients: persona.signatureCocktail.ingredients, steps: [persona.signatureCocktail.method] }} />
        </Animated.View>

        <Button label="Retake the Ritual" icon={RefreshCw} variant="ghost" size="md" onPress={() => router.replace('/ritual')} style={{ alignSelf: 'center' }} />
      </ScrollView>
      <Confetti fire={fire} />
    </View>
  );
}

const styles = StyleSheet.create({
  cardBack: { borderRadius: radii.xl, backgroundColor: colors.ink, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginRight: 6, marginBottom: 6 },
  card: { padding: 20, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, letterSpacing: 1, color: colors.blush, textAlign: 'center', marginTop: 6 },
  notes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
  note: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.card, borderWidth: 1.2, borderColor: colors.ink },
  noteText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  rowImg: { width: 60, height: 60, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.ink },
  zoneName: { fontFamily: fonts.display, fontSize: 17, lineHeight: 19, letterSpacing: 0.8, color: colors.ink, marginTop: 2 },
});
