import { KeyRound, Lock, Mail } from 'lucide-react-native';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { AuthShell } from '@/features/auth/auth-shell';
import { api, errorMessage } from '@/lib/api';
import { useSession } from '@/state/session';

export default function Forgot() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!email.includes('@')) return setError('Enter the email on your passport.');
    setBusy(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim().toLowerCase());
      setStep('code');
      toast.info('Check your inbox', 'If that email has a passport, a 6-digit code is on its way.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code from the email.');
    if (password.length < 8) return setError('Use at least 8 characters for your new password.');
    setBusy(true);
    setError(null);
    try {
      const session = await api.resetPassword({ email: email.trim().toLowerCase(), code, password });
      useSession.getState().setSession(session);
      toast.success('Password updated', 'You’re signed in.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      leading="back"
      kicker="No pasa nada"
      title="Reset password"
      subtitle={step === 'email' ? 'We’ll email you a 6-digit code.' : `Enter the code we sent to ${email.trim()} and choose a new password.`}
    >
      {step === 'email' ? (
        <>
          <TextField label="Email" icon={Mail} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={error} returnKeyType="send" onSubmitEditing={send} />
          <Button label="Send code" onPress={send} loading={busy} full />
        </>
      ) : (
        <>
          <TextField label="Code" icon={KeyRound} value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="123456" />
          <TextField label="New password" icon={Lock} value={password} onChangeText={setPassword} secure autoComplete="new-password" textContentType="newPassword" error={error} returnKeyType="go" onSubmitEditing={reset} />
          <Button label="Update password" onPress={reset} loading={busy} full />
          <Button label="Send a new code" variant="ghost" size="sm" onPress={send} style={{ alignSelf: 'center' }} />
        </>
      )}
    </AuthShell>
  );
}
