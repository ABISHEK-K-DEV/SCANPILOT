import type { SortOption, ViewMode } from './document';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: ThemePreference;
  onboardingComplete: boolean;
  viewMode: ViewMode;
  sort: SortOption;
  /** Require fingerprint/face/PIN when opening the app. */
  appLock: boolean;
  /** 'google' = ML Kit scanner (Play services), 'camera' = ScanPilot's own camera. */
  scanner: 'google' | 'camera';
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  onboardingComplete: false,
  viewMode: 'grid',
  sort: { field: 'date', direction: 'desc' },
  appLock: false,
  scanner: 'google',
};
