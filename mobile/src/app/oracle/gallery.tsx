import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Download, Share2, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, Modal, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Memory } from '@shared/api';
import { memoryStyles } from '@shared/content/oracle';

import { SignInGate } from '@/components/sign-in-gate';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { TopBar } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { saveImageToLibrary, shareImage } from '@/lib/image';
import { qk } from '@/lib/queries';
import { useNightStatusBar } from '@/lib/use-night-status-bar';
import { useIsSignedIn } from '@/state/session';
import { colors, gutter, radii } from '@/theme/tokens';

export default function Gallery() {
  useNightStatusBar();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const signedIn = useIsSignedIn();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: qk.memories, queryFn: api.memories, enabled: signedIn });
  const [open, setOpen] = useState<Memory | null>(null);
  const cell = (width - gutter * 2 - 12) / 2;

  const remove = (m: Memory) => {
    const go = async () => {
      try {
        await api.deleteMemory(m.id);
        qc.setQueryData(qk.memories, (old: { memories: Memory[] } | undefined) => (old ? { memories: old.memories.filter((x) => x.id !== m.id) } : old));
        setOpen(null);
        toast.success('Memory deleted');
      } catch (e) {
        toast.error('Could not delete', errorMessage(e));
      }
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert('Delete this memory?', 'The portrait and its share link will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <TopBar night tone="glass" title="My memories" />
      {!signedIn ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: gutter }}>
          <SignInGate night message="Sign in to see your Memoria Viva portraits." />
        </View>
      ) : isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState night message={errorMessage(error)} onRetry={refetch} />
      ) : (
        <FlatList
          data={data?.memories ?? []}
          keyExtractor={(m) => m.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ paddingTop: insets.top + 76, paddingHorizontal: gutter, paddingBottom: insets.bottom + 30, gap: 12, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              night
              art="iconCactusFlower"
              title="No memories yet"
              message="Develop your first portrait in La Memoria Viva."
              action={{ label: 'Open the studio', onPress: () => router.replace('/oracle/memoria') }}
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 50).springify()}>
              <PressableScale onPress={() => setOpen(item)} accessibilityLabel={`Memory from ${new Date(item.createdAt).toLocaleDateString()}`} style={[styles.cell, { width: cell }]}>
                <Image source={{ uri: item.imageUrl }} style={{ width: '100%', aspectRatio: 4 / 5 }} contentFit="cover" transition={300} />
                <Text variant="label" color={colors.blush} style={{ padding: 8 }}>
                  {memoryStyles.find((s) => s.id === item.style)?.name ?? item.style}
                </Text>
              </PressableScale>
            </Animated.View>
          )}
        />
      )}

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)} statusBarTranslucent>
        {open ? (
          <Animated.View entering={FadeIn} style={[styles.viewer, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <IconButton icon={X} label="Close" tone="glass" onPress={() => setOpen(null)} />
              <IconButton icon={Trash2} label="Delete memory" tone="glass" onPress={() => remove(open)} />
            </View>
            <Animated.View entering={ZoomIn.springify().damping(18)} style={{ flex: 1, justifyContent: 'center' }}>
              <Image source={{ uri: open.imageUrl }} style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: radii.md }} contentFit="contain" />
            </Animated.View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                label="Save"
                icon={Download}
                variant="blush"
                size="md"
                full
                style={{ flex: 1 }}
                onPress={() =>
                  saveImageToLibrary(open.imageUrl, `memoria-viva-${open.id}.jpg`)
                    .then((r) => (r === 'saved' ? toast.success('Saved to Photos') : toast.error('Photos access needed')))
                    .catch((e) => toast.error('Could not save', errorMessage(e)))
                }
              />
              <Button
                label="Share"
                icon={Share2}
                variant="secondary"
                size="md"
                full
                style={{ flex: 1 }}
                onPress={() => shareImage(open.imageUrl, 'My Memoria Viva from Tequila Town 🌵', open.shareUrl).catch(() => toast.error('Could not share'))}
              />
            </View>
          </Animated.View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { borderRadius: radii.md, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.nightLine, backgroundColor: colors.nightCard },
  viewer: { flex: 1, backgroundColor: 'rgba(12,9,8,0.97)', paddingHorizontal: gutter, gap: 16 },
});
