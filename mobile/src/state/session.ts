import type { Session, User } from '@shared/api';
import { create } from 'zustand';

import { api, configureAuth } from '@/lib/api';
import { secureStorage } from '@/lib/secure';
import { usePrefs } from '@/state/prefs';

const SESSION_KEY = 'tt.session.v1';

type SessionState = {
  hydrated: boolean;
  session: Session | null;
  hydrate: () => Promise<void>;
  setSession: (s: Session) => void;
  setUser: (u: User) => void;
  signOut: () => Promise<void>;
  /** Local-only sign-out (session already invalid server-side, e.g. after account deletion). */
  clear: () => void;
};

const persist = (s: Session | null) => {
  void (s ? secureStorage.set(SESSION_KEY, JSON.stringify(s)) : secureStorage.remove(SESSION_KEY));
};

export const useSession = create<SessionState>((set, get) => ({
  hydrated: false,
  session: null,
  hydrate: async () => {
    try {
      const raw = await secureStorage.get(SESSION_KEY);
      set({ session: raw ? (JSON.parse(raw) as Session) : null, hydrated: true });
    } catch {
      set({ session: null, hydrated: true });
    }
  },
  setSession: (session) => {
    persist(session);
    usePrefs.getState().setGuest(false);
    set({ session });
  },
  setUser: (user) => {
    const s = get().session;
    if (!s) return;
    const next = { ...s, user };
    persist(next);
    set({ session: next });
  },
  signOut: async () => {
    const s = get().session;
    get().clear();
    if (s) await api.logout(s.refreshToken).catch(() => undefined);
  },
  clear: () => {
    persist(null);
    usePrefs.getState().setGuest(false);
    set({ session: null });
  },
}));

configureAuth({
  getSession: () => useSession.getState().session,
  onSession: (s) => useSession.getState().setSession(s),
  onSignedOut: () => useSession.getState().clear(),
});

export const useIsSignedIn = () => useSession((s) => !!s.session);
export const useUser = () => useSession((s) => s.session?.user ?? null);
