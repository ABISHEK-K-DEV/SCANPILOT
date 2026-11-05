import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { MIN_TOUCH, useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/**
 * - primary:   solid accent — one per screen, for the main action
 * - secondary: outlined surface
 * - tonal:     soft accent fill for supporting actions
 * - ghost:     text-only
 * - danger:    soft red for destructive actions
 * - onPrimary: translucent white for use on dark/accent surfaces
 */
type Variant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'onPrimary';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  /** Icon after the label (e.g. an arrow on "Continue"). */
  trailingIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  trailingIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  compact = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors, radius, spacing } = useAppTheme();
  const palette: Record<Variant, { bg: string; pressed: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary },
    secondary: { bg: colors.surface, pressed: colors.surfacePressed, fg: colors.text, border: colors.borderStrong },
    tonal: { bg: colors.primarySoft, pressed: colors.surfacePressed, fg: colors.primary },
    ghost: { bg: 'transparent', pressed: colors.surfacePressed, fg: colors.primary },
    danger: { bg: colors.dangerSoft, pressed: colors.surfacePressed, fg: colors.danger },
    onPrimary: { bg: 'rgba(255,255,255,0.12)', pressed: 'rgba(255,255,255,0.22)', fg: '#FFFFFF', border: 'rgba(255,255,255,0.16)' },
  };
  const tone = palette[variant];
  const inactive = disabled || loading;
  const iconSize = compact ? 17 : 19;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: compact ? 40 : MIN_TOUCH + 4,
          paddingHorizontal: compact ? spacing.md + 2 : spacing.xl - 4,
          borderRadius: compact ? radius.md - 2 : radius.md + 2,
          backgroundColor: pressed ? tone.pressed : tone.bg,
          borderColor: tone.border ?? 'transparent',
          borderWidth: tone.border ? 1 : 0,
          opacity: disabled ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
          transform: [{ scale: pressed && !inactive ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={tone.fg} size="small" />
        ) : icon ? (
          <Icon name={icon} size={iconSize} color={tone.fg} />
        ) : null}
        <AppText variant="bodyStrong" color={tone.fg} numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.label, compact ? styles.compactLabel : undefined]}>
          {label}
        </AppText>
        {trailingIcon && !loading ? <Icon name={trailingIcon} size={iconSize} color={tone.fg} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  label: { flexShrink: 1 },
  compactLabel: { fontSize: 14 },
});
