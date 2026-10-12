import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BookOpen, FileText, Images, LifeBuoy, LogOut, Package, Pencil, ScrollText, Settings, ShieldCheck, Sparkles, Ticket, Trophy, Wine } from 'lucide-react-native';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { festival } from '@shared/content/festival';

import { PapelPicado } from '@/components/art/papel-picado';
import { Avatar } from '@/components/avatar';
import { SignInGate } from '@/components/sign-in-gate';
import { PressCard, PrintCard } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { ListRow } from '@/components/ui/list-row';
import { PressableScale } from '@/components/ui/pressable-scale';
import { PaperBackground, TAB_BAR_SPACE } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { APP_VERSION, API_URL } from '@/lib/config';
import { useMe } from '@/lib/queries';
import { useSession, useUser } from '@/state/session';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

const open = (path: string) => WebBrowser.openBrowserAsync(`${API_URL}${path}`);

function Quick({ icon: Icon, label, onPress, tint }: { icon: typeof Ticket; label: string; onPress: () => void; tint: string }) {
  return (
    <PressCard onPress={onPress} accessibilityLabel={label} background={tint} style={{ flex: 1 }} contentStyle={styles.quick}>
      <Icon size={22} color={colors.ink} strokeWidth={2.2} />
      <Text style={styles.quickText}>{label.toUpperCase()}</Text>
    </PressCard>
  );
}

export default function Me() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const user = useUser();
  const { data } = useMe();
  const signOut = useSession((s) => s.signOut);

  const legal = (
    <PrintCard offset={0} contentStyle={{ padding: 0 }}>
      <ListRow first icon={LifeBuoy} label="Help & support" onPress={() => open('/support.html')} />
      <ListRow icon={ShieldCheck} label="Privacy policy" onPress={() => open('/privacy.html')} />
      <ListRow icon={FileText} label="Terms of use" onPress={() => open('/terms.html')} />
    </PrintCard>
  );

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: TAB_BAR_SPACE + insets.bottom, gap: 18 }} showsVerticalScrollIndicator={false}>
        <PapelPicado width={width} offset={4} />
        {!user ? (
          <View style={{ paddingHorizontal: gutter, gap: 18 }}>
            <Text variant="display">ME</Text>
            <SignInGate title="Join Tequila Town" message="Create a free passport to collect stamps, claim your ticket, reserve merch and talk to the Oracle." />
            <PrintCard offset={0} contentStyle={{ padding: 0 }}>
              <ListRow first icon={Wine} label="Tequila guide" onPress={() => router.push('/drinks')} />
              <ListRow icon={BookOpen} label="Sponsors & stories" onPress={() => router.push('/sponsors')} />
            </PrintCard>
            {legal}
          </View>
        ) : (
          <View style={{ paddingHorizontal: gutter, gap: 18 }}>
            <Animated.View entering={FadeInDown.springify()} style={styles.profile}>
              <PressableScale onPress={() => router.push('/edit-profile')} accessibilityLabel="Edit profile">
                <Avatar name={user.name} url={user.avatarUrl} size={86} />
                <View style={styles.editBadge}>
                  <Pencil size={13} color={colors.card} strokeWidth={2.6} />
                </View>
              </PressableScale>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading" numberOfLines={1}>
                  {user.name}
                </Text>
                {user.email ? (
                  <Text variant="small" numberOfLines={1}>
                    {user.email}
                  </Text>
                ) : null}
                {data ? (
                  <Text variant="lede" color={colors.terracotta} style={{ fontSize: 15 }}>
                    Level {data.progress.level.level} · {data.progress.level.title} · {data.progress.points.toLocaleString()} pts
                  </Text>
                ) : null}
              </View>
              <IconButton icon={Settings} label="Settings" onPress={() => router.push('/settings')} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.quickRow}>
              <Quick icon={Ticket} label="Ticket" tint={colors.sun} onPress={() => router.push('/ticket')} />
              <Quick icon={Sparkles} label="Persona" tint={colors.blush} onPress={() => router.push(data?.progress.persona ? '/persona' : '/ritual')} />
              <Quick icon={Trophy} label="Ranks" tint={colors.agaveMist} onPress={() => router.push('/leaderboard')} />
            </Animated.View>

            <PrintCard offset={0} contentStyle={{ padding: 0 }}>
              <ListRow first icon={Images} label="My memories" detail="La Memoria Viva portraits" onPress={() => router.push('/oracle/gallery')} />
              <ListRow icon={Package} label="Shop reservations" detail="Pick up at the Mercado" onPress={() => router.push('/shop/orders')} />
              <ListRow icon={Wine} label="Saved tequilas" detail={`${data?.progress.bookmarks.length ?? 0} bookmarked`} onPress={() => router.push({ pathname: '/drinks', params: { saved: '1' } })} />
              <ListRow icon={ScrollText} label={data?.progress.ritual ? 'Retake the Ritual' : 'Take the Ritual'} detail="Seven questions · reveals your agave persona" onPress={() => router.push('/ritual')} />
              <ListRow icon={BookOpen} label="Sponsors & stories" onPress={() => router.push('/sponsors')} />
            </PrintCard>

            {legal}

            <PrintCard offset={0} contentStyle={{ padding: 0 }}>
              <ListRow
                first
                icon={LogOut}
                label="Sign out"
                danger
                onPress={async () => {
                  await signOut();
                  toast.info('Signed out', '¡Hasta luego!');
                }}
              />
            </PrintCard>
          </View>
        )}
        <Text variant="small" align="center" style={{ marginTop: 6 }}>
          {festival.name} · v{APP_VERSION}
          {'\n'}Please enjoy responsibly. {festival.ageMinimum}+ only.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  editBadge: { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.terracotta, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  quickRow: { flexDirection: 'row', gap: 12 },
  quick: { alignItems: 'center', gap: 6, paddingVertical: 16, borderRadius: radii.lg },
  quickText: { fontFamily: fonts.display, fontSize: 14, lineHeight: 16, letterSpacing: 1, color: colors.ink, marginTop: 2 },
});
