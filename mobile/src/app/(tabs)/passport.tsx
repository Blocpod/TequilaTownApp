import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { User } from '@shared/api';
import { experienceById } from '@shared/content/experiences';
import { missions } from '@shared/content/missions';

import { PassportStamp } from '@/components/art/stamp';
import { Avatar } from '@/components/avatar';
import { SignInGate } from '@/components/sign-in-gate';
import { PressCard, PrintCard } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressBar } from '@/components/ui/progress';
import { PaperBackground, TAB_BAR_SPACE } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { allMissionViews, completedCount, type MissionStatus } from '@/features/missions/logic';
import { MissionCard } from '@/features/missions/mission-card';
import { errorMessage } from '@/lib/api';
import { useMe } from '@/lib/queries';
import { useIsSignedIn } from '@/state/session';
import { art, type ArtKey } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

/** Machine-readable-zone flourish: P<TQT<<GARCIA<<MARIA<<<… */
function mrz(user: User) {
  const parts = user.name.toUpperCase().replace(/[^A-Z ]/g, '').split(/\s+/).filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? 'GUEST';
  const first = parts.length > 1 ? parts.slice(0, -1).join('<') : '';
  const line1 = `P<TQT${last}<<${first}`.padEnd(44, '<').slice(0, 44);
  const line2 = `${user.id.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 9).padEnd(9, '<')}<TQT${new Date(user.createdAt).getFullYear()}<<<<AGAVE`.padEnd(44, '<').slice(0, 44);
  return `${line1}\n${line2}`;
}

function Stat({ icon, value, label }: { icon: ArtKey; value: string; label: string }) {
  const a = art[icon];
  return (
    <View style={styles.stat}>
      <Image source={a.source} style={{ width: 44, height: (44 * a.height) / a.width }} contentFit="contain" />
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="label" style={{ fontSize: 9.5 }}>
        {label}
      </Text>
    </View>
  );
}

const FILTERS: { value: 'all' | MissionStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'Active' },
  { value: 'available', label: 'Open' },
  { value: 'completed', label: 'Done' },
];

