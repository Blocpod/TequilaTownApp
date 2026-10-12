import { router } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { X } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { ZoomableImage } from '@/components/ui/zoomable-image';
import { art } from '@/theme/art';
import { colors, fonts, gutter } from '@/theme/tokens';

/** The consumer-journey floor plan, pinch-zoomable. */
export default function VenueMap() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const map = art.mapVenue;

  useEffect(() => {
    setStatusBarStyle('light', true);
    return () => setStatusBarStyle('dark', true);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text variant="label" color={colors.blush}>
            Venue
          </Text>
          <Text style={styles.title}>FLOOR PLAN</Text>
        </View>
        <IconButton icon={X} label="Close floor plan" tone="glass" onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ZoomableImage source={map.source} width={width} height={height - insets.top - 140} aspect={map.width / map.height} accessibilityLabel="Tequila Town consumer journey floor plan with fourteen numbered stops" />
      </View>
      <Text variant="small" color="rgba(243,233,210,0.6)" align="center" style={{ paddingBottom: insets.bottom + 16 }}>
        Pinch or double-tap to zoom
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter, gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 29, letterSpacing: 1, color: colors.paper, marginTop: 2 },
});
