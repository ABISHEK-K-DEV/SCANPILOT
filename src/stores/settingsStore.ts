import { create } from 'zustand';

import { loadSettings, saveSetting } from '@/db/settingsRepository';
import { type AppSettings, DEFAULT_SETTINGS } from '@/types/settings';

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    const settings = await loadSettings();
    set({ settings, loaded: true });
  },
  update: async (key, value) => {
    const previous = get().settings;
    set({ settings: { ...previous, [key]: value } }); // optimistic
    try {
      await saveSetting(key, value);
    } catch (error) {
      set({ settings: previous });
      throw error;
    }
  },
}));
