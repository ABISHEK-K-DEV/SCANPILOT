import { router } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Logo';
import { AppText, Button, Icon, type IconName, Screen } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { elevation, toolAccents, useAppTheme } from '@/theme';

/** Floating label used in the illustrations. */
function Tag({ icon, label, color, style }: { icon: IconName; label: string; color: string; style?: object }) {
  const { colors, radius, dark } = useAppTheme();
  return (
    <View style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill }, !dark && elevation.raised, style]}>
      <Icon name={icon} size={14} color={color} />
      <AppText variant="caption" style={styles.tagText}>
        {label}
      </AppText>
    </View>
  );
}

function Stage({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.stage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.ringOuter, { borderColor: colors.border }]} />
      <View style={[styles.ringInner, { backgroundColor: colors.primarySoft }]} />
      {children}
    </View>
  );
}

function ScanArt() {
  const { colors, radius, dark } = useAppTheme();
  const corner = { borderColor: colors.primary };
  return (
    <Stage>
      <View style={[styles.paper, { backgroundColor: colors.surface, borderRadius: radius.md, borderColor: colors.border }, !dark && elevation.raised]}>
        {[58, 90, 78, 94, 66, 0, 88, 72, 84, 50].map((w, i) => (w === 0 ? <View key={i} style={styles.gap} /> : (
          <View key={i} style={[styles.line, { width: `${w}%`, backgroundColor: i === 0 ? colors.borderStrong : colors.surfaceAlt, height: i === 0 ? 7 : 5 }]} />
        )))}
        <View style={[styles.beam, { backgroundColor: '#2DD4BF' }]} />
      </View>
      <View style={[styles.corner, styles.tl, corner]} />
      <View style={[styles.corner, styles.tr, corner]} />
      <View style={[styles.corner, styles.bl, corner]} />
      <View style={[styles.corner, styles.br, corner]} />
      <Tag icon="checkmark-circle" label="Edges detected" color={colors.success} style={styles.tagBottom} />
    </Stage>
  );
}

function ToolsArt() {
  const { colors, radius, dark } = useAppTheme();
  const tiles: { icon: IconName; cat: keyof typeof toolAccents }[] = [
    { icon: 'git-merge', cat: 'organise' },
    { icon: 'signature', cat: 'edit' },
    { icon: 'contract', cat: 'optimise' },
    { icon: 'scan-text', cat: 'convert' },
  ];
  return (
    <Stage>
      <View style={[styles.toolCard, { backgroundColor: colors.surface, borderRadius: radius.xl, borderColor: colors.border }, !dark && elevation.raised]}>
        {tiles.map((t) => {
          const [fg, bg] = toolAccents[t.cat][dark ? 'dark' : 'light'];
          return (
            <View key={t.icon} style={[styles.toolTile, { backgroundColor: bg, borderRadius: radius.lg }]}>
              <Icon name={t.icon} size={26} color={fg} />
            </View>
          );
        })}
      </View>
      <Tag icon="sparkles" label="20+ PDF tools" color={colors.primary} style={styles.tagTop} />
    </Stage>
  );
}

function PrivacyArt() {
  const { colors, dark } = useAppTheme();
  return (
    <Stage>
      <View style={[styles.shield, { backgroundColor: colors.surface, borderColor: colors.border }, !dark && elevation.raised]}>
        <Icon name="shield-checkmark-outline" size={56} color={colors.primary} strokeWidth={1.6} />
      </View>
      <Tag icon="cloud-offline-outline" label="No upload" color={colors.success} style={styles.tagLeft} />
      <Tag icon="lock-closed" label="App lock" color={colors.primary} style={styles.tagRight} />
    </Stage>
  );
}

const SLIDES: { key: string; art: () => ReactNode; eyebrow: string; title: string; body: string }[] = [
  {
    key: 'scan',
    art: () => <ScanArt />,
    eyebrow: 'SCAN',
    title: 'Paper to PDF in seconds',
    body: 'Point your camera at any page. ScanPilot finds the edges, straightens and sharpens it for you.',
  },
  {
    key: 'tools',
    art: () => <ToolsArt />,
    eyebrow: 'EDIT',
    title: 'Every PDF tool in one place',
    body: 'Merge, split, compress, sign, redact and extract text. No watermark and no page limits.',
  },
  {
    key: 'privacy',
    art: () => <PrivacyArt />,
    eyebrow: 'PRIVATE',
    title: 'Your files stay on your phone',
    body: 'No account, no cloud upload and no tracking. Lock the app or a folder with your fingerprint.',
  },
];

