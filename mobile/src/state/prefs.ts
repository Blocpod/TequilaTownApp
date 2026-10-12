import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type BagItem = { productId: string; qty: number; size?: string };

type PrefsState = {
  hydrated: boolean;
  /** When the 21+ gate was passed. The birth date is kept only until the account is created. */
  agePassedAt: string | null;
  pendingBirthDate: string | null;
  /** browsing without an account (content only; account features prompt sign-in) */
  guest: boolean;
  haptics: boolean;
  seenRitualPrompt: boolean;
  bag: BagItem[];
  passAgeGate: (birthDate: string) => void;
  clearPendingBirthDate: () => void;
  setGuest: (on: boolean) => void;
  setHaptics: (on: boolean) => void;
  markRitualPromptSeen: () => void;
  addToBag: (item: BagItem, limit: number) => void;
  setBagQty: (productId: string, size: string | undefined, qty: number) => void;
  clearBag: () => void;
  resetAll: () => void;
};

const sameLine = (a: BagItem, productId: string, size?: string) => a.productId === productId && (a.size ?? '') === (size ?? '');

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      hydrated: false,
      agePassedAt: null,
      pendingBirthDate: null,
      guest: false,
      haptics: true,
      seenRitualPrompt: false,
      bag: [],
      passAgeGate: (birthDate) => set({ agePassedAt: new Date().toISOString(), pendingBirthDate: birthDate }),
      clearPendingBirthDate: () => set({ pendingBirthDate: null }),
      setGuest: (guest) => set({ guest }),
      setHaptics: (haptics) => set({ haptics }),
      markRitualPromptSeen: () => set({ seenRitualPrompt: true }),
      addToBag: (item, limit) =>
        set((s) => {
          const existing = s.bag.find((b) => sameLine(b, item.productId, item.size));
          if (existing) {
            return { bag: s.bag.map((b) => (b === existing ? { ...b, qty: Math.min(limit, b.qty + item.qty) } : b)) };
          }
          return { bag: [...s.bag, { ...item, qty: Math.min(limit, item.qty) }] };
        }),
      setBagQty: (productId, size, qty) =>
        set((s) => ({
          bag: qty <= 0 ? s.bag.filter((b) => !sameLine(b, productId, size)) : s.bag.map((b) => (sameLine(b, productId, size) ? { ...b, qty } : b)),
        })),
      clearBag: () => set({ bag: [] }),
      resetAll: () => set({ bag: [], seenRitualPrompt: false }),
    }),
    {
      name: 'tt.prefs.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _h, ...rest }) => rest,
      onRehydrateStorage: () => () => usePrefs.setState({ hydrated: true }),
    },
  ),
);
