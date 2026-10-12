import { router } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from './ui/button';
import { PrintCard } from './ui/card';
import { Text } from './ui/text';
import { colors } from '@/theme/tokens';

type Props = { title?: string; message: string; night?: boolean; style?: StyleProp<ViewStyle> };

/** Shown to "just browsing" guests where an account is needed. */
export function SignInGate({ title = 'Passport required', message, night, style }: Props) {
  return (
    <PrintCard
      background={night ? colors.nightCard : colors.blush}
      shadowColor={night ? colors.terracotta : colors.ink}
      borderColor={night ? colors.nightLine : colors.ink}
      contentStyle={styles.pad}
      style={style}
    >
      <Text variant="title" color={night ? colors.paper : colors.ink}>
        {title.toUpperCase()}
      </Text>
      <Text variant="body" color={night ? 'rgba(243,233,210,0.8)' : colors.inkSoft}>
        {message}
      </Text>
      <View style={styles.row}>
        <Button label="Create passport" size="md" onPress={() => router.push('/auth/sign-up')} />
        <Button label="Sign in" size="md" variant={night ? 'blush' : 'secondary'} onPress={() => router.push('/auth/sign-in')} />
      </View>
    </PrintCard>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 18, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
});
