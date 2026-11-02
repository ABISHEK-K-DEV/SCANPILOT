import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { MIN_TOUCH, useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
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
    secondary: { bg: colors.surface, pressed: colors.surfacePressed, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', pressed: colors.surfacePressed, fg: colors.primary },
    danger: { bg: colors.dangerSoft, pressed: colors.surfacePressed, fg: colors.danger },
  };
  const tone = palette[variant];
  const inactive = disabled || loading;
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
          minHeight: compact ? 40 : MIN_TOUCH,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          borderRadius: radius.md,
          backgroundColor: pressed ? tone.pressed : tone.bg,
          borderColor: tone.border ?? 'transparent',
          opacity: disabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={tone.fg} size="small" />
        ) : icon ? (
          <Icon name={icon} size={compact ? 18 : 20} color={tone.fg} />
        ) : null}
        <AppText variant="bodyStrong" color={tone.fg} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
