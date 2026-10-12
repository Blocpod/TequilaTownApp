import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Package, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { shopProducts, shopSections, type ShopSection } from '@shared/content/shop';

import { PressCard, PrintCard } from '@/components/ui/card';
import { Chip, Tag } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { usePrefs } from '@/state/prefs';
import { useIsSignedIn } from '@/state/session';
import { art, artFor } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

export default function Shop() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const signedIn = useIsSignedIn();
  const bagCount = usePrefs((s) => s.bag.reduce((n, b) => n + b.qty, 0));
  const [section, setSection] = useState<ShopSection>('merch');
  const products = shopProducts.filter((p) => p.section === section);
  const meta = shopSections.find((s) => s.id === section)!;
  const cell = (width - gutter * 2 - 14) / 2;

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar
        tone="glass"
        title="El Mercado"
        right={
          <>
            {signedIn ? <IconButton icon={Package} tone="glass" label="My reservations" onPress={() => router.push('/shop/orders')} /> : null}
            <IconButton icon={ShoppingBag} tone="glass" label={`Bag, ${bagCount} items`} badge={bagCount} onPress={() => router.push('/shop/bag')} />
          </>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 330 }}>
          <Image source={art.shopHero.source} placeholder={{ blurhash: art.shopHero.blurhash! }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" />
          <LinearGradient colors={['rgba(18,14,12,0.5)', 'rgba(18,14,12,0.1)', colors.paper]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroText}>
            <Text variant="lede" color={colors.terracotta}>
              Shop, sip & savor
            </Text>
            <Text variant="hero">EL MERCADO</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: gutter, gap: 16 }}>
          <PrintCard background={colors.sun} offset={3} contentStyle={styles.strip}>
            <ShoppingBag size={20} color={colors.ink} />
            <Text variant="small" color={colors.ink} style={{ flex: 1, fontFamily: fonts.sansSemiBold }}>
              Reserve in the app, then pay & pick up at the Mercado (Zone 11). No lines, no sell-outs.
            </Text>
          </PrintCard>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {shopSections.map((s) => (
              <Chip key={s.id} label={s.name} selected={section === s.id} onPress={() => setSection(s.id)} />
            ))}
          </ScrollView>
          <Text variant="lede">{meta.description}</Text>

          <View style={styles.grid}>
            {products.map((p, i) => (
              <Animated.View key={p.id} entering={FadeInDown.delay(i * 50).springify()}>
                <PressCard onPress={() => router.push({ pathname: '/shop/[id]', params: { id: p.id } })} accessibilityLabel={`${p.name}, $${p.price}`} style={{ width: cell }} radius={radii.md}>
                  <View style={{ height: cell }}>
                    <Image source={artFor(p.image).source} style={StyleSheet.absoluteFill} contentFit="cover" />
                    {p.badge ? <Tag label={p.badge} color={p.badge === 'Coming soon' ? colors.cristal : colors.blush} style={{ position: 'absolute', top: 8, left: 8 }} /> : null}
                  </View>
                  <View style={styles.cellBody}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.price}>${p.price.toLocaleString()}</Text>
                  </View>
                </PressCard>
              </Animated.View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroText: { position: 'absolute', left: gutter, right: gutter, bottom: 18 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  cellBody: { padding: 10, gap: 2, borderTopWidth: 1.5, borderColor: colors.ink },
  price: { fontFamily: fonts.serifBlack, fontSize: 17, color: colors.terracotta },
});
