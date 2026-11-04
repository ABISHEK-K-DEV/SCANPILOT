import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { elevation, useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { ProgressRing } from './ProgressRing';

interface ProgressOverlayProps {
  visible: boolean;
  title: string;
  /** 0–1, or null for indeterminate. */
  progress: number | null;
  detail?: string;
  onCancel?: () => void;
}

/** Blocking progress dialog: animated ring, title, status line and optional Cancel. */
export function ProgressOverlay({ visible, title, progress, detail, onCancel }: ProgressOverlayProps) {
  const { colors, radius, spacing, dark } = useAppTheme();
  const percent = progress === null ? null : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const status = detail ?? (percent === null ? 'This only takes a moment' : 'Processing on your device');
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel ?? (() => undefined)}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surfaceRaised,
              borderRadius: radius.xl,
              paddingTop: spacing.xl + 4,
              paddingHorizontal: spacing.xl,
              paddingBottom: onCancel ? spacing.sm : spacing.xl,
              borderColor: colors.border,
              borderWidth: dark ? StyleSheet.hairlineWidth : 0,
            },
            !dark && elevation.raised,
          ]}
          accessibilityRole="progressbar"
          accessibilityLabel={title}
          accessibilityValue={percent === null ? undefined : { min: 0, max: 100, now: percent }}
          accessibilityLiveRegion="polite"
        >
          <ProgressRing progress={progress === null ? null : progress} size={68} stroke={5} />
          <View style={[styles.text, { gap: spacing.xs, marginTop: spacing.lg }]}>
            <AppText variant="heading" align="center" numberOfLines={2}>
              {title}
            </AppText>
            <AppText tone="muted" variant="caption" align="center" numberOfLines={3}>
              {status}
            </AppText>
          </View>
          {onCancel ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border, marginTop: spacing.xl }]} />
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={({ pressed }) => [styles.cancel, { borderRadius: radius.md, backgroundColor: pressed ? colors.surfacePressed : 'transparent' }]}
              >
                <AppText variant="bodyStrong" tone="muted">
                  Cancel
                </AppText>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  panel: { width: '100%', maxWidth: 300, alignItems: 'center' },
  text: { alignSelf: 'stretch', alignItems: 'center' },
  divider: { alignSelf: 'stretch', height: StyleSheet.hairlineWidth, marginHorizontal: -24 },
  cancel: { alignSelf: 'stretch', minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
