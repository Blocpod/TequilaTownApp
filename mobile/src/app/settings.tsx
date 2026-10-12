import { router } from 'expo-router';
import { Eye, Trash2, Vibrate } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrintCard } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { queryClient, useMe, useSetMe } from '@/lib/queries';
import { usePrefs } from '@/state/prefs';
import { useSession } from '@/state/session';
import { colors, gutter } from '@/theme/tokens';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const haptics = usePrefs((s) => s.haptics);
  const setHaptics = usePrefs((s) => s.setHaptics);
  const { data } = useMe();
  const setMe = useSetMe();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const user = data?.user;

  const toggleLeaderboard = async (on: boolean) => {
    setSaving(true);
    try {
      setMe(await api.updateMe({ showOnLeaderboard: on }));
    } catch (e) {
      toast.error('Could not update', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = () => {
    const go = async () => {
      setDeleting(true);
      try {
        await api.deleteAccount();
        useSession.getState().clear();
        usePrefs.getState().resetAll();
        queryClient.clear();
        toast.info('Account deleted', 'Your passport and data have been permanently removed.');
        router.replace('/');
      } catch (e) {
        toast.error('Could not delete account', errorMessage(e));
      } finally {
        setDeleting(false);
      }
    };
    const message = 'This permanently deletes your passport, stamps, points, ticket link, memories and reservations. It cannot be undone.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(message)) void go();
      return;
    }
    Alert.alert('Delete your account?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar title="Settings" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 76, paddingHorizontal: gutter, paddingBottom: insets.bottom + 40, gap: 18 }}>
        <Text variant="label">Experience</Text>
        <PrintCard offset={0} contentStyle={{ padding: 0 }}>
          <ListRow
            first
            icon={Vibrate}
            label="Haptics"
            detail="Taps, stamps and celebrations you can feel"
            right={<Switch value={haptics} onValueChange={setHaptics} trackColor={{ true: colors.terracotta, false: colors.paperDeep }} thumbColor={colors.card} accessibilityLabel="Haptics" />}
          />
          {user ? (
            <ListRow
              icon={Eye}
              label="Show me on the leaderboard"
              detail="Listed as first name and last initial"
              right={
                <Switch
                  value={user.showOnLeaderboard}
                  disabled={saving}
                  onValueChange={toggleLeaderboard}
                  trackColor={{ true: colors.terracotta, false: colors.paperDeep }}
                  thumbColor={colors.card}
                  accessibilityLabel="Show me on the leaderboard"
                />
              }
            />
          ) : null}
        </PrintCard>

        {user ? (
          <>
            <Text variant="label" style={{ marginTop: 8 }}>
              Danger zone
            </Text>
            <PrintCard offset={0} borderColor={colors.danger} contentStyle={{ padding: 0 }}>
              <ListRow first icon={Trash2} label={deleting ? 'Deleting…' : 'Delete account'} detail="Permanently remove your passport and all data" danger onPress={deleting ? undefined : deleteAccount} />
            </PrintCard>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
