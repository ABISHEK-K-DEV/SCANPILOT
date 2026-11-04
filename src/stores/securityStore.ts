import { create } from 'zustand';

/** Session-only security state (never persisted). */
interface SecurityState {
  /** True while the app lock screen must be shown. */
  locked: boolean;
  /** Locked folders opened during this session. Cleared when the app is locked again. */
  unlockedFolders: Set<string>;
  lock: () => void;
  unlock: () => void;
  unlockFolder: (id: string) => void;
}

export const useSecurityStore = create<SecurityState>((set) => ({
  locked: false,
  unlockedFolders: new Set(),
  lock: () => set({ locked: true, unlockedFolders: new Set() }),
  unlock: () => set({ locked: false }),
  unlockFolder: (id) => set((s) => ({ unlockedFolders: new Set(s.unlockedFolders).add(id) })),
}));
