import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ArrowRight, Camera, ImagePlus, MessageCircle, RefreshCw, Sparkles } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Identification } from '@shared/api';
import { drinkById, drinkCategories } from '@shared/content/drinks';
import { aiLimits } from '@shared/content/oracle';

import { OracleEye } from '@/components/art/oracle-eye';
import { SignInGate } from '@/components/sign-in-gate';
import { Button } from '@/components/ui/button';
import { PressCard, PrintCard } from '@/components/ui/card';
import { Tag } from '@/components/ui/chip';
import { PressableScale } from '@/components/ui/pressable-scale';
import { TopBar } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useChats } from '@/features/oracle/chat-store';
import { api, errorMessage, isApiError } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { prepareJpeg } from '@/lib/image';
import { qk, queryClient, useProgress } from '@/lib/queries';
import { useNightStatusBar } from '@/lib/use-night-status-bar';
import { useIsSignedIn } from '@/state/session';
import { artFor } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

const confidenceCopy = { high: 'The Oracle is certain', medium: 'The Oracle is fairly sure', low: 'The Oracle is guessing' } as const;

export default function Ojo() {
  useNightStatusBar();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const signedIn = useIsSignedIn();
  const progress = useProgress();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Identification | null>(null);
  const send = useChats((s) => s.send);

  const identify = async (uri: string) => {
    setPhoto(uri);
    setBusy(true);
    setResult(null);
    try {
      const { base64 } = await prepareJpeg(uri, 1024, 0.8);
      const r = await api.identify(base64);
      setResult(r);
      haptic.success();
      void queryClient.invalidateQueries({ queryKey: qk.me });
    } catch (e) {
      setPhoto(null);
      if (isApiError(e) && e.code === 'LIMIT_REACHED') toast.error('The Eye needs rest', `You can scan ${aiLimits.identifications} bottles a day.`);
      else toast.error('Could not read that bottle', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const shoot = async () => {
    haptic.thunk();
    const pic = await camera.current?.takePictureAsync({ quality: 0.85, shutterSound: false }).catch(() => null);
    if (pic?.uri) void identify(pic.uri);
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled && res.assets[0]?.uri) void identify(res.assets[0].uri);
  };

  const askCantinero = () => {
    if (!result) return;
    void send('cantinero', `I'm holding ${result.brand} ${result.name}. How should I drink it, and what cocktail would you build with it?`);
    router.push('/oracle/chat/cantinero');
  };

  const festivalDrink = result?.festivalDrinkId ? drinkById(result.festivalDrinkId) : undefined;
  const category = drinkCategories.find((c) => c.id === result?.category);
  const frameW = width - gutter * 2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <TopBar night tone="glass" title="El Ojo" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 74, paddingHorizontal: gutter, paddingBottom: insets.bottom + 40, gap: 18 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 4 }}>
          <Text variant="lede" color={colors.blush}>
            The Eye
          </Text>
          <Text variant="display" color={colors.paper}>
            {result ? (result.isTequila ? 'I SEE IT' : 'HMM') : 'SHOW ME A BOTTLE'}
          </Text>
          {!result ? (
            <Text variant="body" color="rgba(243,233,210,0.75)">
              Frame the label. The Oracle reads the style, notes and the best way to serve it.
            </Text>
          ) : null}
        </View>

        {!signedIn ? (
          <SignInGate night message="Create a free passport to use El Ojo, the bottle scanner." />
        ) : busy && photo ? (
          <View style={{ alignItems: 'center', gap: 16, paddingVertical: 10 }}>
            <View style={styles.scanning}>
              <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(18,14,12,0.55)', alignItems: 'center', justifyContent: 'center' }]}>
                <OracleEye size={140} />
              </View>
            </View>
            <Text variant="lede" color={colors.blush}>
              Reading the label
            </Text>
          </View>
        ) : result ? (
          <Animated.View entering={ZoomIn.springify().damping(17)} style={{ gap: 14 }}>
            <PrintCard background={colors.cardWarm} shadowColor={colors.terracotta} contentStyle={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                {photo ? <Image source={{ uri: photo }} style={styles.resultImg} contentFit="cover" /> : null}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="label" color={colors.terracotta}>
                    {result.brand}
                  </Text>
                  <Text style={styles.name}>{result.name.toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <Tag label={category?.label ?? result.category} color={category?.color ?? colors.blush} />
                    <Tag label={confidenceCopy[result.confidence]} color={colors.card} />
                  </View>
                </View>
              </View>
              <Text variant="body" color={colors.inkSoft}>
                {result.description}
              </Text>
              {result.tastingNotes.length ? (
                <View style={styles.notes}>
                  {result.tastingNotes.map((n) => (
                    <View key={n} style={styles.note}>
                      <Text style={styles.noteText}>{n}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.kv}>
                <Text variant="label">How to serve</Text>
                <Text variant="body" color={colors.ink}>
                  {result.servingSuggestion}
                </Text>
              </View>
              <View style={styles.kv}>
                <Text variant="label">Pair it with</Text>
                <Text variant="body" color={colors.ink}>
                  {result.pairing}
                </Text>
              </View>
              <View style={[styles.kv, styles.fact]}>
                <Sparkles size={16} color={colors.terracotta} />
                <Text variant="lede" style={{ flex: 1, fontSize: 15 }}>
                  {result.funFact}
                </Text>
              </View>
            </PrintCard>

            {festivalDrink ? (
              <PressCard onPress={() => router.push({ pathname: '/drinks/[id]', params: { id: festivalDrink.id } })} background={colors.sun} accessibilityLabel={`${festivalDrink.name} is poured at Tequila Town`} contentStyle={styles.festival}>
                <Image source={artFor(festivalDrink.image).source} style={styles.festivalImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text variant="label" color={colors.ink}>
                    Poured at Tequila Town
                  </Text>
                  <Text variant="subheading">{festivalDrink.name}</Text>
                </View>
                <ArrowRight size={20} color={colors.ink} />
              </PressCard>
            ) : null}

            <Button label="Ask El Cantinero" icon={MessageCircle} variant="blush" onPress={askCantinero} full />
            <Button
              label="Scan another"
              icon={RefreshCw}
              variant="ghost"
              size="md"
              onPress={() => {
                setResult(null);
                setPhoto(null);
              }}
              style={{ alignSelf: 'center' }}
            />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.springify()} style={{ gap: 16 }}>
            <View style={[styles.viewfinder, { width: frameW, height: frameW * 1.2 }]}>
              {permission?.granted ? (
                <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
              ) : (
                <View style={styles.permission}>
                  <Camera size={36} color={colors.blush} />
                  <Text variant="body" color={colors.paper} align="center">
                    El Ojo needs your camera to read labels.
                  </Text>
                  {permission?.canAskAgain === false ? (
                    <Button label="Open settings" variant="blush" size="md" onPress={() => Linking.openSettings()} />
                  ) : (
                    <Button label="Allow camera" variant="blush" size="md" onPress={requestPermission} />
                  )}
                </View>
              )}
              <View style={styles.label} pointerEvents="none" />
            </View>
            <View style={styles.controls}>
              <PressableScale onPress={pick} accessibilityLabel="Choose a photo" style={styles.sideBtn}>
                <ImagePlus size={22} color={colors.paper} />
              </PressableScale>
              <PressableScale onPress={shoot} disabled={!permission?.granted} accessibilityLabel="Identify bottle" pressedScale={0.9} hapticOnPress="none" style={styles.shutter}>
                <View style={styles.shutterInner} />
              </PressableScale>
              <View style={{ width: 52 }} />
            </View>
            <Text variant="small" color="rgba(243,233,210,0.5)" align="center">
              {progress?.ai.identify ?? aiLimits.identifications} scans left today. Photos are analyzed by our AI provider and not stored.
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  viewfinder: { alignSelf: 'center', overflow: 'hidden', borderRadius: radii.xl, backgroundColor: colors.nightCard, borderWidth: 2, borderColor: colors.blush },
  label: { position: 'absolute', left: '18%', right: '18%', top: '22%', bottom: '22%', borderWidth: 2, borderColor: 'rgba(242,165,65,0.85)', borderRadius: radii.lg, borderStyle: 'dashed' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  sideBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.nightLine, backgroundColor: 'rgba(243,233,210,0.06)' },
  shutter: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, borderColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.sun },
  scanning: { width: 240, height: 300, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 2, borderColor: colors.blush },
  resultImg: { width: 86, height: 108, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.ink },
  name: { fontFamily: fonts.display, fontSize: 22, lineHeight: 25, letterSpacing: 0.8, color: colors.ink, marginTop: 2 },
  notes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: colors.blush, borderWidth: 1.2, borderColor: colors.ink },
  noteText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: colors.ink },
  kv: { gap: 2, paddingTop: 8, borderTopWidth: 1, borderColor: colors.inkFaint },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  festival: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  festivalImg: { width: 54, height: 54, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.ink },
});
