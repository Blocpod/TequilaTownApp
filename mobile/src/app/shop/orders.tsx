import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Platform, RefreshControl, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Order, OrdersResponse } from '@shared/api';

import { SignInGate } from '@/components/sign-in-gate';
import { Button } from '@/components/ui/button';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { PickupCard } from '@/features/shop/pickup-card';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useIsSignedIn } from '@/state/session';
import { colors, gutter } from '@/theme/tokens';

export default function Orders() {
  const insets = useSafeAreaInsets();
  const signedIn = useIsSignedIn();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: qk.orders, queryFn: api.orders, enabled: signedIn });
  const [cancelling, setCancelling] = useState<string | null>(null);

  const cancel = (o: Order) => {
    const go = async () => {
      setCancelling(o.id);
      try {
        const updated = await api.cancelOrder(o.id);
        qc.setQueryData<OrdersResponse>(qk.orders, (old) => (old ? { orders: old.orders.map((x) => (x.id === o.id ? updated : x)) } : old));
        toast.info('Reservation cancelled');
      } catch (e) {
        toast.error('Could not cancel', errorMessage(e));
      } finally {
        setCancelling(null);
      }
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert('Cancel this reservation?', `Pickup code ${o.pickupCode} will no longer be valid.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel reservation', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar title="Reservations" />
      {!signedIn ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: gutter }}>
          <SignInGate message="Sign in to see your Mercado reservations." />
        </View>
      ) : isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : (
        <FlatList
          data={data?.orders ?? []}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.terracotta} />}
          contentContainerStyle={{ paddingTop: insets.top + 76, paddingHorizontal: gutter, paddingBottom: insets.bottom + 40, gap: 16, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState art="tileShop" title="No reservations yet" message="Reserve merch in the app and skip the line at the Mercado." action={{ label: 'Browse the Mercado', onPress: () => router.replace('/shop') }} />}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 60).springify()} style={{ gap: 8 }}>
              <PickupCard order={item} />
              {item.status === 'reserved' ? <Button label="Cancel reservation" variant="ghost" size="sm" loading={cancelling === item.id} onPress={() => cancel(item)} style={{ alignSelf: 'center' }} /> : null}
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}
