import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { PaperBackground } from '@/components/ui/screen';

export default function NotFound() {
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <PaperBackground />
      <EmptyState art="iconCactusFlower" title="Lost in the agave" message="That page wandered off the trail." />
      <Button label="Back to town" onPress={() => router.replace('/')} style={{ alignSelf: 'center' }} />
    </View>
  );
}
