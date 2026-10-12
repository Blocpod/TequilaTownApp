import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sponsors } from '@shared/content/sponsors';

import { PressCard } from '@/components/ui/card';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { StoryBubbles } from '@/features/sponsors/story-bubbles';
import { colors, fonts, gutter } from '@/theme/tokens';

export default function Sponsors() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar title="The Houses" />
      <FlatList
        data={sponsors}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingTop: insets.top + 70, paddingBottom: insets.bottom + 40, gap: 12 }}
        ListHeaderComponent={
          <View style={{ gap: 18, marginBottom: 8 }}>
            <View style={{ paddingHorizontal: gutter }}>
              <Text variant="lede" color={colors.terracotta}>
                The families behind the pour
              </Text>
              <Text variant="display">THE HOUSES</Text>
            </View>
            <StoryBubbles />
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).springify()} style={{ paddingHorizontal: gutter }}>
            <PressCard onPress={() => router.push({ pathname: '/sponsors/[id]', params: { id: item.id } })} accessibilityLabel={item.name} contentStyle={styles.row}>
              <View style={[styles.mono, { backgroundColor: item.color }]}>
                <Text style={styles.monoText}>{item.monogram}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="subheading">{item.name}</Text>
                <Text variant="small" numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
              <ArrowRight size={18} color={colors.ink} />
            </PressCard>
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  mono: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  monoText: { fontFamily: fonts.serifBlack, fontSize: 19, color: colors.card },
});
