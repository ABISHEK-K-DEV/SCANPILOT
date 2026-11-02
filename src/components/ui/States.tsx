import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ icon, title, message, actionLabel, onAction, compact }: EmptyStateProps) {
  const { colors, spacing, radius } = useAppTheme();
  return (
    <View style={[styles.center, { padding: compact ? spacing.lg : spacing.xxl, gap: spacing.sm }]} accessible accessibilityRole="summary">
      <View style={[styles.badge, { backgroundColor: colors.primarySoft, borderRadius: radius.pill }]}>
        <Icon name={icon} size={28} color={colors.primary} />
      </View>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText tone="muted" align="center" style={styles.message}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors, spacing } = useAppTheme();
  return (
    <View style={[styles.center, styles.fill, { gap: spacing.md }]} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} size="large" />
      <AppText tone="muted">{label}</AppText>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors, spacing, radius } = useAppTheme();
  return (
    <View style={[styles.center, styles.fill, { padding: spacing.xxl, gap: spacing.sm }]} accessibilityRole="alert">
      <View style={[styles.badge, { backgroundColor: colors.dangerSoft, borderRadius: radius.pill }]}>
        <Icon name="alert-circle-outline" size={28} color={colors.danger} />
      </View>
      <AppText variant="heading" align="center">
        Something went wrong
      </AppText>
      <AppText tone="muted" align="center" style={styles.message}>
        {message}
      </AppText>
      {onRetry ? <Button label="Try again" icon="refresh" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
  badge: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  message: { maxWidth: 360 },
});
