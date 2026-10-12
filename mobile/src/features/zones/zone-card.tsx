import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { Experience } from '@shared/content/experiences';
import { sponsorById } from '@shared/content/sponsors';

import { PressCard } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { artFor } from '@/theme/art';
import { colors, fonts } from '@/theme/tokens';

/** Zone number medallion. */
export function ZoneBadge({ zone, color = colors.terracotta, size = 34 }: { zone: number; color?: string; size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.badgeText, { fontSize: size * 0.48 }]}>{zone}</Text>
    </View>
  );
}

type Props = { zone: Experience; width: number; stamped?: boolean; animated?: boolean };

/** Portrait zone card; plays the collage animation when the zone has one. */
export function ZoneCard({ zone, width, stamped, animated = true }: Props) {
  const sponsor = zone.sponsorId ? sponsorById(zone.sponsorId) : undefined;
  const key = animated && zone.motion ? zone.motion : zone.image;
  const img = artFor(key);
  return (
    <PressCard
      onPress={() => router.push({ pathname: '/zone/[id]', params: { id: zone.id } })}
      accessibilityLabel={`Zone ${zone.zone}, ${zone.name}. ${zone.subtitle}`}
      style={{ width }}
      contentStyle={{ backgroundColor: colors.card }}
    >
      <View style={{ height: width * 0.78 }}>
        <Image source={img.source} placeholder={img.blurhash ? { blurhash: img.blurhash } : undefined} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        <View style={styles.badgePos}>
          <ZoneBadge zone={zone.zone} color={zone.accent} />
        </View>
        {stamped ? (
          <View style={styles.stamped}>
            <Check size={14} color={colors.card} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {zone.name.toUpperCase()}
        </Text>
        <Text variant="lede" numberOfLines={1} style={{ fontSize: 14, lineHeight: 19 }}>
          {zone.subtitle}
        </Text>
        {sponsor ? (
          <Text variant="label" numberOfLines={1} style={{ marginTop: 6, fontSize: 9.5 }}>
            Presented by {sponsor.name}
          </Text>
        ) : null}
      </View>
    </PressCard>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.display, color: colors.card, marginTop: 2 },
  badgePos: { position: 'absolute', top: 10, left: 10 },
  stamped: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.agave,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 12, borderTopWidth: 1.5, borderColor: colors.ink, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 17, lineHeight: 19, letterSpacing: 0.8, color: colors.ink, marginTop: 2 },
});
