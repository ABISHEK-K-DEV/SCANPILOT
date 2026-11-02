import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand/Logo';
import { AppText, Button, Icon, type IconName, Screen } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppTheme } from '@/theme';

const SLIDES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'scan-outline',
    title: 'Scan anything. Edit everything.',
    body: 'Turn paper, photos and PDFs into clean, shareable documents — all in one place.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Private by design',
    body: 'Your documents are stored only on this device. No account, no cloud upload, no tracking of what you scan.',
  },
  {
    icon: 'gift-outline',
    title: 'Genuinely free',
    body: 'No subscription, no watermark and no page limits. Core tools work completely offline.',
  },
];

export default function OnboardingScreen() {
  const { colors, radius, spacing } = useAppTheme();
  const update = useSettingsStore((s) => s.update);
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const finish = async () => {
    await update('onboardingComplete', true);
    router.replace('/');
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.top}>
        <LogoMark size={36} />
        {!last ? <Button label="Skip" variant="ghost" compact onPress={finish} /> : null}
      </View>
      <View style={[styles.center, { gap: spacing.lg }]}>
        <View style={[styles.illustration, { backgroundColor: colors.primarySoft, borderRadius: radius.xl * 2 }]}>
          <Icon name={slide.icon} size={88} color={colors.primary} />
        </View>
        <AppText variant="display" align="center" accessibilityLiveRegion="polite">
          {slide.title}
        </AppText>
        <AppText tone="muted" align="center" style={styles.body}>
          {slide.body}
        </AppText>
      </View>
      <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
        <View style={[styles.dots, { gap: spacing.sm }]} accessible accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View
              key={s.title}
              style={{
                width: i === index ? 22 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === index ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
        <Button label={last ? 'Get started' : 'Next'} fullWidth onPress={last ? finish : () => setIndex(index + 1)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  illustration: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  body: { maxWidth: 400 },
  dots: { flexDirection: 'row', justifyContent: 'center' },
});
