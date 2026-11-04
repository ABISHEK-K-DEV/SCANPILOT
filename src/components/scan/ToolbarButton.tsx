import { Pressable, StyleSheet, View } from 'react-native';

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
  const tile = destructive ? colors.dangerSoft : colors.surfaceAlt;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { borderRadius: radius.md, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.tile, { backgroundColor: tile, borderRadius: radius.md }]}>
        <Icon name={icon} size={20} color={destructive ? colors.danger : colors.textMuted} />
      </View>
      <AppText variant="caption" color={destructive ? colors.danger : colors.textMuted} numberOfLines={1} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, minHeight: MIN_TOUCH + 12, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 2, paddingVertical: 4 },
  tile: { width: 42, height: 36, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '500' },
});
