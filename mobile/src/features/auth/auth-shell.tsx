import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PapelPicado } from '@/components/art/papel-picado';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { art } from '@/theme/art';
import { colors, gutter } from '@/theme/tokens';

type Props = { kicker: string; title: string; subtitle?: string; leading?: 'back' | 'close'; children: ReactNode };

/** Shared chrome for sign-in / sign-up / reset. */
export function AuthShell({ kicker, title, subtitle, leading = 'close', children }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar leading={leading} tone="paper" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32, paddingHorizontal: gutter, gap: 22 }}
        >
          <PapelPicado width={width - gutter * 2} offset={2} style={{ marginBottom: -6 }} />
          <Animated.View entering={FadeInDown.springify()} style={styles.header}>
            <Image source={art.logo.source} style={{ width: 64, height: 64 }} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text variant="lede" color={colors.terracotta}>
                {kicker}
              </Text>
              <Text variant="display" accessibilityRole="header">
                {title.toUpperCase()}
              </Text>
            </View>
          </Animated.View>
          {subtitle ? <Text variant="body">{subtitle}</Text> : null}
          <Animated.View entering={FadeInDown.delay(120).springify()} style={{ gap: 16 }}>
            {children}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
