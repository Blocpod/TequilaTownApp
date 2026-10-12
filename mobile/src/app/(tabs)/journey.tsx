import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowRight, Check, Map as MapIcon, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { experiences, type Experience } from '@shared/content/experiences';
import { sponsorById } from '@shared/content/sponsors';

import { Button } from '@/components/ui/button';
import { PressCard, PrintCard } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { PaperBackground, TAB_BAR_SPACE } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { zoneStamped } from '@/features/missions/logic';
import { JourneyMap } from '@/features/zones/journey-map';
import { ZoneBadge } from '@/features/zones/zone-card';
import { useProgress } from '@/lib/queries';
import { artFor } from '@/theme/art';
import { colors, fonts, gutter, radii } from '@/theme/tokens';

function ZoneRow({ zone, stamped, index }: { zone: Experience; stamped: boolean; index: number }) {
  const img = artFor(zone.image);
  const sponsor = zone.sponsorId ? sponsorById(zone.sponsorId) : undefined;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).springify()}>
      <PressCard onPress={() => router.push({ pathname: '/zone/[id]', params: { id: zone.id } })} accessibilityLabel={`Zone ${zone.zone}: ${zone.name}`} contentStyle={styles.row}>
        <Image source={img.source} placeholder={img.blurhash ? { blurhash: img.blurhash } : undefined} style={styles.rowImg} contentFit="cover" />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ZoneBadge zone={zone.zone} color={zone.accent} size={24} />
            {stamped ? (
              <View style={styles.stamped}>
                <Check size={11} color={colors.card} strokeWidth={3} />
                <Text style={styles.stampedText}>STAMPED</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.rowName} numberOfLines={1}>
            {zone.name.toUpperCase()}
          </Text>
          <Text variant="lede" numberOfLines={1} style={{ fontSize: 14, lineHeight: 18 }}>
            {zone.subtitle}
          </Text>
          <Text variant="small" numberOfLines={1}>
            {[zone.pour, zone.duration, sponsor?.name].filter(Boolean).join(', ')}
          </Text>
        </View>
      </PressCard>
    </Animated.View>
  );
}

export default function Journey() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const progress = useProgress();
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [selected, setSelected] = useState<Experience | null>(null);
  const stampedIds = useMemo(() => new Set(experiences.filter((e) => zoneStamped(e.id, progress)).map((e) => e.id)), [progress]);

  const headerH = insets.top + 128;
  const mapH = height - headerH - (TAB_BAR_SPACE + insets.bottom) + 40;

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="lede" color={colors.terracotta}>
              {stampedIds.size} of {experiences.length} zones stamped
            </Text>
            <Text variant="display" accessibilityRole="header">
              THE JOURNEY
            </Text>
          </View>
          <IconButton icon={MapIcon} label="Venue floor plan" onPress={() => router.push('/venue-map')} />
        </View>
        <Segmented
          options={[
            { value: 'map', label: 'Map' },
            { value: 'list', label: 'Zones' },
          ]}
          value={mode}
          onChange={(v) => {
            setMode(v);
            setSelected(null);
          }}
        />
      </View>

      {mode === 'map' ? (
        <View style={{ flex: 1 }}>
          <JourneyMap width={width} height={mapH} zones={experiences} stampedIds={stampedIds} selectedId={selected?.id ?? null} onSelect={setSelected} />
          {!selected ? (
            <Animated.View entering={FadeInDown.delay(400)} style={[styles.hint, { bottom: TAB_BAR_SPACE + insets.bottom - 20 }]} pointerEvents="none">
              <Text variant="small" color={colors.inkSoft} align="center">
                Pinch to zoom, tap a number to explore
              </Text>
            </Animated.View>
          ) : (
            <Animated.View
              key={selected.id}
              entering={SlideInDown.springify().damping(17)}
              exiting={SlideOutDown.duration(160)}
              style={[styles.preview, { bottom: TAB_BAR_SPACE + insets.bottom - 14 }]}
            >
              <PrintCard contentStyle={styles.previewCard}>
                <Image source={artFor(selected.motion ?? selected.image).source} style={styles.previewImg} contentFit="cover" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label" color={selected.accent}>
                    Zone {selected.zone}
                  </Text>
                  <Text style={styles.rowName} numberOfLines={2}>
                    {selected.name.toUpperCase()}
                  </Text>
                  <Text variant="small" numberOfLines={2}>
                    {selected.description}
                  </Text>
                  <Button
                    label="Explore"
                    iconRight={ArrowRight}
                    size="sm"
                    onPress={() => router.push({ pathname: '/zone/[id]', params: { id: selected.id } })}
                    style={{ marginTop: 6 }}
                  />
                </View>
                <IconButton icon={X} label="Close preview" size={32} onPress={() => setSelected(null)} style={{ position: 'absolute', top: 8, right: 8 }} />
              </PrintCard>
            </Animated.View>
          )}
        </View>
      ) : (
        <FlatList
          data={experiences}
          keyExtractor={(z) => z.id}
          renderItem={({ item, index }) => <ZoneRow zone={item} stamped={stampedIds.has(item.id)} index={index} />}
          contentContainerStyle={{ padding: gutter, paddingTop: 8, gap: 12, paddingBottom: TAB_BAR_SPACE + insets.bottom }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: gutter, gap: 12, paddingBottom: 10, zIndex: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  hint: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(251,246,234,0.92)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.inkFaint },
  preview: { position: 'absolute', left: gutter, right: gutter },
  previewCard: { flexDirection: 'row', gap: 12, padding: 12, paddingRight: 40 },
  previewImg: { width: 104, height: 120, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10 },
  rowImg: { width: 86, height: 86, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.ink },
  rowName: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, letterSpacing: 0.8, color: colors.ink, marginTop: 2 },
  stamped: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.agave, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  stampedText: { fontFamily: fonts.sansBold, fontSize: 9, letterSpacing: 1, color: colors.card },
});
