import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

interface ProgressOverlayProps {
  visible: boolean;
  title: string;
  /** 0–1, or null for indeterminate. */
  progress: number | null;
  detail?: string;
  onCancel?: () => void;
}

export function ProgressOverlay({ visible, title, progress, detail, onCancel }: ProgressOverlayProps) {
  const { colors, radius, spacing } = useAppTheme();
  const percent = progress === null ? null : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel ?? (() => undefined)}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[styles.panel, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md }]}
          accessibilityRole="progressbar"
          accessibilityLabel={title}
          accessibilityValue={percent === null ? undefined : { min: 0, max: 100, now: percent }}
          accessibilityLiveRegion="polite"
        >
          <AppText variant="heading">{title}</AppText>
          {percent === null ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={[styles.track, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
              <View style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.primary, borderRadius: radius.pill }]} />
            </View>
          )}
          <AppText tone="muted" variant="caption">
            {detail ?? (percent === null ? 'Working…' : `${percent}%`)}
          </AppText>
          {onCancel ? <Button label="Cancel" variant="secondary" onPress={onCancel} compact /> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  panel: { width: '100%', maxWidth: 380 },
  track: { height: 8, overflow: 'hidden' },
  fill: { height: 8 },
});
