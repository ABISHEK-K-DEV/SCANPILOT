import { Pressable, StyleSheet } from 'react-native';

import { useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: IconName;
  onPress: () => void;
  accessibilityLabel?: string;
}

export function Chip({ label, selected = false, icon, onPress, accessibilityLabel }: ChipProps) {
  const { colors, radius, spacing } = useAppTheme();
  const fg = selected ? colors.onPrimary : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          gap: spacing.xs,
          backgroundColor: selected ? colors.primary : pressed ? colors.surfacePressed : colors.surface,
          borderColor: selected ? colors.primary : colors.borderStrong,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <AppText variant="caption" color={fg} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', minHeight: 36, borderWidth: 1 },
  label: { fontWeight: '600' },
});
