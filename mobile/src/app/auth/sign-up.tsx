import { router } from 'expo-router';
import { Lock, Mail, User } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';

import { festival } from '@shared/content/festival';

import { BirthDatePicker, partsToDate, todayParts } from '@/components/birth-date-picker';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { AuthShell } from '@/features/auth/auth-shell';
import { ageOn, toIsoDate } from '@/lib/age';
import { api, errorMessage, isApiError } from '@/lib/api';
import { usePrefs } from '@/state/prefs';
import { useSession } from '@/state/session';
import { colors } from '@/theme/tokens';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; dob?: string }>({});
  // The age gate's birth date is kept only until an account exists; a second account on this
  // device confirms it here instead of bouncing back to the gate.
  const pendingBirthDate = usePrefs((s) => s.pendingBirthDate);
  const [dob, setDob] = useState(todayParts);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'What should we call you?';
    if (!EMAIL.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    if (!pendingBirthDate && ageOn(partsToDate(dob)) < festival.ageMinimum) next.dob = `Tequila Town is for guests ${festival.ageMinimum} and over.`;
    setErrors(next);
    if (Object.keys(next).length) return;

    const birthDate = pendingBirthDate ?? toIsoDate(partsToDate(dob));
    setBusy(true);
    try {
      const session = await api.signup({ name: name.trim(), email: email.trim().toLowerCase(), password, birthDate });
      useSession.getState().setSession(session);
      usePrefs.getState().clearPendingBirthDate();
      toast.reward(`¡Bienvenido, ${session.user.name.split(' ')[0]}!`, 'Your passport is ready.');
    } catch (e) {
      if (isApiError(e) && e.code === 'EMAIL_TAKEN') setErrors({ email: 'That email already has a passport. Try signing in.' });
      else toast.error('Could not create your account', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell kicker="Bienvenido" title="Your passport" subtitle="Create an account to collect stamps, claim your ticket and talk to the Oracle.">
      <TextField
        label="Name"
        icon={User}
        value={name}
        onChangeText={setName}
        error={errors.name}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        placeholder="Your name"
      />
      <TextField
        ref={emailRef}
        label="Email"
        icon={Mail}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
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
        error={errors.password}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        hint="At least 8 characters."
        placeholder="Create a password"
      />
      {!pendingBirthDate ? (
        <View style={{ gap: 6 }}>
          <Text variant="label" color={colors.inkSoft}>
            Date of birth
          </Text>
          <BirthDatePicker value={dob} onChange={setDob} />
          <Text variant="small" color={errors.dob ? colors.danger : colors.inkMuted}>
            {errors.dob ?? 'Used only to confirm you are of legal drinking age. It is never stored.'}
          </Text>
        </View>
      ) : null}
      <Button label="Create passport" onPress={submit} loading={busy} full style={{ marginTop: 6 }} />
      <Text variant="small" align="center">
        Already have one?{' '}
        <Text variant="small" color={colors.terracotta} style={{ fontFamily: 'Inter_700Bold' }} onPress={() => router.replace('/auth/sign-in')}>
          Sign in
        </Text>
      </Text>
    </AuthShell>
  );
}
