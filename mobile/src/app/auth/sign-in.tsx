import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { signInWithApple, useAppleAvailable } from '@/features/auth/apple';
import { AuthShell } from '@/features/auth/auth-shell';
import { api, errorMessage, isApiError } from '@/lib/api';
import { usePublicConfig } from '@/lib/queries';
import { useSession } from '@/state/session';
import { colors, fonts } from '@/theme/tokens';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const appleAvailable = useAppleAvailable();
  const { data: config } = usePublicConfig();

  const submit = async () => {
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    setError(null);
    try {
      const session = await api.login({ email: email.trim().toLowerCase(), password });
      useSession.getState().setSession(session);
      toast.success(`¡Hola de nuevo, ${session.user.name.split(' ')[0]}!`);
    } catch (e) {
      setError(isApiError(e) && e.code === 'INVALID_CREDENTIALS' ? 'That email and password don’t match.' : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const apple = async () => {
    try {
      await signInWithApple();
    } catch (e) {
      toast.error('Sign in failed', errorMessage(e));
    }
  };

  return (
    <AuthShell kicker="De nuevo" title="Welcome back">
      <TextField
        label="Email"
        icon={Mail}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="you@example.com"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        icon={Lock}
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={error}
        placeholder="••••••••"
      />
      {config?.passwordReset ? (
        <Text variant="small" style={styles.forgot} onPress={() => router.push('/auth/forgot')} accessibilityRole="link">
          Forgot password?
        </Text>
      ) : null}
      <Button label="Sign in" onPress={submit} loading={busy} full />
      {appleAvailable ? (
        <>
          <View style={styles.or}>
            <View style={styles.rule} />
            <Text variant="label">or</Text>
            <View style={styles.rule} />
          </View>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={29}
            style={{ height: 54, width: '100%' }}
            onPress={apple}
          />
        </>
      ) : null}
      <Text variant="small" align="center">
        New to Tequila Town?{' '}
        <Text variant="small" color={colors.terracotta} style={{ fontFamily: fonts.sansBold }} onPress={() => router.replace('/auth/sign-up')}>
          Create a passport
        </Text>
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', color: colors.terracotta, fontFamily: fonts.sansSemiBold, marginTop: -6 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { flex: 1, height: 1.2, backgroundColor: colors.inkFaint },
});
