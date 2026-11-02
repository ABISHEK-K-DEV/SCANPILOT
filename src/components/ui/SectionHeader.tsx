import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { AppText } from './AppText';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const { spacing } = useAppTheme();
  return (
    <View style={[styles.row, { marginTop: spacing.xl, marginBottom: spacing.md }]}>
      <AppText variant="heading">{title}</AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={`${actionLabel}: ${title}`} hitSlop={12}>
          <AppText variant="bodyStrong" tone="primary">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
