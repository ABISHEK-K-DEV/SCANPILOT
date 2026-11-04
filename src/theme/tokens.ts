import { Platform } from 'react-native';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfacePressed: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  overlay: string;
  thumbnailBackground: string;
  tabBar: string;
}

/** Light: clean neutral background, deep navy type, ScanPilot blue accent. */
export const lightPalette: Palette = {
  background: '#F5F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF1F8',
  surfacePressed: '#E3E9F4',
  border: '#DFE5EF',
  text: '#0B1B3F',
  textMuted: '#4F5E7B',
  textSubtle: '#7A879F',
  primary: '#2D5BFF',
  primaryPressed: '#1F45D6',
  primarySoft: '#E5ECFF',
  onPrimary: '#FFFFFF',
  danger: '#C8312F',
  dangerSoft: '#FCEBEA',
  success: '#167A4D',
  successSoft: '#E3F5EC',
  warning: '#9A6400',
  warningSoft: '#FFF3DA',
  overlay: 'rgba(11, 27, 63, 0.45)',
  thumbnailBackground: '#E9EEF6',
  tabBar: '#FFFFFF',
};

export const darkPalette: Palette = {
  background: '#0A1120',
  surface: '#121B2E',
  surfaceAlt: '#1A2540',
  surfacePressed: '#22304F',
  border: '#24314D',
  text: '#E9EEF9',
  textMuted: '#A3B1CB',
  textSubtle: '#7D8BA6',
  primary: '#6B8EFF',
  primaryPressed: '#5577F0',
  primarySoft: '#1C2C57',
  onPrimary: '#06102A',
  danger: '#FF7A75',
  dangerSoft: '#3A1A1C',
  success: '#4FD49A',
  successSoft: '#123326',
  warning: '#F2B84B',
  warningSoft: '#3A2B0C',
  overlay: 'rgba(0, 0, 0, 0.6)',
  thumbnailBackground: '#1A2540',
  tabBar: '#0F1729',
};

/** Category accents for tool icons: vivid on light, slightly lifted on dark. */
export const toolAccents: Record<'create' | 'organise' | 'optimise' | 'edit' | 'convert' | 'security', { light: [string, string]; dark: [string, string] }> = {
  create: { light: ['#2D5BFF', '#E6ECFF'], dark: ['#7D9BFF', '#1C2C57'] },
  organise: { light: ['#7A3FF2', '#F0E8FF'], dark: ['#B08CFF', '#2E2152'] },
  edit: { light: ['#E0457B', '#FDE7EF'], dark: ['#FF86AE', '#4A1C2D'] },
  convert: { light: ['#0E9F8A', '#DDF6F1'], dark: ['#4FD8C2', '#0F3A34'] },
  optimise: { light: ['#E57A00', '#FFF0DC'], dark: ['#FFB15C', '#43290B'] },
  security: { light: ['#2F8A3E', '#E2F4E5'], dark: ['#6FD884', '#163A1D'] },
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

const fontFamily = Platform.select({ ios: 'System', default: undefined });

export const typography = {
  display: { fontFamily, fontSize: 30, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontFamily, fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontFamily, fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontFamily, fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyStrong: { fontFamily, fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  caption: { fontFamily, fontSize: 13, lineHeight: 17, fontWeight: '400' as const },
  label: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.3 },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Minimum touch target (Android Material + Apple HIG guidance). */
export const MIN_TOUCH = 48;
