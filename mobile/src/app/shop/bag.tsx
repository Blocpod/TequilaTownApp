import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Package, ShoppingBag, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Order } from '@shared/api';
import { productById } from '@shared/content/shop';

import { Confetti } from '@/components/art/confetti';
import { SignInGate } from '@/components/sign-in-gate';
import { Button } from '@/components/ui/button';
import { PrintCard } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/states';
import { Stepper } from '@/components/ui/stepper';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { PickupCard } from '@/features/shop/pickup-card';
import { api, errorMessage, isApiError } from '@/lib/api';
import { qk } from '@/lib/queries';
import { usePrefs } from '@/state/prefs';
import { useIsSignedIn } from '@/state/session';
import { artFor } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

export default function Bag() {
  const insets = useSafeAreaInsets();
  const signedIn = useIsSignedIn();
  const qc = useQueryClient();
  const bag = usePrefs((s) => s.bag);
  const setQty = usePrefs((s) => s.setBagQty);
  const clearBag = usePrefs((s) => s.clearBag);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);
  const [fire, setFire] = useState(0);

  const lines = bag.map((b) => ({ ...b, product: productById(b.productId) })).filter((l) => !!l.product);
  const total = lines.reduce((n, l) => n + l.product!.price * l.qty, 0);

  const reserve = async () => {
    setBusy(true);
    try {
      const order = await api.createOrder({ items: lines.map((l) => ({ productId: l.productId, qty: l.qty, size: l.size })) });
      clearBag();
      setPlaced(order);
      setFire((f) => f + 1);
      void qc.invalidateQueries({ queryKey: qk.orders });
    } catch (e) {
      toast.error('Could not reserve', isApiError(e) && e.code === 'LIMIT_REACHED' ? 'You have the maximum number of open reservations. Pick some up first!' : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar leading="close" title={placed ? 'Reserved' : 'Your bag'} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 76, paddingHorizontal: gutter, paddingBottom: insets.bottom + 40, gap: 16, flexGrow: 1 }}>
        {placed ? (
          <Animated.View entering={ZoomIn.springify().damping(16)} style={{ gap: 16 }}>
            <Text variant="lede" color={colors.terracotta} align="center">
              ¡Apartado!
            </Text>
            <Text variant="display" align="center">
              SEE YOU AT THE MERCADO
            </Text>
            <Text variant="body" align="center">
              Show this code at the Mercado counter (Zone 11) to pay and pick up.
            </Text>
            <PickupCard order={placed} />
            <Button label="My reservations" icon={Package} variant="secondary" onPress={() => router.replace('/shop/orders')} full />
          </Animated.View>
        ) : !lines.length ? (
          <EmptyState art="tileShop" title="Your bag is empty" message="Reserve merch and goods, then pick them up at the Mercado." action={{ label: 'Browse the Mercado', onPress: () => router.replace('/shop') }} />
        ) : (
          <>
            {lines.map((l, i) => (
              <Animated.View key={`${l.productId}-${l.size ?? ''}`} entering={FadeInDown.delay(i * 40).springify()} layout={LinearTransition.springify()}>
                <PrintCard offset={3} contentStyle={styles.line}>
                  <Image source={artFor(l.product!.image).source} style={styles.img} contentFit="cover" />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {l.product!.name}
                    </Text>
                    <Text variant="small">
                      {l.size ? `Size ${l.size}, ` : ''}${l.product!.price} each
                    </Text>
                    <Stepper compact value={l.qty} max={l.product!.limit} onChange={(v) => setQty(l.productId, l.size, v)} label={`${l.product!.name} quantity`} />
                  </View>
                  <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                    <IconButton icon={Trash2} label={`Remove ${l.product!.name}`} size={34} onPress={() => setQty(l.productId, l.size, 0)} />
                    <Text style={styles.lineTotal}>${(l.product!.price * l.qty).toLocaleString()}</Text>
                  </View>
                </PrintCard>
              </Animated.View>
            ))}
            <View style={styles.totalRow}>
              <Text variant="subheading">Due at pickup</Text>
              <Text style={styles.total}>${total.toLocaleString()}</Text>
            </View>
            {signedIn ? (
              <>
                <Button label="Reserve for pickup" icon={ShoppingBag} onPress={reserve} loading={busy} full />
                <Text variant="small" align="center">
                  Nothing is charged in the app. Pay at the Mercado when you collect.
                </Text>
              </>
            ) : (
              <SignInGate message="Sign in to reserve these for pickup. It takes ten seconds." />
            )}
          </>
        )}
      </ScrollView>
      <Confetti fire={fire} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', gap: 12, padding: 10 },
  img: { width: 76, height: 76, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.ink },
  lineTotal: { fontFamily: fonts.serifBlack, fontSize: 17, color: colors.ink },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1.5, borderColor: colors.ink, marginTop: 4 },
  total: { fontFamily: fonts.serifBlack, fontSize: 28, color: colors.terracotta },
});
