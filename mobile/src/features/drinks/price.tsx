import { StyleSheet } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

/** $$$·· price level out of five. */
export function Price({ level }: { level: number }) {
  return (
    <Text style={styles.price} accessibilityLabel={`Price level ${level} of 5`}>
      <Text style={{ color: colors.ink }}>{'$'.repeat(level)}</Text>
      <Text style={{ color: colors.inkFaint }}>{'$'.repeat(5 - level)}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  price: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 0.5, marginLeft: 4 },
});
