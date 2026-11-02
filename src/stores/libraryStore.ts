import { create } from 'zustand';

/**
 * A revision counter that is bumped after every library mutation. Screens
 * subscribe to it and re-query SQLite, which keeps the database the single
 * source of truth instead of duplicating rows in memory.
 */
interface LibraryState {
  revision: number;
  bump: () => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  revision: 0,
  bump: () => set((state) => ({ revision: state.revision + 1 })),
}));

export function notifyLibraryChanged(): void {
  useLibraryStore.getState().bump();
}
