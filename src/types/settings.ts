import type { SortOption, ViewMode } from './document';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: ThemePreference;
  onboardingComplete: boolean;
  viewMode: ViewMode;
  sort: SortOption;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  onboardingComplete: false,
  viewMode: 'grid',
  sort: { field: 'date', direction: 'desc' },
};
