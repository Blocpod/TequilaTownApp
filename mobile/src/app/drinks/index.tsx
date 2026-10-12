import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, Heart, Star } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { drinkCategories, drinks, type Drink, type DrinkCategory } from '@shared/content/drinks';

import { PressCard, PrintCard } from '@/components/ui/card';
import { Chip, Tag } from '@/components/ui/chip';
import { PressableScale } from '@/components/ui/pressable-scale';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useBookmarks } from '@/features/drinks/bookmarks';
import { Price } from '@/features/drinks/price';
import { artFor } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

type Filter = 'all' | 'saved' | DrinkCategory;

function DrinkRow({ d, index, saved, onSave }: { d: Drink; index: number; saved: boolean; onSave: () => void }) {
  const cat = drinkCategories.find((c) => c.id === d.category)!;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).springify()}>
      <PressCard onPress={() => router.push({ pathname: '/drinks/[id]', params: { id: d.id } })} accessibilityLabel={`${d.name} by ${d.brand}`} contentStyle={styles.row}>
        <View style={[styles.imgWrap, { backgroundColor: cat.color }]}>
          <Image source={artFor(d.image).source} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="label" color={colors.terracotta}>
            {d.brand}
          </Text>
          <Text variant="subheading" numberOfLines={1}>
            {d.name}
          </Text>
          <View style={styles.meta}>
            <Tag label={cat.label} color={cat.color} />
            <Star size={13} color={colors.marigold} fill={colors.marigold} />
            <Text variant="small" style={{ fontFamily: fonts.sansBold, color: colors.ink }}>
              {d.rating.toFixed(1)}
            </Text>
            <Price level={d.price} />
          </View>
          <Text variant="small" numberOfLines={1}>
            {d.tastingNotes.join(' · ')}
          </Text>
        </View>
        <View style={{ width: 32 }} />
      </PressCard>
      {/* sibling, not child: a button can't live inside the card's button */}
      <PressableScale onPress={onSave} hitSlop={10} accessibilityLabel={saved ? `Remove ${d.name} from saved` : `Save ${d.name}`} style={styles.save}>
        <Heart size={20} color={saved ? colors.terracotta : colors.inkMuted} fill={saved ? colors.terracotta : 'transparent'} strokeWidth={2.2} />
      </PressableScale>
    </Animated.View>
  );
}

export default function DrinksGuide() {
  const params = useLocalSearchParams<{ saved?: string }>();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>(params.saved ? 'saved' : 'all');
  const bookmarks = useBookmarks();
  const cat = drinkCategories.find((c) => c.id === filter);
  const list = drinks.filter((d) => (filter === 'all' ? true : filter === 'saved' ? bookmarks.has(d.id) : d.category === filter));

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar title="Tequila guide" />
      <FlatList
        data={list}
        keyExtractor={(d) => d.id}
        renderItem={({ item, index }) => <DrinkRow d={item} index={index} saved={bookmarks.has(item.id)} onSave={() => bookmarks.toggle(item.id)} />}
        contentContainerStyle={{ paddingTop: insets.top + 70, paddingBottom: insets.bottom + 40, gap: 12, paddingHorizontal: gutter }}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 4 }}>
            <View style={styles.hero}>
              <Image source={artFor('heroDrinks').source} style={styles.heroImg} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text variant="lede" color={colors.terracotta}>
                  Blanco to extra añejo
                </Text>
                <Text variant="display">THE TEQUILA GUIDE</Text>
                <Text variant="small">Every pour at Tequila Town, and where to find it.</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -gutter }}>
              <View style={{ width: gutter - 8 }} />
              <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip label={`Saved · ${bookmarks.ids.length}`} icon={Bookmark} selected={filter === 'saved'} onPress={() => setFilter('saved')} />
              {drinkCategories.map((c) => (
                <Chip key={c.id} label={c.label} selected={filter === c.id} onPress={() => setFilter(c.id)} />
              ))}
              <View style={{ width: gutter - 8 }} />
            </ScrollView>
            {cat ? (
              <Animated.View key={cat.id} entering={FadeIn.duration(220)}>
                <PrintCard offset={3} background={colors.cardWarm} contentStyle={styles.explainer}>
                  <View style={[styles.swatch, { backgroundColor: cat.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catName}>{cat.label.toUpperCase()}</Text>
                    <Text variant="small" color={colors.inkSoft}>
                      {cat.blurb}
                    </Text>
                  </View>
                </PrintCard>
              </Animated.View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            art="iconAgaveFlower"
            title={filter === 'saved' ? 'Nothing saved yet' : 'Nothing poured here'}
            message={filter === 'saved' ? 'Tap the heart on any tequila to keep it in your passport.' : 'Try another style.'}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroImg: { width: 96, height: 96, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  imgWrap: { width: 84, height: 100, borderRadius: radii.md, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.ink },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  save: { position: 'absolute', top: 10, right: 14, padding: 6 },
  explainer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  swatch: { width: 14, alignSelf: 'stretch', borderRadius: 4, borderWidth: 1, borderColor: colors.ink },
  catName: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, letterSpacing: 0.8, color: colors.ink, marginTop: 2 },
});
