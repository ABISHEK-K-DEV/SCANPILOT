import { Pressable, StyleSheet } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui';
import { MIN_TOUCH, useAppTheme } from '@/theme';

interface ToolbarButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export function ToolbarButton({ icon, label, onPress, disabled, destructive }: ToolbarButtonProps) {
  const { colors, radius } = useAppTheme();
  const color = destructive ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { borderRadius: radius.md, backgroundColor: pressed ? colors.surfacePressed : 'transparent', opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Icon name={icon} size={22} color={color} />
      <AppText variant="caption" color={color} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, minHeight: MIN_TOUCH + 12, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
});
