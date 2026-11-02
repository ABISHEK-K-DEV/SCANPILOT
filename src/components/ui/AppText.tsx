import { Text, type TextProps } from 'react-native';

import { type TypographyVariant, useAppTheme } from '@/theme';

type Tone = 'default' | 'muted' | 'subtle' | 'primary' | 'danger' | 'success' | 'onPrimary';

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
    onPrimary: colors.onPrimary,
  };
  const role = variant === 'display' || variant === 'title' || variant === 'heading' ? 'header' : undefined;
  return (
    <Text
      accessibilityRole={role}
      maxFontSizeMultiplier={1.6}
      style={[typography[variant], { color: color ?? toneColor[tone], textAlign: align }, style]}
      {...rest}
    />
  );
}