export default function OnboardingScreen() {
  const { colors, spacing } = useAppTheme();
  const update = useSettingsStore((s) => s.update);
  const [index, setIndex] = useState(0);
  // The pager is measured, not flex-sized: a horizontal ScrollView does not give
  // its pages a height on Android, which collapsed the slides into each other.
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const pager = useRef<ScrollViewInstance>(null);
  const last = index === SLIDES.length - 1;
  const pageWidth = size?.width ?? 0;

  // Shrink the illustration on short screens so the copy never overlaps it.
  const artScale = size ? Math.max(0.55, Math.min(1, (size.height - 230) / STAGE)) : 1;

  const finish = async () => {
    await update('onboardingComplete', true);
    router.replace('/');
  };

  const goTo = (i: number) => {
    setIndex(i);
    pager.current?.scrollTo({ x: i * pageWidth, animated: true });
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.width - width) > 1 || Math.abs(size.height - height) > 1) {
      setSize({ width, height });
      // Keep the current slide in view after a rotation / resize.
      requestAnimationFrame(() => pager.current?.scrollTo({ x: index * width, animated: false }));
    }
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} contentStyle={styles.noPad}>
      <View style={[styles.top, { paddingHorizontal: spacing.lg }]}>
        <Wordmark size={28} />
        {!last ? <Button label="Skip" variant="ghost" compact onPress={finish} /> : <View style={styles.skipSpace} />}
      </View>

      <View style={styles.flex} onLayout={onLayout}>
        {size ? (
          <ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            scrollEventThrottle={16}
            style={{ width: size.width, height: size.height }}
            contentContainerStyle={{ height: size.height }}
          >
            {SLIDES.map((slide, i) => (
              <View
                key={slide.key}
                style={[styles.page, { width: size.width, height: size.height, paddingHorizontal: spacing.xl, gap: 28 * artScale + 8 }]}
                accessibilityElementsHidden={i !== index}
                importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}
              >
                <View style={{ width: STAGE * artScale, height: STAGE * artScale, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ transform: [{ scale: artScale }] }}>{slide.art()}</View>
                </View>
                <View style={[styles.copy, { gap: spacing.sm }]}>
                  <AppText variant="label" tone="primary" align="center" style={styles.eyebrow}>
                    {slide.eyebrow}
                  </AppText>
                  <AppText variant="display" align="center" accessibilityLiveRegion="polite">
                    {slide.title}
                  </AppText>
                  <AppText tone="muted" align="center" style={styles.body}>
                    {slide.body}
                  </AppText>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={{ gap: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg }}>
        <View style={[styles.dots, { gap: 6 }]} accessible accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, { width: i === index ? 24 : 6, backgroundColor: i === index ? colors.primary : colors.borderStrong }]} />
          ))}
        </View>
        <Button
          label={last ? 'Get started' : 'Continue'}
          trailingIcon={last ? undefined : 'arrow-forward'}
          icon={last ? 'checkmark' : undefined}
          fullWidth
          onPress={last ? finish : () => goTo(index + 1)}
        />
      </View>
    </Screen>
  );
}

const STAGE = 260;
const PAPER_W = 132;
const PAPER_H = 172;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noPad: { paddingHorizontal: 0 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56 },
  skipSpace: { height: 40 },
  page: { alignItems: 'center', justifyContent: 'center' },
  copy: { alignItems: 'center', maxWidth: 420 },
  eyebrow: { letterSpacing: 1.6 },
  body: { maxWidth: 360 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },

  stage: { width: STAGE, height: STAGE, alignItems: 'center', justifyContent: 'center' },
  ringOuter: { position: 'absolute', width: STAGE, height: STAGE, borderRadius: STAGE / 2, borderWidth: 1, borderStyle: 'dashed' },
  ringInner: { position: 'absolute', width: STAGE - 52, height: STAGE - 52, borderRadius: (STAGE - 52) / 2 },

  paper: { width: PAPER_W, height: PAPER_H, padding: 16, gap: 10, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  line: { borderRadius: 3 },
  gap: { height: 4 },
  beam: { position: 'absolute', left: 0, right: 0, top: PAPER_H * 0.52, height: 3, opacity: 0.9 },
  corner: { position: 'absolute', width: 26, height: 26, borderWidth: 0 },
  tl: { top: STAGE / 2 - PAPER_H / 2 - 12, left: STAGE / 2 - PAPER_W / 2 - 12, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  tr: { top: STAGE / 2 - PAPER_H / 2 - 12, right: STAGE / 2 - PAPER_W / 2 - 12, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bl: { bottom: STAGE / 2 - PAPER_H / 2 - 12, left: STAGE / 2 - PAPER_W / 2 - 12, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  br: { bottom: STAGE / 2 - PAPER_H / 2 - 12, right: STAGE / 2 - PAPER_W / 2 - 12, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },

  toolCard: { width: 168, height: 168, padding: 16, gap: 12, flexDirection: 'row', flexWrap: 'wrap', borderWidth: StyleSheet.hairlineWidth },
  toolTile: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center' },

  shield: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },

  tag: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth },
  tagText: { fontWeight: '600' },
  tagBottom: { bottom: 6, right: 0 },
  tagTop: { top: 14, right: -4 },
  tagLeft: { bottom: 36, left: -6 },
  tagRight: { top: 40, right: -6 },
});
