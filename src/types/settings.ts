import type { SortOption, ViewMode } from './document';

export type ThemePreference = 'system' | 'light' | 'dark';

/** `camera`: ScanPilot's own camera screen. `system`: Google ML Kit / Apple VisionKit scanner. */
export type ScannerPreference = 'camera' | 'system';

export interface AppSettings {
  theme: ThemePreference;
  onboardingComplete: boolean;
  viewMode: ViewMode;
  sort: SortOption;
  /** Require fingerprint/face/PIN when opening the app. */
  appLock: boolean;
  scanner: ScannerPreference;
  /** Camera captures by itself once the page is found and held still. */
  autoCapture: boolean;
  /** Recognise text when saving a scan: searchable, selectable PDF. */
  scanOcr: boolean;
  /** Tool guides already shown (ids from features/toolGuides). */
  seenGuides: string[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  onboardingComplete: false,
  viewMode: 'grid',
  sort: { field: 'date', direction: 'desc' },
  appLock: false,
  scanner: 'camera',
  autoCapture: true,
  scanOcr: true,
  seenGuides: [],
};
