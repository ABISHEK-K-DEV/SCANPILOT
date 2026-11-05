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

/**
 * Bottom sheet. Two layouts, chosen automatically:
 *  - action menu: icon tile + label (+ hint); destructive actions grouped at the end
 *  - choice list (any action has `selected`): radio rows; icons only when they differ
 * Always ends with a Cancel button. Selecting an action closes the sheet first.
 */
export function ActionSheet({ visible, title, subtitle, actions, onClose }: ActionSheetProps) {
  const { colors, radius, spacing, dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const choice = actions.some((a) => a.selected !== undefined);
  const showIcons = !choice || new Set(actions.map((a) => a.icon)).size > 1;
  const normal = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);

  const row = (action: SheetAction) => {
    const tint = action.destructive ? colors.danger : colors.text;
    const selected = !!action.selected;
    return (
      <Pressable
        key={action.key}
        disabled={action.disabled}
        onPress={() => {
          onClose();
          // Let the sheet's dismissal start before opening another modal.
          setTimeout(() => void action.onPress(), SHEET_DISMISS_DELAY_MS);
        }}
        accessibilityRole={choice && action.selected !== undefined ? 'radio' : 'menuitem'}
        accessibilityLabel={action.label}
        accessibilityHint={action.hint}
        accessibilityState={{ disabled: !!action.disabled, selected, checked: choice ? selected : undefined }}
        style={({ pressed }) => [
          styles.row,
          { paddingHorizontal: spacing.lg, gap: spacing.md, minHeight: MIN_TOUCH + (action.hint ? 12 : 4), borderRadius: radius.md },
          pressed && { backgroundColor: colors.surfacePressed },
          selected && { backgroundColor: colors.primarySoft },
          action.disabled && { opacity: 0.45 },
        ]}
      >
        {showIcons ? (
          <View
            style={[
              styles.tile,
              { borderRadius: radius.sm + 2, backgroundColor: action.destructive ? colors.dangerSoft : selected ? colors.surface : colors.surfaceAlt },
            ]}
          >
            <Icon name={action.icon} size={18} color={action.destructive ? colors.danger : selected ? colors.primary : colors.textMuted} />
          </View>
        ) : null}
        <View style={styles.flex}>
          <AppText variant={selected ? 'bodyStrong' : 'body'} color={selected ? colors.primary : tint}>
            {action.label}
          </AppText>
          {action.hint ? (
            <AppText variant="caption" tone="subtle" numberOfLines={1}>
              {action.hint}
            </AppText>
          ) : null}
        </View>
        {choice && action.selected !== undefined ? (
          <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.borderStrong }]}>
            {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
          </View>
        ) : null}
      </Pressable>
    );
  };

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
          <View style={[styles.header, { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomColor: colors.border }]}>
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
        <ScrollView bounces={false} contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingTop: spacing.sm, gap: 2 }}>
          {normal.map(row)}
          {destructive.length > 0 && normal.length > 0 ? <View style={[styles.divider, { backgroundColor: colors.border, marginHorizontal: spacing.lg }]} /> : null}
          {destructive.map(row)}
        </ScrollView>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [
            styles.cancel,
            { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.md + 2, backgroundColor: pressed ? colors.surfacePressed : colors.surfaceAlt },
          ]}
        >
          <AppText variant="bodyStrong">Cancel</AppText>
        </Pressable>
      </View>
    </Modal>
  );
}

const SHEET_DISMISS_DELAY_MS = 250;

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '86%', paddingTop: 8 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 14 },
  header: { gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  tile: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  cancel: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
