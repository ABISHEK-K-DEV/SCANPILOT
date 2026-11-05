import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Icon, IconButton } from '@/components/ui';
import { guideForRoute, TOOL_GUIDES, type ToolGuide } from '@/features/toolGuides';
import { useGuideStore } from '@/stores/guideStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { elevation, useAppTheme } from '@/theme';

import { GuideDemo } from './GuideDemo';

const STEP_MS = 2200;

/** Bottom sheet with the animated demo and three steps; steps highlight in turn. */
function GuideSheet({ guide, onClose }: { guide: ToolGuide; onClose: () => void }) {
  const { colors, radius, spacing, dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(0);
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const timer = setInterval(() => setActive((i) => (i + 1) % 3), STEP_MS);
    return () => clearInterval(timer);
  }, [enter]);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close guide" />
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surfaceRaised,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: insets.bottom + spacing.lg,
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
            opacity: enter,
          },
          !dark && elevation.raised,
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
        <ScrollView bounces={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
          <View style={styles.headerRow}>
            <View style={styles.flex}>
              <AppText variant="label" tone="primary" style={styles.eyebrow}>
                HOW IT WORKS
              </AppText>
              <AppText variant="title">{guide.title}</AppText>
              <AppText tone="muted" variant="caption">
                {guide.tagline}
              </AppText>
            </View>
            <IconButton icon="close" label="Close guide" onPress={onClose} filled />
          </View>
          <GuideDemo kind={guide.demo} badge={guide.badge} />
          <View style={{ gap: spacing.sm }}>
            {guide.steps.map((step, i) => {
              const on = i === active;
              return (
                <Pressable
                  key={step.title}
                  onPress={() => setActive(i)}
                  accessibilityRole="text"
                  accessibilityLabel={`Step ${i + 1}: ${step.title}. ${step.text}`}
                  style={[
                    styles.step,
                    { borderRadius: radius.lg, padding: spacing.md, gap: spacing.md, backgroundColor: on ? colors.primarySoft : colors.surfaceAlt, borderColor: on ? colors.primary : 'transparent' },
                  ]}
                >
                  <View style={[styles.num, { backgroundColor: on ? colors.primary : colors.surface }]}>
                    <AppText variant="label" color={on ? colors.onPrimary : colors.textMuted}>
                      {i + 1}
                    </AppText>
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" color={on ? colors.primary : colors.text}>
                      {step.title}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {step.text}
                    </AppText>
                  </View>
                  <Icon name={step.icon} size={20} color={on ? colors.primary : colors.textSubtle} />
                </Pressable>
              );
            })}
          </View>
          <Button label="Got it" icon="checkmark" fullWidth onPress={onClose} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/**
 * Render once at the root. Opens the guide for the current tool the first
 * time it is visited, and whenever `useGuideStore.open(id)` is called.
 */
export function ToolGuideHost() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const openId = useGuideStore((s) => s.openId);
  const open = useGuideStore((s) => s.open);
  const close = useGuideStore((s) => s.close);
  const seen = useSettingsStore((s) => s.settings.seenGuides);
  const update = useSettingsStore((s) => s.update);
  const guide = guideForRoute(pathname, params);
  const guideId = guide?.id;

  useEffect(() => {
    if (!guideId || seen.includes(guideId)) return;
    // Let the screen finish its push animation first.
    const timer = setTimeout(() => open(guideId), 450);
    return () => clearTimeout(timer);
  }, [guideId, seen, open]);

  const current = openId ? TOOL_GUIDES[openId] : null;
  if (!current) return null;
  return (
    <GuideSheet
      key={current.id}
      guide={current}
      onClose={() => {
        close();
        if (!seen.includes(current.id)) void update('seenGuides', [...seen, current.id]);
      }}
    />
  );
}

/** "?" button for headers and toolbars: replays the guide for the current tool. */
export function GuideButton({ color, light }: { color?: string; light?: boolean }) {
  const { colors } = useAppTheme();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const guide = guideForRoute(pathname, params);
  const open = useGuideStore((s) => s.open);
  if (!guide) return null;
  return (
    <IconButton
      icon="help-circle-outline"
      label={`How ${guide.title} works`}
      color={color ?? (light ? '#FFFFFF' : colors.textMuted)}
      onPress={() => open(guide.id)}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92%', paddingTop: 8 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: { letterSpacing: 1.2, marginBottom: 2 },
  step: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
