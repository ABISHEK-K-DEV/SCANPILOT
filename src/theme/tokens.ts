import { Platform } from 'react-native';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfacePressed: string;
  /** Elevated surfaces on top of `surface` (sheets, dialogs in dark mode). */
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  /** High-contrast ink surface used for hero cards (dark in both themes). */
  ink: string;
  inkSoft: string;
  onInk: string;
  onInkMuted: string;
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

/**
 * Light: soft neutral canvas, slate ink type, a single indigo accent.
 * Colour is used sparingly — for the primary action and state — so the
 * documents themselves stay the most prominent thing on screen.
 */
export const lightPalette: Palette = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F6',
  surfacePressed: '#E9ECF1',
  surfaceRaised: '#FFFFFF',
  border: '#E5E8ED',
  borderStrong: '#D3D8E0',
  text: '#0F172A',
  textMuted: '#475569',
  textSubtle: '#8A94A6',
  primary: '#4F46E5',
  primaryPressed: '#4338CA',
  primarySoft: '#EEF0FF',
  onPrimary: '#FFFFFF',
  ink: '#111827',
  inkSoft: '#1F2937',
  onInk: '#FFFFFF',
  onInkMuted: '#A5AEBD',
  danger: '#DC2626',
  dangerSoft: '#FEF1F1',
  success: '#059669',
  successSoft: '#E8F8F1',
  warning: '#B45309',
  warningSoft: '#FEF5E7',
  overlay: 'rgba(15, 23, 42, 0.48)',
  thumbnailBackground: '#EEF1F5',
  tabBar: '#FFFFFF',
};

export const darkPalette: Palette = {
  background: '#0B0D12',
  surface: '#14171E',
  surfaceAlt: '#1B1F28',
  surfacePressed: '#232835',
  surfaceRaised: '#1A1E27',
  border: '#252A35',
  borderStrong: '#323847',
  text: '#F1F3F7',
  textMuted: '#A7AFBE',
  textSubtle: '#6F7889',
  primary: '#8B8DFF',
  primaryPressed: '#7577F5',
  primarySoft: '#1E1F3F',
  onPrimary: '#0B0D12',
  ink: '#1A1E27',
  inkSoft: '#242936',
  onInk: '#F1F3F7',
  onInkMuted: '#8E97A8',
  danger: '#F87171',
  dangerSoft: '#2B1416',
  success: '#34D399',
  successSoft: '#0F2A21',
  warning: '#FBBF24',
  warningSoft: '#2C220C',
  overlay: 'rgba(0, 0, 0, 0.62)',
  thumbnailBackground: '#1B1F28',
  tabBar: '#101318',
};

/**
 * Category accents for tool icons: restrained, mid-saturation hues that sit
 * well next to each other on a neutral tile. [icon colour, tile tint]
 */
export const toolAccents: Record<'create' | 'organise' | 'optimise' | 'edit' | 'convert' | 'security', { light: [string, string]; dark: [string, string] }> = {
  create: { light: ['#4F46E5', '#EEF0FF'], dark: ['#A5A7FF', '#1E1F3F'] },
  organise: { light: ['#0F766E', '#E8F6F4'], dark: ['#5EEAD4', '#0E2926'] },
  edit: { light: ['#BE185D', '#FCEEF4'], dark: ['#F9A8D4', '#2E1422'] },
  convert: { light: ['#0369A1', '#E8F4FB'], dark: ['#7DD3FC', '#0D2533'] },
  optimise: { light: ['#B45309', '#FEF5E7'], dark: ['#FCD34D', '#2C220C'] },
  security: { light: ['#047857', '#E8F8F1'], dark: ['#6EE7B7', '#0F2A21'] },
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
  xl: 24,
  pill: 999,
} as const;

/**
 * Inter, loaded in the root layout. Each weight is its own family on Android,
 * so text never relies on synthesised bold.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Picks the Inter family for a numeric/keyword font weight. */
export function fontForWeight(weight: string | number | undefined): string {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : Number(weight);
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.regular;
}

// fontWeight stays 'normal' on native: the weight is carried by the family.
const weight = (w: '400' | '500' | '600' | '700') => (Platform.OS === 'web' ? w : ('normal' as const));

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, fontWeight: weight('700'), letterSpacing: -0.6 },
  title: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 27, fontWeight: weight('700'), letterSpacing: -0.4 },
  heading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, fontWeight: weight('600'), letterSpacing: -0.15 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, fontWeight: weight('400'), letterSpacing: -0.1 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, fontWeight: weight('600'), letterSpacing: -0.1 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, fontWeight: weight('400'), letterSpacing: 0 },
  label: { fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 16, fontWeight: weight('600'), letterSpacing: 0.4 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 12.5, lineHeight: 19, fontWeight: '400' as const, letterSpacing: 0 },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Soft, layered elevation used for cards in light mode (none in dark mode). */
export const elevation = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} as const;

/** Minimum touch target (Android Material + Apple HIG guidance). */
export const MIN_TOUCH = 48;
