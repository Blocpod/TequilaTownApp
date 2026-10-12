import type { MeResponse } from '@shared/api';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { toast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { qk, useMe } from '@/lib/queries';
import { useIsSignedIn } from '@/state/session';

/** Saved tequilas, synced to the passport with optimistic updates. */
export function useBookmarks() {
  const signedIn = useIsSignedIn();
  const { data } = useMe();
  const qc = useQueryClient();
  const ids = data?.progress.bookmarks ?? [];

  const toggle = async (drinkId: string) => {
    if (!signedIn) {
      toast.info('Save tequilas to your passport', 'Create a free account to keep a list.');
      router.push('/auth/sign-up');
      return;
    }
    const prev = qc.getQueryData<MeResponse>(qk.me);
    if (!prev) return;
    const has = prev.progress.bookmarks.includes(drinkId);
    const next = has ? prev.progress.bookmarks.filter((b) => b !== drinkId) : [...prev.progress.bookmarks, drinkId];
    haptic.press();
    qc.setQueryData<MeResponse>(qk.me, { ...prev, progress: { ...prev.progress, bookmarks: next } });
    try {
      qc.setQueryData(qk.me, await api.updateMe({ bookmarks: next }));
      if (!has) toast.success('Saved to your passport');
    } catch (e) {
      qc.setQueryData(qk.me, prev);
      toast.error('Could not save', errorMessage(e));
    }
  };

  return { ids, has: (id: string) => ids.includes(id), toggle };
}
