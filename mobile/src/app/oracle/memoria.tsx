import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, Download, ImagePlus, Images, RefreshCw, Share2, SwitchCamera } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Memory } from '@shared/api';
import { aiLimits, memoryStyles, type MemoryStyle } from '@shared/content/oracle';

import { SignInGate } from '@/components/sign-in-gate';
import { Button } from '@/components/ui/button';
import { PressCard, PrintCard } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressBar } from '@/components/ui/progress';
import { TopBar } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { api, errorMessage, isApiError } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { prepareJpeg, saveImageToLibrary, shareImage } from '@/lib/image';
import { qk, queryClient, useProgress } from '@/lib/queries';
import { useNightStatusBar } from '@/lib/use-night-status-bar';
import { useIsSignedIn } from '@/state/session';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

type Stage = 'capture' | 'style' | 'developing' | 'result';

const DEVELOPING = ['Pouring the developer', 'Sharpening the coa', 'Finding your agave field', 'Waiting for golden hour', 'Fixing the silver', 'Almost dry'];

function Developing({ photo }: { photo: string }) {
  const reduce = useReducedMotion();
  const [msg, setMsg] = useState(0);
  const [progress, setProgress] = useState(0.05);
  const fade = useSharedValue(0);
  useEffect(() => {
    const t = setInterval(() => setMsg((m) => (m + 1) % DEVELOPING.length), 2600);
    const p = setInterval(() => setProgress((v) => Math.min(0.92, v + (0.92 - v) * 0.08)), 700);
    if (!reduce) fade.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => {
      clearInterval(t);
      clearInterval(p);
    };
  }, [reduce, fade]);
  const tray = useAnimatedStyle(() => ({ opacity: 0.35 + fade.get() * 0.4 }));
  return (
    <Animated.View entering={FadeIn} style={{ gap: 18, alignItems: 'center' }}>
      <View style={styles.devFrame}>
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#5A3A1C' }, tray]} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(160,30,20,0.25)' }]} />
      </View>
      <Text variant="lede" color={colors.blush} align="center" accessibilityLiveRegion="polite">
        {DEVELOPING[msg]}
      </Text>
      <ProgressBar value={progress} color={colors.sun} track={colors.nightCard} style={{ width: '80%' }} />
      <Text variant="small" color="rgba(243,233,210,0.5)" align="center">
        This takes 10 to 30 seconds. Keep the app open.
      </Text>
    </Animated.View>
  );
}

