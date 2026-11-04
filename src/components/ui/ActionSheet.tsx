import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, MIN_TOUCH, useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface SheetAction {
  key: string;
  label: string;
  icon: IconName;
  /** May return a promise; callers are expected to handle their own errors. */
  onPress: () => void | Promise<unknown>;
  destructive?: boolean;
  selected?: boolean;
  disabled?: boolean;
  hint?: string;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
}

/** Bottom sheet with a list of actions. Selecting an action closes the sheet first. */
export function ActionSheet({ visible, title, subtitle, actions, onClose }: ActionSheetProps) {
  const { colors, radius, spacing, dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close menu" />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surfaceRaised,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: insets.bottom + spacing.md,
          },
          !dark && elevation.raised,
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
        {title ? (
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.md, gap: 2 }}>
            <AppText variant="heading" numberOfLines={2}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        ) : null}
        <ScrollView bounces={false}>
          {actions.map((action) => {
            const color = action.destructive ? colors.danger : action.selected ? colors.primary : colors.text;
            const tile = action.destructive ? colors.dangerSoft : action.selected ? colors.primarySoft : colors.surfaceAlt;
            return (
              <Pressable
                key={action.key}
                disabled={action.disabled}
                onPress={() => {
                  onClose();
                  // Let the sheet's dismissal start before opening another modal.
                  setTimeout(() => void action.onPress(), SHEET_DISMISS_DELAY_MS);
                }}
                accessibilityRole="menuitem"
                accessibilityLabel={action.label}
                accessibilityHint={action.hint}
                accessibilityState={{ disabled: !!action.disabled, selected: !!action.selected }}
                style={({ pressed }) => [
                  styles.row,
                  { paddingHorizontal: spacing.xl, gap: spacing.md + 2, minHeight: MIN_TOUCH + 8 },
                  pressed && { backgroundColor: colors.surfacePressed },
                  action.disabled && { opacity: 0.45 },
                ]}
              >
                <View style={[styles.tile, { backgroundColor: tile, borderRadius: radius.sm + 2 }]}>
                  <Icon name={action.icon} size={19} color={action.destructive || action.selected ? color : colors.textMuted} />
                </View>
                <View style={styles.flex}>
                  <AppText variant={action.selected ? 'bodyStrong' : 'body'} color={color}>
                    {action.label}
                  </AppText>
                  {action.hint ? (
                    <AppText variant="caption" tone="subtle">
                      {action.hint}
                    </AppText>
                  ) : null}
                </View>
                {action.selected ? <Icon name="checkmark" color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const SHEET_DISMISS_DELAY_MS = 250;

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%', paddingTop: 8 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 14 },
  tile: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
