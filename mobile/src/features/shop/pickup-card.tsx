import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { Order } from '@shared/api';

import { PrintCard } from '@/components/ui/card';
import { Tag } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { colors, fonts, radii } from '@/theme/tokens';

const statusLook = {
  reserved: { label: 'Ready for pickup', color: colors.sun },
  picked_up: { label: 'Picked up', color: colors.agaveMist },
  cancelled: { label: 'Cancelled', color: colors.paperDeep },
} as const;

/** Reservation with its pickup code + QR for the Mercado counter. */
export function PickupCard({ order, showQr = true }: { order: Order; showQr?: boolean }) {
  const look = statusLook[order.status];
  const live = order.status === 'reserved';
  return (
    <PrintCard background={live ? colors.cardWarm : colors.card} shadowColor={live ? colors.terracotta : colors.ink} contentStyle={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text variant="label">Pickup code</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.code, !live && { color: colors.inkMuted, textDecorationLine: order.status === 'cancelled' ? 'line-through' : 'none' }]}>{order.pickupCode}</Text>
          <Text variant="small">{new Date(order.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
        </View>
        <Tag label={look.label} color={look.color} />
      </View>
      {live && showQr ? (
        <View style={styles.qr} accessible accessibilityLabel={`Pickup QR for code ${order.pickupCode}`}>
          <QRCode value={`TQT-PICKUP:${order.pickupCode}`} size={150} color={colors.ink} backgroundColor={colors.card} />
        </View>
      ) : null}
      <View style={styles.items}>
        {order.items.map((it, i) => (
          <View key={i} style={styles.item}>
            <Text variant="body" color={colors.ink} style={{ flex: 1 }}>
              {it.qty} × {it.name}
              {it.size ? ` (${it.size})` : ''}
            </Text>
            <Text variant="bodyStrong">${(it.price * it.qty).toLocaleString()}</Text>
          </View>
        ))}
        <View style={[styles.item, styles.total]}>
          <Text variant="bodyStrong">Due at pickup</Text>
          <Text style={styles.totalNum}>${order.total.toLocaleString()}</Text>
        </View>
      </View>
    </PrintCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  code: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: 2, color: colors.terracotta, marginTop: 2 },
  qr: { alignSelf: 'center', padding: 12, backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.ink },
  items: { gap: 6, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.inkFaint, paddingTop: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  total: { borderTopWidth: 1, borderColor: colors.inkFaint, paddingTop: 8, marginTop: 4 },
  totalNum: { fontFamily: fonts.serifBlack, fontSize: 20, color: colors.ink },
});
