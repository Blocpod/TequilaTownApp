import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { missionById } from '@shared/content/missions';

import { SignInGate } from '@/components/sign-in-gate';
import { AgaveLoader } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { api, errorMessage, isApiError } from '@/lib/api';
import { useSetProgress } from '@/lib/queries';
import { useIsSignedIn } from '@/state/session';
import { gutter } from '@/theme/tokens';

/**
 * Deep link target for `tequilatown://scan/<CODE>` — what the printed venue QR's web page opens
 * when a guest scans it with the phone's own camera instead of the in-app scanner.
 */
export default function ScanLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const signedIn = useIsSignedIn();
  const setProgress = useSetProgress();
  const started = useRef(false);

  useEffect(() => {
    if (!signedIn || !code || started.current) return;
    started.current = true;
    (async () => {
      try {
        const result = await api.scan(code);
        if (result.kind === 'mission_step') {
          setProgress(result.progress);
          const m = missionById(result.missionId);
          toast.reward('Step complete', m?.steps.find((s) => s.id === result.stepId)?.title ?? m?.name);
          router.replace({ pathname: '/mission/[id]', params: { id: result.missionId } });
        } else if (result.kind === 'ticket') {
          router.replace({ pathname: '/ticket', params: { code: result.code } });
        } else {
          toast.error('Unknown code', "That link isn't part of Tequila Town.");
          router.replace('/');
        }
      } catch (e) {
        toast.error(isApiError(e) && e.code === 'LOCKED' ? 'Mission locked' : 'Could not open that code', isApiError(e) && e.code === 'LOCKED' ? 'Complete the required missions first.' : errorMessage(e));
        router.replace('/');
      }
    })();
  }, [signedIn, code, setProgress]);

  return (
    <View style={styles.backdrop}>
      {signedIn ? (
        <AgaveLoader label="Reading the code…" />
      ) : (
        <SignInGate message="Sign in to collect this mission step with your passport." style={{ alignSelf: 'stretch' }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: gutter, backgroundColor: 'rgba(243,233,210,0.97)' },
});