export default function Passport() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const signedIn = useIsSignedIn();
  const { data, isLoading, error, refetch, isRefetching } = useMe();
  const [filter, setFilter] = useState<'all' | MissionStatus>('all');

  if (!signedIn) {
    return (
      <View style={{ flex: 1 }}>
        <PaperBackground />
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: gutter, gap: 20, paddingBottom: TAB_BAR_SPACE + insets.bottom }}>
          <Text variant="display">PASSPORT</Text>
          <PrintCard radius={radii.lg} contentStyle={{ backgroundColor: colors.terracotta }}>
            <Image source={art.passportCover.source} style={{ width: '100%', aspectRatio: art.passportCover.width / art.passportCover.height }} contentFit="cover" />
          </PrintCard>
          <SignInGate message="Your Tequila Town passport holds your stamps, points, level and ticket. It's free — and it unlocks the Oracle." />
        </ScrollView>
      </View>
    );
  }

  if (isLoading) return <LoadingState label="Opening your passport…" />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  const { user, progress } = data;
  const views = allMissionViews(progress);
  const stamps = completedCount(progress);
  const pct = Math.round((stamps / missions.length) * 100);
  const filtered = views.filter((v) => filter === 'all' || v.status === filter);
  const stampW = (width - gutter * 2 - 18) / 2;

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: TAB_BAR_SPACE + insets.bottom }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.terracotta} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: gutter, gap: 4, marginBottom: 14 }}>
          <Text variant="lede" color={colors.terracotta}>
            Pasaporte de agave
          </Text>
          <Text variant="display" accessibilityRole="header">
            YOUR PASSPORT
          </Text>
        </View>

        {/* Data page */}
        <Animated.View entering={FadeInDown.springify()} style={{ paddingHorizontal: gutter }}>
          <PrintCard background={colors.cardWarm} shadowColor={colors.terracotta} contentStyle={{ padding: 0 }}>
            <View style={styles.pageHead}>
              <Text style={styles.pageHeadText}>PASAPORTE · TEQUILA TOWN</Text>
              <Text style={styles.pageHeadText}>TQT</Text>
            </View>
            <View style={styles.dataRow}>
              <PressableScale onPress={() => router.push('/edit-profile')} accessibilityLabel="Edit profile photo">
                <Avatar name={user.name} url={user.avatarUrl} size={82} oval />
              </PressableScale>
              <View style={{ flex: 1, gap: 6 }}>
                <View>
                  <Text variant="label" style={{ fontSize: 9 }}>
                    Holder
                  </Text>
                  <Text variant="subheading" numberOfLines={1}>
                    {user.name}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 18 }}>
                  <View>
                    <Text variant="label" style={{ fontSize: 9 }}>
                      Rank
                    </Text>
                    <Text variant="bodyStrong">{progress.level.title}</Text>
                  </View>
                  <View>
                    <Text variant="label" style={{ fontSize: 9 }}>
                      Level
                    </Text>
                    <Text variant="bodyStrong">{progress.level.level}</Text>
                  </View>
                  <View>
                    <Text variant="label" style={{ fontSize: 9 }}>
                      Since
                    </Text>
                    <Text variant="bodyStrong">{new Date(user.createdAt).getFullYear()}</Text>
                  </View>
                </View>
                <View style={{ gap: 4 }}>
                  <ProgressBar value={progress.level.progress} height={9} />
                  <Text variant="small">{progress.level.next ? `${(progress.level.next - progress.points).toLocaleString()} pts to level ${progress.level.level + 1}` : 'Legend status reached'}</Text>
                </View>
              </View>
            </View>
            <View style={styles.mrzWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {mrz(user)
                .split('\n')
                .map((line) => (
                  <Text key={line} style={styles.mrz} numberOfLines={1} ellipsizeMode="clip">
                    {line}
                  </Text>
                ))}
            </View>
          </PrintCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).springify()} style={[styles.stats, { marginHorizontal: gutter }]}>
          <Stat icon="iconAgaveFlower" value={progress.points.toLocaleString()} label="Points" />
          <Stat icon="iconAgave" value={`${stamps}/${missions.length}`} label="Stamps" />
          <Stat icon="iconCactusFlower" value={`${pct}%`} label="Complete" />
        </Animated.View>

        <View style={{ paddingHorizontal: gutter, marginTop: 14 }}>
          <PressCard onPress={() => router.push('/leaderboard')} background={colors.ink} shadowColor={colors.terracotta} accessibilityLabel="Open the leaderboard" contentStyle={styles.lb}>
            <Trophy size={22} color={colors.sun} />
            <Text style={styles.lbText}>HALL OF LEGENDS</Text>
            <Text variant="small" color={colors.blush} style={{ marginLeft: 'auto' }}>
              Leaderboard →
            </Text>
          </PressCard>
        </View>

        {/* Stamps */}
        <SectionHeader kicker={stamps ? `${stamps} collected` : 'Your first one is waiting'} title="Stamps" style={{ marginTop: 30 }} />
        <View style={styles.stampGrid}>
          {missions.map((m, i) => (
            <PressableScale key={m.id} onPress={() => router.push({ pathname: '/mission/[id]', params: { id: m.id } })} accessibilityLabel={`${m.reward.name} stamp`} style={{ width: stampW, alignItems: 'center', paddingVertical: 6 }}>
              <PassportStamp image={experienceById(m.experienceId)?.image ?? 'expMercado'} title={m.reward.name} collected={progress.missions[m.id]?.status === 'completed'} width={stampW - 14} seed={i} sealColor={i % 3 === 0 ? colors.terracotta : i % 3 === 1 ? colors.agaveDeep : colors.skyDeep} />
            </PressableScale>
          ))}
        </View>

        {/* Missions */}
        <SectionHeader kicker="Scan, sip & explore" title="Missions" style={{ marginTop: 26 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8, marginBottom: 14 }}>
          {FILTERS.map((f) => (
            <Chip key={f.value} label={`${f.label} · ${f.value === 'all' ? views.length : views.filter((v) => v.status === f.value).length}`} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
        <View style={{ paddingHorizontal: gutter, gap: 12 }}>
          {filtered.length ? (
            filtered.map((v) => <MissionCard key={v.mission.id} view={v} />)
          ) : (
            <Text variant="lede" align="center" style={{ paddingVertical: 20 }}>
              Nothing here yet.
            </Text>
          )}
        </View>

        {/* Ledger */}
        {progress.ledger.length ? (
          <>
            <SectionHeader kicker="Every point, accounted for" title="History" style={{ marginTop: 30 }} />
            <View style={{ paddingHorizontal: gutter }}>
              <PrintCard offset={0} contentStyle={{ paddingHorizontal: 14 }}>
                {progress.ledger.slice(0, 12).map((l, i) => (
                  <View key={l.id} style={[styles.ledgerRow, i > 0 && { borderTopWidth: 1, borderColor: colors.inkFaint }]}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{l.label}</Text>
                      <Text variant="small">{new Date(l.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
                    </View>
                    <Text style={styles.ledgerPts}>+{l.amount}</Text>
                  </View>
                ))}
              </PrintCard>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.terracotta, borderBottomWidth: 1.5, borderColor: colors.ink },
  pageHeadText: { fontFamily: fonts.display, fontSize: 13, lineHeight: 15, letterSpacing: 1.6, color: colors.blush, marginTop: 2 },
  dataRow: { flexDirection: 'row', gap: 16, padding: 14 },
  mrzWrap: { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.inkFaint, overflow: 'hidden' },
  mrz: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.4, color: colors.inkSoft, lineHeight: 15 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 18 },
  stat: { alignItems: 'center', gap: 2, minWidth: 90 },
  statValue: { fontFamily: fonts.serifBlack, fontSize: 24, lineHeight: 28, color: colors.ink, marginTop: 4 },
  lb: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  lbText: { fontFamily: fonts.display, fontSize: 17, lineHeight: 19, letterSpacing: 1, color: colors.paper, marginTop: 2 },
  stampGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: gutter, columnGap: 18, rowGap: 8 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  ledgerPts: { fontFamily: fonts.serifBlack, fontSize: 18, color: colors.agave },
});
