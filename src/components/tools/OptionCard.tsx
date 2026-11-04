import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui';
import { useAppTheme } from '@/theme';

interface OptionCardProps {
  icon: IconName;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  trailing?: ReactNode;
}

/** Radio-style option used by Split and Compress. */
export function OptionCard({ icon, title, description, selected, onPress, trailing }: OptionCardProps) {
  const { colors, radius, spacing } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${description}`}
      style={({ pressed }) => [
        styles.card,
        {
          padding: spacing.md,
          gap: spacing.md,
          borderRadius: radius.lg,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfacePressed : colors.surface,
        },
      ]}
    >
      <Icon name={icon} color={selected ? colors.primary : colors.textMuted} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" tone="muted">
          {description}
        </AppText>
      </View>
      {trailing}
      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
        {selected ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  flex: { flex: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
