import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';

import { TabBar } from '@/components/tab-bar';
import { useMe } from '@/lib/queries';
import { usePrefs } from '@/state/prefs';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const { data } = useMe();
  const seenPrompt = usePrefs((s) => s.seenRitualPrompt);
  const needsRitual = !!data && !data.progress.ritual;

  // New guests take the Ritual (onboarding survey) once; it can be skipped and found later in Me.
  useEffect(() => {
    if (!needsRitual || seenPrompt) return;
    // Mark "seen" only when we actually navigate — marking first would change this effect's
    // dependencies and its cleanup would cancel the pending navigation.
    const t = setTimeout(() => {
      usePrefs.getState().markRitualPromptSeen();
      router.push('/ritual');
    }, 450);
    return () => clearTimeout(t);
  }, [needsRitual, seenPrompt]);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper }, animation: 'shift' }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="journey" options={{ title: 'Journey' }} />
      <Tabs.Screen name="oracle" options={{ title: 'Oracle', sceneStyle: { backgroundColor: colors.night } }} />
      <Tabs.Screen name="passport" options={{ title: 'Passport' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
    </Tabs>
  );
}
