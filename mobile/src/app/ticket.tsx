import * as Brightness from 'expo-brightness';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Clock, MapPin, ScanLine, Sun, Ticket as TicketIcon } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { festival } from '@shared/content/festival';

import { Confetti } from '@/components/art/confetti';
import { SignInGate } from '@/components/sign-in-gate';
import { Button } from '@/components/ui/button';
import { PrintCard } from '@/components/ui/card';
import { TopBar } from '@/components/ui/screen';
import { LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { api, errorMessage, isApiError } from '@/lib/api';
import { useMe, useSetProgress } from '@/lib/queries';
import { useIsSignedIn } from '@/state/session';
import { art } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

const TICKET_RE = /^[A-Z0-9-]{5,50}$/;

const dateRange = () => {
  const s = new Date(festival.startDate);
  const e = new Date(festival.endDate);
  return `${s.toLocaleString('en-US', { month: 'long' }).toUpperCase()} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
};

/** Max brightness while the ticket QR is on screen (restored on blur). Window-level, so no permission needed. */
function useBoostBrightness(active: boolean) {
  useFocusEffect(
    useCallback(() => {
      if (!active || Platform.OS === 'web') return;
      let previous: number | null = null;
      (async () => {
        try {
          previous = await Brightness.getBrightnessAsync();
          await Brightness.setBrightnessAsync(1);
        } catch {
          /* best effort */
        }
      })();
      return () => {
        if (previous !== null) void Brightness.setBrightnessAsync(previous).catch(() => undefined);
      };
    }, [active]),
  );
}

function Notch({ side }: { side: 'left' | 'right' }) {
  return <View style={[styles.notch, side === 'left' ? { left: -14 } : { right: -14 }]} />;
}

export default function TicketScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const insets = useSafeAreaInsets();
  const signedIn = useIsSignedIn();
  const { data, isLoading } = useMe();
  const setProgress = useSetProgress();
  const [code, setCode] = useState(params.code?.toUpperCase() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fire, setFire] = useState(0);
  const autoTried = useRef(false);

  const ticket = data?.progress.ticket;
  useBoostBrightness(!!ticket);

  const claim = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!TICKET_RE.test(c)) return setError('Ticket codes are 5–50 letters, numbers or dashes.');
    setBusy(true);
    setError(null);
    try {
      const res = await api.claimTicket(c);
      setProgress(res.progress);
      if (res.status === 'claimed') {
        setFire((f) => f + 1);
        toast.reward('Ticket claimed', res.pointsAwarded ? `+${res.pointsAwarded} points` : 'Linked to your passport');
      } else {
        toast.info('Already yours', 'This ticket is linked to your passport.');
      }
    } catch (e) {
      setError(isApiError(e) && e.code === 'TICKET_TAKEN' ? 'This ticket is already linked to another passport.' : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Arriving from the scanner with a ticket code: claim it straight away.
  useEffect(() => {
    if (params.code && signedIn && data && !data.progress.ticket && !autoTried.current) {
      autoTried.current = true;
      void claim(params.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code, signedIn, data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.sky }}>
      <Image source={art.ticketSky.source} style={StyleSheet.absoluteFill} contentFit="cover" />
      <TopBar tone="glass" title="Your ticket" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 72, paddingHorizontal: gutter, paddingBottom: insets.bottom + 40, gap: 18 }} keyboardShouldPersistTaps="handled">
          {!signedIn ? (
            <SignInGate message="Link your festival ticket to your passport for entry and +100 points." />
          ) : isLoading ? (
            <LoadingState />
          ) : ticket ? (
            <Animated.View entering={ZoomIn.springify().damping(15)}>
              <PrintCard background={colors.cardWarm} radius={radii.xl} offset={6} contentStyle={{ overflow: 'visible' }}>
                <View style={styles.head}>
                  <Text style={styles.brand} numberOfLines={1} adjustsFontSizeToFit>
                    TEQUILA TOWN
                  </Text>
                  <Text variant="lede" color={colors.inkSoft}>
                    {festival.tagline}
                  </Text>
                  <View style={styles.type}>
                    <TicketIcon size={14} color={colors.card} />
                    <Text style={styles.typeText}>GENERAL ADMISSION</Text>
                  </View>
                </View>
                <View style={styles.qrWrap} accessible accessibilityLabel={`Ticket QR code, reference ${ticket.ref}`}>
                  <View style={styles.qrFrame}>
                    <QRCode value={`TQT:${ticket.ref}`} size={210} color={colors.ink} backgroundColor={colors.card} />
                  </View>
                  <Text style={styles.ref}>{ticket.ref}</Text>
                  {Platform.OS !== 'web' ? (
                    <View style={styles.bright}>
                      <Sun size={13} color={colors.inkMuted} />
                      <Text variant="small">Brightness boosted for the gate scanner</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.perf}>
                  <Notch side="left" />
                  <View style={styles.dash} />
                  <Notch side="right" />
                </View>
                <View style={styles.details}>
                  <View style={styles.detail}>
                    <CalendarDays size={16} color={colors.terracotta} />
                    <Text style={styles.detailText}>{dateRange()}</Text>
                  </View>
                  <View style={styles.detail}>
                    <Clock size={16} color={colors.terracotta} />
                    <Text style={styles.detailText}>{festival.dailyHours}</Text>
                  </View>
                  <View style={styles.detail}>
                    <MapPin size={16} color={colors.terracotta} />
                    <Text style={styles.detailText}>{festival.venue.toUpperCase()}</Text>
                  </View>
                  <View style={styles.holder}>
                    <View>
                      <Text variant="label">Guest</Text>
                      <Text variant="bodyStrong">{data?.user.name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="label">Linked</Text>
                      <Text variant="bodyStrong">{new Date(ticket.claimedAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                </View>
              </PrintCard>
              <Text variant="small" align="center" color={colors.card} style={{ marginTop: 14, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 }}>
                Show this at the entrance with a valid photo ID. {festival.ageMinimum}+ only.
              </Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.springify()}>
              <PrintCard contentStyle={{ padding: 20, gap: 14 }}>
                <TicketIcon size={34} color={colors.terracotta} />
                <Text variant="display">CLAIM YOUR TICKET</Text>
                <Text variant="body">Scan the QR on your festival ticket — or type its code — to link it to your passport. You&apos;ll earn 100 points.</Text>
                <Button label="Scan ticket" icon={ScanLine} onPress={() => router.push('/scan')} full />
                <View style={styles.or}>
                  <View style={styles.rule} />
                  <Text variant="label">or enter it</Text>
                  <View style={styles.rule} />
                </View>
                <TextField
                  label="Ticket code"
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="TT-2027-ABCD"
                  error={error}
                  maxLength={50}
                  returnKeyType="go"
                  onSubmitEditing={() => claim(code)}
                />
                <Button label="Claim ticket" variant="secondary" loading={busy} disabled={!code.trim()} onPress={() => claim(code)} full />
              </PrintCard>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <Confetti fire={fire} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', paddingTop: 22, paddingHorizontal: 18, gap: 2 },
  brand: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, letterSpacing: 1.2, color: colors.terracotta, alignSelf: 'stretch', textAlign: 'center' },
  type: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.pill },
  typeText: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.4, color: colors.card },
  qrWrap: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  qrFrame: { padding: 14, backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.ink },
  ref: { fontFamily: fonts.sansBold, fontSize: 18, letterSpacing: 3, color: colors.ink },
  bright: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perf: { height: 28, justifyContent: 'center' },
  notch: { position: 'absolute', top: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.sky, borderWidth: 1.5, borderColor: colors.ink },
  dash: { marginHorizontal: 22, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.inkMuted },
  details: { padding: 20, gap: 10 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { fontFamily: fonts.display, fontSize: 17, lineHeight: 19, letterSpacing: 0.8, color: colors.ink, marginTop: 2 },
  holder: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderColor: colors.inkFaint },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rule: { flex: 1, height: 1.2, backgroundColor: colors.inkFaint },
});
