import { router } from 'expo-router';
import { CalendarDays, Clock, MapPin } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { festival, festivalPhase } from '@shared/content/festival';
import { music } from '@shared/content/program';

import { PrintCard } from '@/components/ui/card';
import { Tag } from '@/components/ui/chip';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const fmtRange = () => {
  const s = new Date(festival.startDate);
  const e = new Date(festival.endDate);
  const month = s.toLocaleString('en-US', { month: 'long' });
  return `${month} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
};

/** "2:00 PM" → minutes since midnight */
const toMinutes = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim());
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
};

function upNext(now: Date) {
  const mins = now.getHours() * 60 + now.getMinutes();
  return music
    .map((m) => ({ m, at: toMinutes(m.time) }))
    .filter((x): x is { m: (typeof music)[number]; at: number } => x.at !== null && x.at >= mins - 30)
    .sort((a, b) => a.at - b.at)[0]?.m;
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.unit}>
      <Text style={styles.unitValue}>{String(value).padStart(2, '0')}</Text>
      <Text style={styles.unitLabel}>{label}</Text>
    </View>
  );
}

/** Countdown before the gates open, "live now" during, a farewell after. */
export function FestivalStatus() {
  const now = useNow();
  const phase = festivalPhase(now);

  if (phase === 'live') {
    const day = Math.floor((now.getTime() - new Date(festival.startDate).getTime()) / 86_400_000) + 1;
    const next = upNext(now);
    return (
      <PrintCard background={colors.ink} shadowColor={colors.terracotta} contentStyle={styles.pad}>
        <View style={styles.row}>
          <Tag label={`Live · Day ${day}`} color={colors.terracotta} textColor={colors.card} />
          <Text variant="small" color={colors.blush}>
            {festival.dailyHours}
          </Text>
        </View>
        <Text variant="title" color={colors.paper} style={{ marginTop: 10 }}>
          THE GATES ARE OPEN
        </Text>
        {next ? (
          <PressableScale onPress={() => router.push('/program/music')} style={styles.next} accessibilityLabel={`Up next: ${next.title} at ${next.time}`}>
            <Text variant="label" color={colors.blush}>
              Up next
            </Text>
            <Text variant="subheading" color={colors.paper}>
              {next.title} · {next.time}
            </Text>
          </PressableScale>
        ) : null}
      </PrintCard>
    );
  }

  if (phase === 'ended') {
    return (
      <PrintCard contentStyle={styles.pad}>
        <Text variant="lede" color={colors.terracotta}>
          Hasta la próxima
        </Text>
        <Text variant="title">SEE YOU NEXT YEAR</Text>
        <Text variant="body" style={{ marginTop: 6 }}>
          Your passport, stamps and memories are saved. Thank you for drinking to remember.
        </Text>
      </PrintCard>
    );
  }

  const diff = Math.max(0, new Date(festival.startDate).getTime() - now.getTime());
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);

  return (
    <PrintCard contentStyle={styles.pad}>
      <Text variant="label" color={colors.terracotta}>
        The gates open in
      </Text>
      <View style={styles.units} accessible accessibilityLabel={`${d} days, ${h} hours, ${m} minutes until the festival`}>
        <Unit value={d} label="days" />
        <Text style={styles.colon}>:</Text>
        <Unit value={h} label="hrs" />
        <Text style={styles.colon}>:</Text>
        <Unit value={m} label="min" />
        <Text style={styles.colon}>:</Text>
        <Unit value={s} label="sec" />
      </View>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <CalendarDays size={15} color={colors.inkSoft} />
          <Text variant="small" color={colors.inkSoft}>
            {fmtRange()}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Clock size={15} color={colors.inkSoft} />
          <Text variant="small" color={colors.inkSoft}>
            {festival.dailyHours}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <MapPin size={15} color={colors.inkSoft} />
          <Text variant="small" color={colors.inkSoft}>
            {festival.venue}
          </Text>
        </View>
      </View>
    </PrintCard>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  units: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 10 },
  unit: { alignItems: 'center', minWidth: 54 },
  unitValue: { fontFamily: fonts.serifBlack, fontSize: 38, lineHeight: 44, color: colors.ink, fontVariant: ['tabular-nums'] },
  unitLabel: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.4, color: colors.inkMuted, textTransform: 'uppercase' },
  colon: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 42, color: colors.terracotta },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14, paddingTop: 12, borderTopWidth: 1.2, borderStyle: 'dashed', borderColor: colors.inkFaint },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  next: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1.2, borderColor: colors.nightLine, backgroundColor: 'rgba(243,233,210,0.06)', gap: 2 },
});
