import { create } from 'zustand';

/** Which tool guide ("How it works") is open, if any. */
interface GuideState {
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
}

export const useGuideStore = create<GuideState>((set) => ({
  openId: null,
  open: (id) => set({ openId: id }),
  close: () => set({ openId: null }),
}));
