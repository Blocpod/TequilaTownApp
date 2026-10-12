import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Flashlight, FlashlightOff, Keyboard, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { missionById } from '@shared/content/missions';

import { SignInGate } from '@/components/sign-in-gate';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { api, errorMessage, isApiError } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useSetProgress } from '@/lib/queries';
import { useIsSignedIn } from '@/state/session';
import { colors, fonts, gutter } from '@/theme/tokens';

const BOX = 250;

function Viewfinder() {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const line = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    line.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [reduce, line]);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: line.get() * (BOX - 8) }] }));
  const top = (height - BOX) / 2 - 40;
  const left = (width - BOX) / 2;
  const mask = 'rgba(18,14,12,0.62)';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: top, backgroundColor: mask }} />
      <View style={{ position: 'absolute', top: top + BOX, left: 0, right: 0, bottom: 0, backgroundColor: mask }} />
      <View style={{ position: 'absolute', top, left: 0, width: left, height: BOX, backgroundColor: mask }} />
      <View style={{ position: 'absolute', top, right: 0, width: left, height: BOX, backgroundColor: mask }} />
      <View style={{ position: 'absolute', top, left, width: BOX, height: BOX }}>
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <View
            key={c}
            style={[
              styles.corner,
              c.includes('t') ? { top: -3, borderTopWidth: 5 } : { bottom: -3, borderBottomWidth: 5 },
              c.includes('l') ? { left: -3, borderLeftWidth: 5 } : { right: -3, borderRightWidth: 5 },
            ]}
          />
        ))}
        <Animated.View style={[styles.line, lineStyle]} />
      </View>
    </View>
  );
}

export default function Scan() {
  const params = useLocalSearchParams<{ missionId?: string; stepId?: string; title?: string }>();
  const insets = useSafeAreaInsets();
  const signedIn = useIsSignedIn();
  const setProgress = useSetProgress();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  const mission = params.missionId ? missionById(params.missionId) : undefined;
  const step = mission?.steps.find((s) => s.id === params.stepId);
  const title = step?.title ?? 'Scan a code';

  const release = (ms = 1400) => setTimeout(() => (locked.current = false), ms);

  const handle = async (payload: string) => {
    if (locked.current || !payload) return;
    locked.current = true;
    haptic.press();
    setBusy(true);
    try {
      if (mission && step) {
        const progress = await api.completeStep({ missionId: mission.id, stepId: step.id, code: payload });
        setProgress(progress);
        toast.reward('Code accepted', step.title);
        router.back();
        return;
      }
      const result = await api.scan(payload);
      if (result.kind === 'mission_step') {
        setProgress(result.progress);
        const m = missionById(result.missionId);
        toast.reward('Step complete', m?.steps.find((s) => s.id === result.stepId)?.title ?? m?.name);
        router.replace({ pathname: '/mission/[id]', params: { id: result.missionId } });
      } else if (result.kind === 'ticket') {
        router.replace({ pathname: '/ticket', params: { code: result.code } });
      } else {
        toast.error('Unknown code', "That QR isn't part of Tequila Town.");
        release(1800);
      }
    } catch (e) {
      if (isApiError(e) && e.code === 'INVALID_CODE') toast.error("That's not the one", step ? `Find the QR for “${step.title}”.` : 'That code is not valid.');
      else if (isApiError(e) && e.code === 'LOCKED') toast.error('Mission locked', 'Complete the required missions first.');
      else toast.error('Scan failed', errorMessage(e));
      release(1800);
    } finally {
      setBusy(false);
    }
  };

  const onScanned = (r: BarcodeScanningResult) => void handle(r.data?.trim());

  const granted = permission?.granted;

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      {signedIn && granted && !manual ? (
        <>
          <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={busy ? undefined : onScanned} />
          <Viewfinder />
        </>
      ) : null}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <IconButton icon={X} label="Close scanner" tone="glass" onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="label" color={colors.blush}>
            {mission ? mission.name : 'Tequila Town'}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {title.toUpperCase()}
          </Text>
        </View>
        {granted && !manual ? (
          <IconButton icon={torch ? FlashlightOff : Flashlight} label={torch ? 'Turn off flashlight' : 'Turn on flashlight'} tone="glass" onPress={() => setTorch((t) => !t)} />
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {!signedIn ? (
        <View style={styles.center}>
          <SignInGate night message="Scanning collects mission steps and links your ticket — create a free passport to start." />
        </View>
      ) : manual ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
          <Animated.View entering={FadeInDown.springify()} style={{ gap: 16, width: '100%' }}>
            <TextField
              night
              label="Code"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              placeholder="e.g. AGV-SHRINE-7K3QX"
              returnKeyType="go"
              onSubmitEditing={() => {
                locked.current = false;
                void handle(code.trim());
              }}
              hint="Printed under every Tequila Town QR code — or your ticket code."
            />
            <Button
              label="Submit code"
              variant="blush"
              loading={busy}
              onPress={() => {
                locked.current = false;
                void handle(code.trim());
              }}
              full
            />
          </Animated.View>
        </KeyboardAvoidingView>
      ) : !permission ? null : !granted ? (
        <Animated.View entering={FadeIn} style={styles.center}>
          <Camera size={42} color={colors.blush} />
          <Text variant="title" color={colors.paper} align="center">
            CAMERA ACCESS
          </Text>
          <Text variant="body" color="rgba(243,233,210,0.8)" align="center">
            Point your camera at the Tequila Town QR codes around each zone to collect mission steps.
          </Text>
          {permission.canAskAgain ? (
            <Button label="Allow camera" variant="blush" onPress={requestPermission} />
          ) : (
            <Button label="Open settings" variant="blush" onPress={() => Linking.openSettings()} />
          )}
        </Animated.View>
      ) : (
        <View style={[styles.hintWrap, { bottom: insets.bottom + 120 }]} pointerEvents="none">
          <Text variant="body" color={colors.paper} align="center">
            {step ? 'Line up the QR at this station inside the frame.' : 'Scan a zone QR or your festival ticket.'}
          </Text>
        </View>
      )}

      {signedIn ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
          <Button
            label={manual ? 'Use camera' : 'Enter code'}
            icon={manual ? Camera : Keyboard}
            variant="secondary"
            size="md"
            style={{ alignSelf: 'center' }}
            onPress={() => {
              setManual((m) => !m);
              locked.current = false;
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter - 4, gap: 8, zIndex: 5 },
  title: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, letterSpacing: 1, color: colors.paper, marginTop: 2 },
  corner: { position: 'absolute', width: 38, height: 38, borderColor: colors.sun, borderRadius: 6 },
  line: { position: 'absolute', left: 12, right: 12, top: 4, height: 3, borderRadius: 2, backgroundColor: colors.terracottaBright, opacity: 0.9 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: gutter, gap: 14 },
  hintWrap: { position: 'absolute', left: gutter, right: gutter },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
});
