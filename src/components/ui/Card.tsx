import type { ReactNode } from 'react';
import { type AccessibilityRole, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  disabled?: boolean;
}

export function Card({
  children,
  onPress,
  onLongPress,
  style,
  padded = true,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  disabled,
}: CardProps) {
  const { colors, radius, spacing, dark } = useAppTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    padding: padded ? spacing.lg : 0,
    ...(dark ? null : styles.shadow),
  };
  if (!onPress && !onLongPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [base, pressed && { backgroundColor: colors.surfacePressed }, disabled && { opacity: 0.55 }, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#0B1B3F',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
});
