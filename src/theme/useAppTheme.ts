import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/stores/settingsStore';

import { darkPalette, lightPalette, type Palette, radius, spacing, typography } from './tokens';

export interface AppTheme {
  dark: boolean;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

const LIGHT: AppTheme = { dark: false, colors: lightPalette, spacing, radius, typography };
const DARK: AppTheme = { dark: true, colors: darkPalette, spacing, radius, typography };

export function useAppTheme(): AppTheme {
  const system = useColorScheme();
  const preference = useSettingsStore((state) => state.settings.theme);
  const dark = preference === 'dark' || (preference === 'system' && system === 'dark');
  return dark ? DARK : LIGHT;
}
