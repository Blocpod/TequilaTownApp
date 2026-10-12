import { useQuery } from '@tanstack/react-query';
import { Crown } from 'lucide-react-native';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LeaderboardEntry } from '@shared/api';

import { Avatar } from '@/components/avatar';
import { SignInGate } from '@/components/sign-in-gate';
import { PrintCard } from '@/components/ui/card';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/queries';
import { useIsSignedIn } from '@/state/session';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

const MEDAL = [colors.gold, '#A8A9AD', '#B5734A'];

function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const order = [entries[1], entries[0], entries[2]].filter(Boolean) as LeaderboardEntry[];
  const heights = { 1: 128, 2: 96, 3: 76 } as Record<number, number>;
  return (
    <View style={styles.podium}>
      {order.map((e, i) => (
        <Animated.View key={e.rank} entering={FadeInUp.delay(150 + i * 120).springify()} style={styles.podiumCol}>
          {e.rank === 1 ? <Crown size={22} color={colors.gold} fill={colors.sun} /> : null}
          <Avatar name={e.name} url={e.avatarUrl} size={e.rank === 1 ? 70 : 56} style={{ borderColor: MEDAL[e.rank - 1], borderWidth: 3 }} />
          <Text variant="bodyStrong" numberOfLines={1} style={{ maxWidth: 100 }}>
            {e.isYou ? 'You' : e.name}
          </Text>
          <Text style={styles.podiumPts}>{e.points.toLocaleString()}</Text>
          <View style={[styles.block, { height: heights[e.rank], backgroundColor: e.rank === 1 ? colors.terracotta : e.rank === 2 ? colors.agave : colors.sky }]}>
            <Text style={styles.blockNum}>{e.rank}</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function Row({ e, index }: { e: LeaderboardEntry; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 35).springify()}>
      <View style={[styles.row, e.isYou && styles.rowYou]}>
        <Text style={styles.rank}>{e.rank}</Text>
        <Avatar name={e.name} url={e.avatarUrl} size={40} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {e.isYou ? `${e.name} (you)` : e.name}
          </Text>
          <Text variant="small">
            Level {e.level}, {e.stamps} stamps
          </Text>
        </View>
        <Text style={styles.pts}>{e.points.toLocaleString()}</Text>
      </View>
    </Animated.View>
  );
}

export default function Leaderboard() {
  const insets = useSafeAreaInsets();
  const signedIn = useIsSignedIn();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: qk.leaderboard, queryFn: api.leaderboard, enabled: signedIn, staleTime: 15_000 });

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar title="Hall of Legends" />
      {!signedIn ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: gutter }}>
          <SignInGate message="Sign in to see where you rank among Tequila Town's explorers." />
        </View>
      ) : isLoading ? (
        <LoadingState />
      ) : error || !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : (
        <FlatList
          data={data.entries.slice(3)}
          keyExtractor={(e) => String(e.rank)}
          renderItem={({ item, index }) => <Row e={item} index={index} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.terracotta} />}
          contentContainerStyle={{ paddingTop: insets.top + 74, paddingHorizontal: gutter, paddingBottom: insets.bottom + 120, gap: 8 }}
          ListHeaderComponent={
            <View style={{ gap: 6, marginBottom: 12 }}>
              <Text variant="lede" color={colors.terracotta}>
                The most stamped passports
              </Text>
              <Text variant="display">HALL OF LEGENDS</Text>
              {data.entries.length ? <Podium entries={data.entries.slice(0, 3)} /> : null}
            </View>
          }
          ListEmptyComponent={data.entries.length ? null : <EmptyState art="iconAgaveFlower" title="The board is empty" message="Complete a mission to be the first legend of Tequila Town." />}
        />
      )}
      {data?.you ? (
        <View style={[styles.youWrap, { paddingBottom: insets.bottom + 12 }]}>
          <PrintCard background={colors.ink} shadowColor={colors.terracotta} contentStyle={styles.you}>
            <Text style={[styles.rank, { color: colors.sun }]}>#{data.you.rank}</Text>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" color={colors.paper}>
                Your rank
              </Text>
              <Text variant="small" color={colors.blush}>
                Level {data.you.level}, {data.you.stamps} stamps
              </Text>
            </View>
            <Text style={[styles.pts, { color: colors.paper }]}>{data.you.points.toLocaleString()}</Text>
          </PrintCard>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginTop: 18 },
  podiumCol: { alignItems: 'center', gap: 4, width: 104 },
  podiumPts: { fontFamily: fonts.serifBlack, fontSize: 16, color: colors.terracotta },
  block: { width: '100%', borderTopLeftRadius: radii.md, borderTopRightRadius: radii.md, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', paddingTop: 8, marginTop: 4 },
  blockNum: { fontFamily: fonts.display, fontSize: 34, color: colors.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radii.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.inkFaint },
  rowYou: { borderColor: colors.terracotta, borderWidth: 2, backgroundColor: '#FBE9E2' },
  rank: { width: 34, fontFamily: fonts.serifBlack, fontSize: 18, color: colors.inkSoft, textAlign: 'center' },
  pts: { fontFamily: fonts.serifBlack, fontSize: 17, color: colors.ink },
  youWrap: { position: 'absolute', left: gutter, right: gutter, bottom: 0 },
  you: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
});