export default function Memoria() {
  useNightStatusBar();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const signedIn = useIsSignedIn();
  const progress = useProgress();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [stage, setStage] = useState<Stage>('capture');
  const [photo, setPhoto] = useState<string | null>(null);
  const [style, setStyle] = useState<MemoryStyle>('tintype');
  const [memory, setMemory] = useState<Memory | null>(null);
  const [saving, setSaving] = useState(false);

  const frameW = width - gutter * 2;
  const remaining = progress?.ai.memories ?? aiLimits.memories;

  const shoot = async () => {
    try {
      haptic.thunk();
      const pic = await camera.current?.takePictureAsync({ quality: 0.85, shutterSound: false });
      if (pic?.uri) {
        setPhoto(pic.uri);
        setStage('style');
      }
    } catch {
      toast.error('Camera error', 'Could not take the photo. Try again.');
    }
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [4, 5] });
    if (!res.canceled && res.assets[0]?.uri) {
      setPhoto(res.assets[0].uri);
      setStage('style');
    }
  };

  const develop = async () => {
    if (!photo) return;
    setStage('developing');
    try {
      const { base64 } = await prepareJpeg(photo, 1024, 0.85);
      const m = await api.createMemory({ image: base64, style });
      setMemory(m);
      setStage('result');
      haptic.success();
      void queryClient.invalidateQueries({ queryKey: qk.memories });
      void queryClient.invalidateQueries({ queryKey: qk.me });
    } catch (e) {
      setStage('style');
      if (isApiError(e) && e.code === 'LIMIT_REACHED') toast.error('Out of film for today', `You can develop ${aiLimits.memories} portraits a day.`);
      else if (isApiError(e) && e.code === 'AI_REFUSED') toast.error('The Oracle looked away', 'Try a clear, well-lit photo of a face.');
      else toast.error('Developing failed', errorMessage(e));
    }
  };

  const save = async () => {
    if (!memory) return;
    setSaving(true);
    try {
      const r = await saveImageToLibrary(memory.imageUrl, `memoria-viva-${memory.id}.jpg`);
      if (r === 'saved') toast.success('Saved to Photos');
      else toast.error('Photos access needed', 'Allow access in Settings to save portraits.');
    } catch (e) {
      toast.error('Could not save', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const restart = () => {
    setPhoto(null);
    setMemory(null);
    setStage('capture');
  };

  const styleMeta = memoryStyles.find((s) => s.id === (memory?.style ?? style));

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <TopBar night tone="glass" title="La Memoria Viva" right={signedIn ? <PressableScale onPress={() => router.push('/oracle/gallery')} accessibilityLabel="My memories" style={styles.galleryBtn}><Images size={20} color={colors.paper} /></PressableScale> : undefined} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 74, paddingHorizontal: gutter, paddingBottom: insets.bottom + 40, gap: 18 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 4 }}>
          <Text variant="lede" color={colors.blush}>
            The Living Memory
          </Text>
          <Text variant="display" color={colors.paper}>
            {stage === 'result' ? 'YOUR MEMORY' : stage === 'style' ? 'CHOOSE AN ERA' : stage === 'developing' ? 'DEVELOPING' : 'STEP BACK IN TIME'}
          </Text>
          {stage === 'capture' ? (
            <Text variant="body" color="rgba(243,233,210,0.75)">
              Take a selfie and the Oracle returns you as a jimador harvesting agave, in tintype, wartime black and white, sepia or Kodachrome.
            </Text>
          ) : null}
        </View>

        {!signedIn ? (
          <SignInGate night message="Create a free passport to develop your Memoria Viva portraits and keep them in your gallery." />
        ) : stage === 'capture' ? (
          <Animated.View entering={FadeInDown.springify()} style={{ gap: 16 }}>
            <View style={[styles.arch, { width: frameW, height: frameW * 1.25 }]}>
              {permission?.granted ? (
                <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} mirror={facing === 'front'} />
              ) : (
                <View style={styles.permission}>
                  <Camera size={36} color={colors.blush} />
                  <Text variant="body" color={colors.paper} align="center">
                    The Oracle needs your camera to see you.
                  </Text>
                  {permission?.canAskAgain === false ? (
                    <Button label="Open settings" variant="blush" size="md" onPress={() => Linking.openSettings()} />
                  ) : (
                    <Button label="Allow camera" variant="blush" size="md" onPress={requestPermission} />
                  )}
                </View>
              )}
              <View style={styles.archRing} pointerEvents="none" />
            </View>
            <View style={styles.controls}>
              <PressableScale onPress={pick} accessibilityLabel="Choose a photo from your library" style={styles.sideBtn}>
                <ImagePlus size={22} color={colors.paper} />
              </PressableScale>
              <PressableScale onPress={shoot} disabled={!permission?.granted} accessibilityLabel="Take photo" pressedScale={0.9} hapticOnPress="none" style={styles.shutter}>
                <View style={styles.shutterInner} />
              </PressableScale>
              <PressableScale onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} accessibilityLabel="Flip camera" style={styles.sideBtn}>
                <SwitchCamera size={22} color={colors.paper} />
              </PressableScale>
            </View>
            <Text variant="small" color="rgba(243,233,210,0.5)" align="center">
              {remaining} of {aiLimits.memories} portraits left today. Your photo is sent to our AI image provider to create the portrait.
            </Text>
          </Animated.View>
        ) : stage === 'style' && photo ? (
          <Animated.View entering={FadeInDown.springify()} style={{ gap: 16 }}>
            <View style={styles.thumbRow}>
              <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="subheading" color={colors.paper}>
                  Looking good.
                </Text>
                <Text variant="small" color="rgba(243,233,210,0.7)">
                  Pick the era the Oracle should develop you in.
                </Text>
                <Button label="Retake" icon={RefreshCw} variant="ghost" size="sm" onPress={restart} style={{ marginLeft: -12 }} />
              </View>
            </View>
            <View style={styles.styles}>
              {memoryStyles.map((s) => {
                const on = s.id === style;
                return (
                  <PressCard
                    key={s.id}
                    onPress={() => setStyle(s.id)}
                    accessibilityLabel={`${s.name}, ${s.era}`}
                    background={on ? colors.blush : colors.nightCard}
                    borderColor={on ? colors.ink : colors.nightLine}
                    shadowColor={on ? colors.terracotta : colors.night}
                    offset={on ? 4 : 0}
                    style={{ width: (frameW - 12) / 2 }}
                    contentStyle={{ padding: 12, gap: 6 }}
                  >
                    <View style={[styles.swatch, { backgroundColor: s.tint }]} />
                    <Text style={[styles.styleName, { color: on ? colors.ink : colors.paper }]}>{s.name.toUpperCase()}</Text>
                    <Text variant="label" color={on ? colors.terracotta : colors.blush}>
                      {s.era}
                    </Text>
                    <Text variant="small" color={on ? colors.inkSoft : 'rgba(243,233,210,0.65)'} numberOfLines={3}>
                      {s.description}
                    </Text>
                  </PressCard>
                );
              })}
            </View>
            <Button label="Develop my memory" variant="blush" onPress={develop} disabled={remaining <= 0} full />
          </Animated.View>
        ) : stage === 'developing' && photo ? (
          <Developing photo={photo} />
        ) : memory ? (
          <Animated.View entering={ZoomIn.springify().damping(16)} style={{ gap: 16 }}>
            <PrintCard background={colors.cardWarm} shadowColor={colors.terracotta} offset={6} contentStyle={{ padding: 14, gap: 10 }}>
              <Image source={{ uri: memory.imageUrl }} style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: radii.sm, backgroundColor: colors.paperDeep }} contentFit="cover" transition={600} />
              <Text variant="lede" align="center" style={{ fontSize: 15 }}>
                La Memoria Viva, {styleMeta?.name}, {styleMeta?.era}
              </Text>
            </PrintCard>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Save" icon={Download} variant="blush" size="md" loading={saving} onPress={save} style={{ flex: 1 }} full />
              <Button
                label="Share"
                icon={Share2}
                variant="secondary"
                size="md"
                onPress={() => shareImage(memory.imageUrl, 'I became a jimador at Tequila Town 🌵🥃', memory.shareUrl).catch(() => toast.error('Could not share'))}
                style={{ flex: 1 }}
                full
              />
            </View>
            <Button label="Develop another" icon={RefreshCw} variant="ghost" size="md" onPress={restart} style={{ alignSelf: 'center' }} />
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  galleryBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18,14,12,0.42)', borderWidth: 1.5, borderColor: 'rgba(243,233,210,0.35)' },
  arch: { alignSelf: 'center', overflow: 'hidden', borderTopLeftRadius: 999, borderTopRightRadius: 999, borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg, backgroundColor: colors.nightCard },
  archRing: { ...StyleSheet.absoluteFill, borderTopLeftRadius: 999, borderTopRightRadius: 999, borderBottomLeftRadius: radii.lg, borderBottomRightRadius: radii.lg, borderWidth: 3, borderColor: colors.blush },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  sideBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.nightLine, backgroundColor: 'rgba(243,233,210,0.06)' },
  shutter: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, borderColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.sun },
  thumbRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  thumb: { width: 92, height: 115, borderRadius: radii.md, borderWidth: 2, borderColor: colors.blush },
  styles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: '100%', height: 40, borderRadius: radii.sm, borderWidth: 1.2, borderColor: colors.ink },
  styleName: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, letterSpacing: 0.8, marginTop: 2 },
  devFrame: { width: 240, height: 300, borderRadius: radii.md, overflow: 'hidden', borderWidth: 2, borderColor: colors.blush },
});
