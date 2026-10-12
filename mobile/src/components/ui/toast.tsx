import { CheckCircle2, CircleAlert, Info, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { haptic } from '@/lib/haptics';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Tone = 'success' | 'error' | 'info' | 'reward';
type ToastItem = { id: number; title: string; message?: string; tone: Tone };

type ToastState = {
  items: ToastItem[];
  show: (t: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: number) => void;
};

let seq = 0;
export const useToasts = create<ToastState>((set) => ({
  items: [],
  show: (t) => {
    const id = ++seq;
    set((s) => ({ items: [...s.items.slice(-2), { ...t, id }] }));
    if (t.tone === 'error') haptic.error();
    else if (t.tone === 'success' || t.tone === 'reward') haptic.success();
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

/** Imperative helper: `toast.success('Saved')` */
export const toast = {
  success: (title: string, message?: string) => useToasts.getState().show({ title, message, tone: 'success' }),
  error: (title: string, message?: string) => useToasts.getState().show({ title, message, tone: 'error' }),
  info: (title: string, message?: string) => useToasts.getState().show({ title, message, tone: 'info' }),
  reward: (title: string, message?: string) => useToasts.getState().show({ title, message, tone: 'reward' }),
};

const look: Record<Tone, { bg: string; fg: string; icon: LucideIcon; iconColor: string }> = {
  success: { bg: colors.card, fg: colors.ink, icon: CheckCircle2, iconColor: colors.agave },
  error: { bg: colors.card, fg: colors.ink, icon: CircleAlert, iconColor: colors.danger },
  info: { bg: colors.card, fg: colors.ink, icon: Info, iconColor: colors.skyDeep },
  reward: { bg: colors.ink, fg: colors.paper, icon: Sparkles, iconColor: colors.sun },
};

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), item.tone === 'error' ? 4500 : 3200);
    return () => clearTimeout(t);
  }, [item.id, item.tone, dismiss]);
  const l = look[item.tone];
  const Icon = l.icon;
  return (
    <Animated.View entering={FadeInUp.springify().damping(16)} exiting={FadeOutUp.duration(180)} layout={LinearTransition.springify()}>
      <PressableScale onPress={() => dismiss(item.id)} accessibilityRole="alert" accessibilityLabel={`${item.title}. ${item.message ?? ''}`} hapticOnPress="none">
        <View style={[styles.card, { backgroundColor: l.bg }]}>
          <Icon size={22} color={l.iconColor} strokeWidth={2.4} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: l.fg }]}>{item.title}</Text>
            {item.message ? (
              <Text variant="small" style={{ color: item.tone === 'reward' ? colors.blush : colors.inkSoft }}>
                {item.message}
              </Text>
            ) : null}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/** Mounted once at the root. */
export function ToastHost() {
  const items = useToasts((s) => s.items);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      {items.map((i) => (
        <ToastCard key={i.id} item={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: gutter, right: gutter, gap: 8, zIndex: 1000 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  title: { fontFamily: fonts.sansBold, fontSize: 15, lineHeight: 20 },
});
