import { useEffect, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand/Logo';
import { AppText, Button } from '@/components/ui';
import { authenticate } from '@/services/security/authService';
import { useSecurityStore } from '@/stores/securityStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppTheme } from '@/theme';

/** Re-lock after this long in the background. */
const RELOCK_AFTER_MS = 30_000;

/** Watches app state and locks the app when it returns from the background. */
export function useAppLockWatcher() {
  const enabled = useSettingsStore((s) => s.settings.appLock);
  const lock = useSecurityStore((s) => s.lock);
  const backgroundedAt = useRef<number | null>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (enabled && !initialised.current) lock(); // cold start
    initialised.current = true;
    const sub = AppState.addEventListener('change', (state) => {
      if (!enabled) return;
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current !== null) {
        if (Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) lock();
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled, lock]);
}

export function LockScreen() {
  const { colors, spacing } = useAppTheme();
  const unlock = useSecurityStore((s) => s.unlock);

  const tryUnlock = async () => {
    if (await authenticate('Unlock ScanPilot')) unlock();
  };

  useEffect(() => {
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background, gap: spacing.lg, padding: spacing.xxl }]} accessibilityViewIsModal>
      <LogoMark size={72} />
      <AppText variant="title" align="center">
        ScanPilot is locked
      </AppText>
      <AppText tone="muted" align="center">
        Use your fingerprint, face or screen lock to open your documents.
      </AppText>
      <Button label="Unlock" icon="lock-open-outline" onPress={() => void tryUnlock()} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
});
