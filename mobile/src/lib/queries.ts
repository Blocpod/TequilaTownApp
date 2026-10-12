import type { MeResponse, Progress } from '@shared/api';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useIsSignedIn, useSession } from '@/state/session';

import { api, isApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, err) => count < 2 && !(isApiError(err) && err.status >= 400 && err.status < 500),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});

// Never let one guest's cached passport flash for the next account on a shared phone.
useSession.subscribe((state, prev) => {
  if (state.session?.user.id !== prev.session?.user.id) queryClient.clear();
});

export const qk = {
  me: ['me'] as const,
  config: ['config'] as const,
  leaderboard: ['leaderboard'] as const,
  orders: ['orders'] as const,
  memories: ['memories'] as const,
};

/** Profile + progress for the signed-in guest. Keeps the session's cached user in sync. */
export function useMe() {
  const signedIn = useIsSignedIn();
  const setUser = useSession((s) => s.setUser);
  const q = useQuery({ queryKey: qk.me, queryFn: api.me, enabled: signedIn });
  const user = q.data?.user;
  useEffect(() => {
    if (user) setUser(user);
  }, [user, setUser]);
  return q;
}

export const useProgress = (): Progress | undefined => useMe().data?.progress;

/** Write a fresh progress object (returned by every mutation) into the cache. */
export function useSetProgress() {
  const qc = useQueryClient();
  return (progress: Progress) => qc.setQueryData<MeResponse>(qk.me, (old) => (old ? { ...old, progress } : old));
}

/** Store an authoritative MeResponse (returned by profile updates) and sync the session user. */
export function useSetMe() {
  const qc = useQueryClient();
  const setUser = useSession((s) => s.setUser);
  return (me: MeResponse) => {
    setUser(me.user);
    qc.setQueryData<MeResponse>(qk.me, me);
  };
}

export function usePublicConfig() {
  return useQuery({ queryKey: qk.config, queryFn: api.config, staleTime: 5 * 60_000 });
}
