import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const { spacing, colors } = useAppTheme();
  return (
    <View style={[styles.row, { marginTop: spacing.xl + 4, marginBottom: spacing.md }]}>
      <AppText variant="heading">{title}</AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={`${actionLabel}: ${title}`} hitSlop={12} style={styles.action}>
          <AppText variant="caption" tone="primary" style={styles.actionLabel}>
            {actionLabel}
          </AppText>
          <Icon name="chevron-forward" size={15} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionLabel: { fontWeight: '600' },
});
