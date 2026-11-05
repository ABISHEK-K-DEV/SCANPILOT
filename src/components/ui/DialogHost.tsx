import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type DialogButton, type DialogRequest, type DialogTone, useDialogStore } from '@/stores/dialogStore';
import { elevation, useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

const TONE_ICON: Record<DialogTone, IconName> = {
  info: 'information-circle-outline',
  question: 'information-circle-outline',
  danger: 'trash-outline',
  error: 'alert-circle-outline',
  success: 'checkmark-circle-outline',
};

function Dialog({ dialog }: { dialog: DialogRequest }) {
  const { colors, radius, spacing, dark } = useAppTheme();
  const dismiss = useDialogStore((s) => s.dismiss);
  const [scale] = useState(() => new Animated.Value(0.94));
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 260, mass: 0.7 }).start();
  }, [scale]);

  const toneColor = dialog.tone === 'danger' || dialog.tone === 'error' ? colors.danger : dialog.tone === 'success' ? colors.success : colors.primary;
  const toneSoft = dialog.tone === 'danger' || dialog.tone === 'error' ? colors.dangerSoft : dialog.tone === 'success' ? colors.successSoft : colors.primarySoft;
  // Cancel goes first (left); the confirming action is the strong button.
  const ordered = [...dialog.buttons].sort((a, b) => (a.style === 'cancel' ? -1 : b.style === 'cancel' ? 1 : 0));
  const stacked = ordered.length > 2 || ordered.some((b) => b.text.length > 16);
  const cancel = ordered.find((b) => b.style === 'cancel');

  const press = (button: DialogButton) => {
    dismiss(dialog.id);
    // Let the dialog close before the action opens anything else.
    setTimeout(() => button.onPress?.(), 60);
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => press(cancel ?? ordered[0])}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={cancel ? () => press(cancel) : undefined} accessibilityLabel="Dismiss">
        <Animated.View
          accessibilityRole="alert"
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceRaised,
              borderRadius: radius.xl,
              padding: spacing.xl,
              gap: spacing.md,
              borderColor: colors.border,
              borderWidth: dark ? StyleSheet.hairlineWidth : 0,
              transform: [{ scale }],
            },
            !dark && elevation.raised,
          ]}
        >
          <Pressable accessible={false} onPress={() => undefined} style={[styles.content, { gap: spacing.md }]}>
            <View style={[styles.badge, { backgroundColor: toneSoft }]}>
              <Icon name={TONE_ICON[dialog.tone]} size={24} color={toneColor} />
            </View>
            <View style={[styles.copy, { gap: 6 }]}>
              <AppText variant="heading" align="center" style={styles.title}>
                {dialog.title}
              </AppText>
              {dialog.message ? (
                <AppText tone="muted" align="center" style={styles.message}>
                  {dialog.message}
                </AppText>
              ) : null}
            </View>
            <View style={[stacked ? styles.stack : styles.row, styles.buttons, { gap: spacing.sm, marginTop: spacing.sm }]}>
              {(stacked ? [...ordered].reverse() : ordered).map((button) => {
                const isCancel = button.style === 'cancel';
                const destructive = button.style === 'destructive';
                const strong = !isCancel;
                const bg = destructive ? colors.danger : strong ? colors.primary : colors.surfaceAlt;
                const fg = strong ? (destructive ? '#FFFFFF' : colors.onPrimary) : colors.text;
                const secondaryAction = strong && ordered.filter((b) => b.style !== 'cancel').length > 1 && ordered.indexOf(button) < ordered.length - 1;
                return (
                  <Pressable
                    key={button.text}
                    onPress={() => press(button)}
                    accessibilityRole="button"
                    accessibilityLabel={button.text}
                    style={({ pressed }) => [
                      styles.button,
                      !stacked && styles.flex,
                      {
                        borderRadius: radius.md + 2,
                        backgroundColor: secondaryAction ? colors.primarySoft : bg,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <AppText variant="bodyStrong" numberOfLines={1} color={secondaryAction ? colors.primary : fg}>
                      {button.text}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function Toast() {
  const { colors, radius, dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const current = useDialogStore((s) => s.toast);
  const hide = useDialogStore((s) => s.hideToast);
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!current) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => hide(current.id));
    }, 2200);
    return () => clearTimeout(timer);
  }, [current, anim, hide]);

  if (!current) return null;
  const icon: IconName = current.tone === 'error' ? 'alert-circle-outline' : current.tone === 'info' ? 'information-circle-outline' : 'checkmark-circle';
  const tint = current.tone === 'error' ? '#F87171' : current.tone === 'info' ? '#A5A7FF' : '#34D399';
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.toast,
        {
          bottom: insets.bottom + 96,
          borderRadius: radius.pill,
          backgroundColor: dark ? colors.surfaceRaised : '#111827',
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
        elevation.raised,
      ]}
    >
      <Icon name={icon} size={18} color={tint} />
      <AppText variant="bodyStrong" color="#FFFFFF" numberOfLines={2} style={styles.toastText}>
        {current.message}
      </AppText>
    </Animated.View>
  );
}

/** Render once at the root: shows queued dialogs one at a time, and toasts. */
export function DialogHost() {
  const dialog = useDialogStore((s) => s.queue[0]);
  return (
    <>
      {dialog ? <Dialog key={dialog.id} dialog={dialog} /> : null}
      <Toast />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 340 },
  content: { alignItems: 'center' },
  copy: { alignSelf: 'stretch', alignItems: 'center' },
  buttons: { alignSelf: 'stretch' },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, lineHeight: 24 },
  message: { fontSize: 14.5, lineHeight: 21 },
  row: { flexDirection: 'row' },
  stack: { flexDirection: 'column' },
  button: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  toast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 12, maxWidth: '88%' },
  toastText: { fontSize: 14, flexShrink: 1 },
});
