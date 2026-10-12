import { router, useLocalSearchParams } from 'expo-router';
import { Bell, MessageSquareHeart, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { productById, shopSections } from '@shared/content/shop';

import { Button } from '@/components/ui/button';
import { Chip, Tag } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { ParallaxHero } from '@/components/ui/parallax-hero';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/states';
import { Stepper } from '@/components/ui/stepper';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { usePrefs } from '@/state/prefs';
import { useIsSignedIn } from '@/state/session';
import { colors, fonts, gutter } from '@/theme/tokens';

export default function Product() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = productById(id);
  const insets = useSafeAreaInsets();
  const signedIn = useIsSignedIn();
  const addToBag = usePrefs((s) => s.addToBag);
  const bagCount = usePrefs((s) => s.bag.reduce((n, b) => n + b.qty, 0));
  const [size, setSize] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  if (!product) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <PaperBackground />
        <TopBar />
        <EmptyState title="Sold out of existence" message="That item isn't in the Mercado." />
      </View>
    );
  }
  const section = shopSections.find((s) => s.id === product.section);

  const add = () => {
    if (product.sizes && !size) return toast.error('Pick a size first');
    addToBag({ productId: product.id, qty, size }, product.limit);
    toast.success('Added to your bag', `${qty} × ${product.name}${size ? ` (${size})` : ''}`);
  };

  const request = async () => {
    if (!signedIn) return router.push('/auth/sign-up');
    setBusy(true);
    try {
      const r = await api.shopRequest({ productId: product.id });
      setRequested(true);
      toast.success(r.kind === 'waitlist' ? "You're on the list" : 'Request sent', r.kind === 'waitlist' ? "We'll tell you the moment it's released." : 'The artisans will reach out about this piece.');
    } catch (e) {
      toast.error('Could not send', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar
        title={product.name}
        tone="glass"
        scrollY={scrollY}
        threshold={300}
        right={<IconButton icon={ShoppingBag} tone="glass" label={`Bag, ${bagCount} items`} badge={bagCount} onPress={() => router.push('/shop/bag')} />}
      />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <ParallaxHero image={product.image} height={380} scrollY={scrollY} />
        <View style={styles.body}>
          <Animated.View entering={FadeInDown.springify()} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Tag label={section?.name ?? product.section} color={colors.card} />
              {product.badge ? <Tag label={product.badge} /> : null}
            </View>
            <Text variant="display" accessibilityRole="header">
              {product.name.toUpperCase()}
            </Text>
            <Text style={styles.price}>${product.price.toLocaleString()}</Text>
          </Animated.View>
          <Text style={styles.desc}>{product.description}</Text>
          {product.story ? (
            <Text variant="lede" style={{ fontSize: 16, lineHeight: 25 }}>
              {product.story}
            </Text>
          ) : null}

          {product.action === 'reserve' ? (
            <>
              {product.sizes ? (
                <View style={{ gap: 8 }}>
                  <Text variant="label">Size</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {product.sizes.map((s) => (
                      <Chip key={s} label={s} selected={size === s} onPress={() => setSize(s)} style={{ minWidth: 54, justifyContent: 'center' }} />
                    ))}
                  </View>
                </View>
              ) : null}
              <View style={{ gap: 8 }}>
                <Text variant="label">Quantity · limit {product.limit}</Text>
                <Stepper value={qty} max={product.limit} onChange={setQty} label="Quantity" />
              </View>
              <Button label={`Add to bag · $${(product.price * qty).toLocaleString()}`} icon={ShoppingBag} onPress={add} full />
              <Text variant="small" align="center">
                Pay when you pick up at the Mercado. Nothing is charged in the app.
              </Text>
            </>
          ) : (
            <>
              <Button
                label={requested ? (product.action === 'waitlist' ? "You're on the list" : 'Request sent') : product.action === 'waitlist' ? 'Notify me' : 'Request this piece'}
                icon={product.action === 'waitlist' ? Bell : MessageSquareHeart}
                onPress={request}
                loading={busy}
                disabled={requested}
                full
              />
              <Text variant="small" align="center">
                {product.action === 'waitlist' ? 'Be first in line when this bottle is released.' : 'One-of-one pieces are arranged directly with the artisans at the Mercado.'}
              </Text>
            </>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: gutter, gap: 18, marginTop: -30 },
  price: { fontFamily: fonts.serifBlack, fontSize: 28, color: colors.terracotta },
  desc: { fontFamily: fonts.serifRegular, fontSize: 18, lineHeight: 27, color: colors.inkSoft },
});
