import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Heart, MessageCircle, Percent, Star } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { drinkById, drinkCategories } from '@shared/content/drinks';
import { experienceById } from '@shared/content/experiences';

import { Button } from '@/components/ui/button';
import { PressCard } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { ParallaxHero } from '@/components/ui/parallax-hero';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useBookmarks } from '@/features/drinks/bookmarks';
import { Price } from '@/features/drinks/price';
import { useChats } from '@/features/oracle/chat-store';
import { useIsSignedIn } from '@/state/session';
import { artFor } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

export default function DrinkDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const drink = drinkById(id);
  const insets = useSafeAreaInsets();
  const bookmarks = useBookmarks();
  const signedIn = useIsSignedIn();
  const send = useChats((s) => s.send);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  if (!drink) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <PaperBackground />
        <TopBar />
        <EmptyState title="Not on the menu" />
      </View>
    );
  }
  const cat = drinkCategories.find((c) => c.id === drink.category)!;
  const saved = bookmarks.has(drink.id);

  const ask = () => {
    if (signedIn) void send('cantinero', `Tell me about ${drink.brand} ${drink.name}. How should I drink it, and what would you mix with it?`);
    router.push('/oracle/chat/cantinero');
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar
        title={drink.name}
        tone="glass"
        scrollY={scrollY}
        threshold={280}
        right={<IconButton icon={Heart} tone={saved ? 'terracotta' : 'glass'} label={saved ? 'Remove from saved' : 'Save to passport'} onPress={() => bookmarks.toggle(drink.id)} />}
      />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <ParallaxHero image={drink.image} height={360} scrollY={scrollY} />
        <View style={styles.body}>
          <Animated.View entering={FadeInDown.springify()} style={{ gap: 4 }}>
            <Text variant="label" color={colors.terracotta}>
              {drink.brand}
            </Text>
            <Text variant="display" accessibilityRole="header">
              {drink.name.toUpperCase()}
            </Text>
          </Animated.View>

          <View style={styles.facts}>
            <View style={[styles.fact, { backgroundColor: cat.color }]}>
              <Text variant="label" color={colors.ink}>
                Style
              </Text>
              <Text style={styles.factValue}>{cat.label}</Text>
            </View>
            <View style={styles.fact}>
              <Text variant="label">Rating</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Star size={15} color={colors.marigold} fill={colors.marigold} />
                <Text style={styles.factValue}>{drink.rating.toFixed(1)}</Text>
              </View>
            </View>
            <View style={styles.fact}>
              <Text variant="label">ABV</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={styles.factValue}>{drink.abv}</Text>
                <Percent size={13} color={colors.ink} />
              </View>
            </View>
            <View style={styles.fact}>
              <Text variant="label">Price</Text>
              <Price level={drink.price} />
            </View>
          </View>

          <Text style={styles.desc}>{drink.description}</Text>
          <Text variant="small">{cat.blurb}</Text>

          <View style={{ gap: 10 }}>
            <Text variant="label" color={colors.terracotta}>
              Tasting notes
            </Text>
            <View style={styles.notes}>
              {drink.tastingNotes.map((n) => (
                <View key={n} style={styles.note}>
                  <Text style={styles.noteText}>{n}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text variant="label" color={colors.terracotta}>
              Where to try it
            </Text>
            {drink.whereToTry.map((zid) => {
              const z = experienceById(zid);
              if (!z) return null;
              return (
                <PressCard key={zid} onPress={() => router.push({ pathname: '/zone/[id]', params: { id: zid } })} accessibilityLabel={`Zone ${z.zone}, ${z.name}`} contentStyle={styles.zone}>
                  <Image source={artFor(z.image).source} style={styles.zoneImg} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zoneName}>{z.name.toUpperCase()}</Text>
                    <Text variant="small">
                      Zone {z.zone}
                      {z.pour ? `, ${z.pour}` : ''}
                    </Text>
                  </View>
                  <ArrowRight size={18} color={colors.ink} />
                </PressCard>
              );
            })}
          </View>

          <Button label="Ask El Cantinero" icon={MessageCircle} variant="dark" onPress={ask} full />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: gutter, gap: 18, marginTop: -30 },
  facts: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, padding: 10, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.card, gap: 2 },
  factValue: { fontFamily: fonts.serifBlack, fontSize: 17, color: colors.ink },
  desc: { fontFamily: fonts.serifRegular, fontSize: 18, lineHeight: 27, color: colors.inkSoft },
  notes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.blush, borderWidth: 1.2, borderColor: colors.ink },
  noteText: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.ink },
  zone: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  zoneImg: { width: 54, height: 54, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.ink },
  zoneName: { fontFamily: fonts.display, fontSize: 16, lineHeight: 18, letterSpacing: 0.8, color: colors.ink, marginTop: 2 },
});
