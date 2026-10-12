import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { ArrowUp, RotateCcw, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { personas, type ChatPersona } from '@shared/content/oracle';

import { SignInGate } from '@/components/sign-in-gate';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { TopBar } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useChats, type UiMessage } from '@/features/oracle/chat-store';
import { RecipeCard, RecipePending } from '@/features/oracle/recipe-card';
import { parseSegments, RichText } from '@/features/oracle/rich-text';
import { haptic } from '@/lib/haptics';
import { useNightStatusBar } from '@/lib/use-night-status-bar';
import { useIsSignedIn } from '@/state/session';
import { art } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

const AVATAR = { cantinero: art.oracleCantinero, mesa: art.oracleMesa } as const;

function Dot({ delay }: { delay: number }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.set(withDelay(delay, withRepeat(withSequence(withTiming(-5, { duration: 260 }), withTiming(0, { duration: 260 })), -1)));
  }, [delay, reduce, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

function Typing() {
  return (
    <View style={styles.typing} accessibilityLabel="The Oracle is typing">
      <Dot delay={0} />
      <Dot delay={130} />
      <Dot delay={260} />
    </View>
  );
}

function Bubble({ m, persona, streaming }: { m: UiMessage; persona: ChatPersona; streaming: boolean }) {
  if (m.role === 'user') {
    return (
      <Animated.View entering={FadeInUp.springify().damping(18)} style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text variant="body" color={colors.ink}>
            {m.content}
          </Text>
        </View>
      </Animated.View>
    );
  }
  const segments = parseSegments(m.content);
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.botRow}>
      <Image source={AVATAR[persona].source} style={styles.botAvatar} contentFit="cover" />
      <View style={{ flex: 1, gap: 10 }}>
        {m.error ? (
          <View style={[styles.botBubble, { borderColor: colors.danger }]}>
            <Text variant="body" color={colors.blush}>
              {m.error}
            </Text>
          </View>
        ) : !m.content && streaming ? (
          <View style={styles.botBubble}>
            <Typing />
          </View>
        ) : (
          segments.map((s, i) =>
            s.kind === 'text' ? (
              <View key={i} style={styles.botBubble}>
                <RichText text={s.text.trim()} />
              </View>
            ) : s.kind === 'recipe' ? (
              <RecipeCard key={i} recipe={s.recipe} />
            ) : (
              <RecipePending key={i} />
            ),
          )
        )}
      </View>
    </Animated.View>
  );
}

export default function OracleChat() {
  useNightStatusBar();
  const params = useLocalSearchParams<{ persona: string }>();
  const persona: ChatPersona = params.persona === 'mesa' ? 'mesa' : 'cantinero';
  const meta = personas[persona];
  const insets = useSafeAreaInsets();
  const signedIn = useIsSignedIn();
  const thread = useChats((s) => s.threads[persona]);
  const send = useChats((s) => s.send);
  const stop = useChats((s) => s.stop);
  const reset = useChats((s) => s.reset);
  const [draft, setDraft] = useState('');
  const list = useRef<FlatList<UiMessage>>(null);

  const greeting: UiMessage = { id: 'greeting', role: 'assistant', content: meta.greeting };
  const data = [greeting, ...thread.messages];
  const last = thread.messages[thread.messages.length - 1];

  const submit = (text = draft) => {
    if (!text.trim() || thread.streaming) return;
    haptic.press();
    setDraft('');
    void send(persona, text);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <TopBar
        night
        tone="glass"
        title={meta.name}
        right={thread.messages.length ? <IconButton icon={RotateCcw} label="Start a new conversation" tone="glass" onPress={() => reset(persona)} /> : undefined}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        {!signedIn ? (
          <View style={{ flex: 1, justifyContent: 'center', padding: gutter }}>
            <SignInGate night title={meta.name} message={`Create a free passport to talk with ${meta.name}. Your conversations aren't stored.`} />
          </View>
        ) : (
          <>
            <FlatList
              ref={list}
              data={data}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => <Bubble m={item} persona={persona} streaming={thread.streaming && item.id === last?.id} />}
              contentContainerStyle={{ paddingTop: insets.top + 74, paddingHorizontal: gutter, paddingBottom: 16, gap: 14 }}
              onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <View style={styles.header}>
                  <Image source={AVATAR[persona].source} style={styles.heroAvatar} contentFit="cover" />
                  <Text variant="lede" color={colors.blush}>
                    {meta.title}
                  </Text>
                  <Text variant="display" color={colors.paper}>
                    {meta.name.toUpperCase()}
                  </Text>
                </View>
              }
              ListFooterComponent={
                !thread.messages.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 6 }} style={{ marginHorizontal: -gutter, paddingLeft: gutter }}>
                    {meta.suggestions.map((s) => (
                      <Chip key={s} label={s} tone="night" onPress={() => submit(s)} />
                    ))}
                  </ScrollView>
                ) : null
              }
            />
            <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) + 6 }]}>
              <View style={styles.inputWrap}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={persona === 'cantinero' ? 'Ask for a pour or a cocktail' : 'Ask about a dish or a pairing'}
                  placeholderTextColor="rgba(243,233,210,0.4)"
                  style={styles.input}
                  multiline
                  maxLength={1500}
                  selectionColor={colors.sun}
                  accessibilityLabel={`Message ${meta.name}`}
                  onSubmitEditing={() => submit()}
                  submitBehavior="submit"
                  returnKeyType="send"
                  maxFontSizeMultiplier={1.3}
                />
                <PressableScale
                  onPress={() => (thread.streaming ? stop(persona) : submit())}
                  accessibilityLabel={thread.streaming ? 'Stop' : 'Send'}
                  style={[styles.send, { backgroundColor: thread.streaming ? colors.paper : draft.trim() ? colors.sun : 'rgba(243,233,210,0.15)' }]}
                >
                  {thread.streaming ? <Square size={14} color={colors.ink} fill={colors.ink} /> : <ArrowUp size={20} color={colors.ink} strokeWidth={2.6} />}
                </PressableScale>
              </View>
              <Text style={styles.footnote}>
                {thread.remaining !== null ? `${thread.remaining} messages left today. ` : ''}The Oracle encourages responsible drinking.
              </Text>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 2, marginBottom: 10 },
  heroAvatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: colors.blush, marginBottom: 8 },
  userRow: { alignItems: 'flex-end' },
  userBubble: { maxWidth: '84%', backgroundColor: colors.blush, borderRadius: radii.lg, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: colors.ink },
  botRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  botAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.2, borderColor: colors.blush, marginTop: 2 },
  botBubble: { backgroundColor: colors.nightCard, borderRadius: radii.lg, borderTopLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.nightLine },
  typing: { flexDirection: 'row', gap: 6, paddingVertical: 6, paddingHorizontal: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blush },
  composer: { paddingHorizontal: gutter - 6, paddingTop: 8, borderTopWidth: 1, borderColor: colors.nightLine, backgroundColor: colors.night },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: 'rgba(243,233,210,0.07)', borderRadius: 26, borderWidth: 1, borderColor: colors.nightLine, paddingLeft: 16, paddingRight: 5, paddingVertical: 5 },
  input: { flex: 1, color: colors.paper, fontFamily: fonts.sans, fontSize: 16, maxHeight: 120, paddingTop: 10, paddingBottom: 10 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  footnote: { fontFamily: fonts.sans, fontSize: 11, color: 'rgba(243,233,210,0.45)', textAlign: 'center', marginTop: 6 },
});
