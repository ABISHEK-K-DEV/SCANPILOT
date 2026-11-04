import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { fontForWeight, type TypographyVariant, useAppTheme } from '@/theme';

type Tone = 'default' | 'muted' | 'subtle' | 'primary' | 'danger' | 'success' | 'warning' | 'onPrimary' | 'onInk';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export function AppText({ variant = 'body', tone = 'default', color, align, style, ...rest }: AppTextProps) {
  const { colors, typography } = useAppTheme();
  const toneColor: Record<Tone, string> = {
    default: colors.text,
    muted: colors.textMuted,
    subtle: colors.textSubtle,
    primary: colors.primary,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
    onPrimary: colors.onPrimary,
    onInk: colors.onInk,
  };
  const role = variant === 'display' || variant === 'title' || variant === 'heading' ? 'header' : undefined;
  // Custom fonts carry their weight in the family name; translate any
  // fontWeight override into the matching Inter face (Android ignores weights).
  const override = StyleSheet.flatten(style) as TextStyle | undefined;
  const weightFix: TextStyle | null =
    override?.fontWeight && !override.fontFamily && variant !== 'mono'
      ? { fontFamily: fontForWeight(override.fontWeight), fontWeight: Platform.OS === 'web' ? override.fontWeight : 'normal' }
      : null;
  return (
    <Text
      accessibilityRole={role}
      maxFontSizeMultiplier={1.6}
      style={[typography[variant], { color: color ?? toneColor[tone], textAlign: align }, style, weightFix]}
      {...rest}
    />
  );
}
