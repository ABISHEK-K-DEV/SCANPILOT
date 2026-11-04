import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ProgressRing } from './ProgressRing';

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
      <View style={[styles.halo, { backgroundColor: colors.primarySoft, borderRadius: radius.pill }]}>
        <View style={[styles.badge, { backgroundColor: colors.surface, borderRadius: radius.lg + 2, borderColor: colors.border }]}>
          <Icon name={icon} size={26} color={colors.primary} />
        </View>
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
  const { spacing } = useAppTheme();
  return (
    <View style={[styles.center, styles.fill, { gap: spacing.md }]} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ProgressRing progress={null} size={40} stroke={4} />
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors, spacing, radius } = useAppTheme();
  return (
    <View style={[styles.center, styles.fill, { padding: spacing.xxl, gap: spacing.sm }]} accessibilityRole="alert">
      <View style={[styles.halo, { backgroundColor: colors.dangerSoft, borderRadius: radius.pill }]}>
        <View style={[styles.badge, { backgroundColor: colors.surface, borderRadius: radius.lg + 2, borderColor: colors.border }]}>
          <Icon name="alert-circle-outline" size={26} color={colors.danger} />
        </View>
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
  halo: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badge: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  message: { maxWidth: 360 },
});

/** Small centred spinner that fills its parent. */
export function ActivityIndicatorBox() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.center, styles.fill]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
