import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ui/toast';
import { queryClient } from '@/lib/queries';
import { isExpoGo } from '@/lib/runtime';
import { usePrefs } from '@/state/prefs';
import { useIsSignedIn, useSession } from '@/state/session';
import { fontAssets } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

// Redirects after the guards change (e.g. sign in, 'just browsing') land on the tabs, not the first open group.
export const unstable_settings = { anchor: '(tabs)' };

SplashScreen.preventAutoHideAsync().catch(() => undefined);
// The splash cross-fade needs a real build; Expo Go doesn't support customizing it.
if (!isExpoGo) SplashScreen.setOptions({ duration: 450, fade: true });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const sessionReady = useSession((s) => s.hydrated);
  const prefsReady = usePrefs((s) => s.hydrated);
  const ready = (fontsLoaded || !!fontError) && sessionReady && prefsReady;

  useEffect(() => {
    void useSession.getState().hydrate();
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.paper }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <RootStack />
          <ToastHost />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const ageOk = usePrefs((s) => !!s.agePassedAt);
  const signedIn = useIsSignedIn();
  const guest = usePrefs((s) => s.guest);
  const entered = signedIn || guest;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: 'default' }}>
      <Stack.Protected guard={!ageOk}>
        <Stack.Screen name="age" options={{ animation: 'fade' }} />
      </Stack.Protected>

      <Stack.Protected guard={ageOk && !entered}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      </Stack.Protected>

      <Stack.Protected guard={ageOk && entered}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="zone/[id]" />
        <Stack.Screen name="mission/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan/index" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="scan/[code]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="ticket" />
        <Stack.Screen name="venue-map" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="drinks/index" />
        <Stack.Screen name="drinks/[id]" />
        <Stack.Screen name="program/[kind]" />
        <Stack.Screen name="sponsors/index" />
        <Stack.Screen name="sponsors/[id]" />
        <Stack.Screen name="stories/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="shop/index" />
        <Stack.Screen name="shop/[id]" />
        <Stack.Screen name="shop/bag" options={{ presentation: 'modal' }} />
        <Stack.Screen name="shop/orders" />
        <Stack.Screen name="oracle/chat/[persona]" options={{ contentStyle: { backgroundColor: colors.night } }} />
        <Stack.Screen name="oracle/memoria" options={{ contentStyle: { backgroundColor: colors.night } }} />
        <Stack.Screen name="oracle/gallery" options={{ contentStyle: { backgroundColor: colors.night } }} />
        <Stack.Screen name="oracle/ojo" options={{ contentStyle: { backgroundColor: colors.night } }} />
        <Stack.Screen name="persona" options={{ presentation: 'modal' }} />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
      </Stack.Protected>

      <Stack.Protected guard={ageOk && !signedIn}>
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="ritual" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}
