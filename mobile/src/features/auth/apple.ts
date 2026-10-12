import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { api, ApiError } from '@/lib/api';
import { usePrefs } from '@/state/prefs';
import { useSession } from '@/state/session';

export function useAppleAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);
  return available;
}

/**
 * Native Sign in with Apple → server verifies the identity token.
 * Resolves false if the guest cancelled the Apple sheet.
 */
export async function signInWithApple(): Promise<boolean> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw new ApiError('Apple sign-in failed. Please try again.', 0, 'SERVER_ERROR');
  }
  if (!credential.identityToken) throw new ApiError('Apple did not return an identity token.', 0, 'SERVER_ERROR');
  const birthDate = usePrefs.getState().pendingBirthDate ?? '';
  try {
    const session = await api.apple({
      identityToken: credential.identityToken,
      fullName: credential.fullName ? { givenName: credential.fullName.givenName, familyName: credential.fullName.familyName } : null,
      birthDate,
    });
    useSession.getState().setSession(session);
    usePrefs.getState().clearPendingBirthDate();
    return true;
  } catch (e) {
    // A brand-new account needs the birth date from the age gate; ask again if we no longer hold it.
    if (e instanceof ApiError && (e.code === 'UNDERAGE' || e.code === 'BAD_REQUEST') && !birthDate) {
      usePrefs.setState({ agePassedAt: null });
    }
    throw e;
  }
}
