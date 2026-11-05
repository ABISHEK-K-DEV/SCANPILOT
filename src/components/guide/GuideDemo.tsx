import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText, Icon, type IconName } from '@/components/ui';
import type { DemoKind } from '@/features/toolGuides';
import { useAppTheme } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const STAGE_W = 280;
const STAGE_H = 190;
const PAGE_W = 92;
const PAGE_H = 122;

/** A tiny document page with text lines. */
function Page({ lines = 5, tint, children, width = PAGE_W, height = PAGE_H }: { lines?: number; tint?: string; children?: ReactNode; width?: number; height?: number }) {
  const { colors, dark } = useAppTheme();
  return (
    <View style={[styles.page, { width, height, backgroundColor: dark ? '#F8FAFC' : '#FFFFFF' }]}>
      <View style={[styles.line, { width: '55%', height: 6, backgroundColor: tint ?? colors.primary, opacity: 0.85 }]} />
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={[styles.line, { width: `${[88, 72, 92, 64, 80, 70, 86][i % 7]}%`, backgroundColor: '#CBD5E1' }]} />
      ))}
      {children}
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.fileBadge, { backgroundColor: color }]}>
      <AppText variant="label" color="#FFFFFF" style={styles.fileBadgeText}>
        {label}
      </AppText>
    </View>
  );
}

function Float({ icon, color, style }: { icon: IconName; color: string; style?: object }) {
  const { colors } = useAppTheme();
  return (
    <Animated.View style={[styles.float, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <Icon name={icon} size={20} color={color} />
    </Animated.View>
  );
}

/**
 * Looping, tilted ("2.5D") illustration of what a tool does. Both loops use
 * the JS driver: they drive layout props (width, top, stroke) and share views.
 */
export function GuideDemo({ kind, badge }: { kind: DemoKind; badge?: string }) {
  const { colors } = useAppTheme();
  const [t] = useState(() => new Animated.Value(0));
  const [float] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
        Animated.delay(700),
        Animated.timing(t, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.delay(250),
      ]),
    );
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    loop.start();
    bob.start();
    return () => {
      loop.stop();
      bob.stop();
    };
  }, [t, float]);

  const lerp = (a: number, b: number) => t.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const bobY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const accent = colors.primary;

  let scene: ReactNode;
  switch (kind) {
    case 'scan':
    case 'whiteboard':
    case 'business-card':
      scene = (
        <View style={styles.center}>
          <Page lines={kind === 'business-card' ? 2 : 6} width={kind === 'scan' ? PAGE_W : 136} height={kind === 'scan' ? PAGE_H : kind === 'whiteboard' ? 96 : 80} tint={kind === 'whiteboard' ? '#0EA5E9' : accent}>
            <Animated.View style={[styles.beam, { top: lerp(6, (kind === 'scan' ? PAGE_H : 90) - 10) }]} />
          </Page>
          <View style={[styles.corners, { width: (kind === 'scan' ? PAGE_W : 136) + 26, height: (kind === 'scan' ? PAGE_H : kind === 'whiteboard' ? 96 : 80) + 26 }]}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, styles[c], { borderColor: accent }]} />
            ))}
          </View>
          {kind === 'business-card' ? <Float icon="person" color={accent} style={{ position: 'absolute', right: 18, top: 10, opacity: t, transform: [{ translateY: bobY }] }} /> : null}
        </View>
      );
      break;
    case 'book':
      scene = (
        <View style={styles.center}>
          <View style={styles.row}>
            <Animated.View style={{ transform: [{ translateX: lerp(0, -14) }, { rotateY: '8deg' }] }}>
              <Page lines={6} />
            </Animated.View>
            <Animated.View style={{ transform: [{ translateX: lerp(0, 14) }, { rotateY: '-8deg' }] }}>
              <Page lines={6} tint="#0F766E" />
            </Animated.View>
          </View>
          <Animated.View style={[styles.spine, { backgroundColor: accent, opacity: lerp(1, 0.2) }]} />
        </View>
      );
      break;
    case 'id-card':
      scene = (
        <View style={styles.center}>
          <Animated.View style={{ transform: [{ perspective: 600 }, { rotateY: lerp(0, 180).interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] }) }] }}>
            <View style={[styles.idCard, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
              <View style={styles.idPhoto}>
                <Icon name="person" size={22} color="#6366F1" />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={[styles.line, { width: '80%', backgroundColor: '#818CF8' }]} />
                <View style={[styles.line, { width: '60%', backgroundColor: '#C7D2FE' }]} />
                <View style={[styles.line, { width: '70%', backgroundColor: '#C7D2FE' }]} />
              </View>
            </View>
          </Animated.View>
        </View>
      );
      break;
    case 'merge':
      scene = (
        <View style={styles.center}>
          <Animated.View style={[styles.abs, { transform: [{ translateX: lerp(-62, -6) }, { rotate: '-6deg' }] }]}>
            <Page tint="#0F766E" />
          </Animated.View>
          <Animated.View style={[styles.abs, { transform: [{ translateX: lerp(62, 6) }, { rotate: '6deg' }] }]}>
            <Page tint="#BE185D" />
          </Animated.View>
          <Float icon="git-merge" color={accent} style={{ position: 'absolute', bottom: 6, opacity: t, transform: [{ translateY: bobY }] }} />
        </View>
      );
      break;
    case 'split':
      scene = (
        <View style={styles.center}>
          <Animated.View style={[styles.abs, { transform: [{ translateX: lerp(-4, -58) }, { rotate: lerp(0, -8).interpolate({ inputRange: [-8, 0], outputRange: ['-8deg', '0deg'] }) }] }]}>
            <Page />
          </Animated.View>
          <Animated.View style={[styles.abs, { transform: [{ translateX: lerp(4, 58) }, { rotate: lerp(0, 8).interpolate({ inputRange: [0, 8], outputRange: ['0deg', '8deg'] }) }] }]}>
            <Page tint="#0F766E" />
          </Animated.View>
          <Float icon="cut" color={accent} style={{ position: 'absolute', top: 4, opacity: t }} />
        </View>
      );
      break;
    case 'organize':
      scene = (
        <View style={[styles.row, { gap: 10 }]}>
          <Animated.View style={{ transform: [{ translateX: lerp(0, 74) }] }}>
            <Page width={64} height={86} lines={4} tint="#BE185D" />
          </Animated.View>
          <Page width={64} height={86} lines={4} />
          <Animated.View style={{ transform: [{ translateX: lerp(0, -74) }] }}>
            <Page width={64} height={86} lines={4} tint="#0F766E" />
          </Animated.View>
        </View>
      );
      break;
    case 'rotate':
      scene = (
        <Animated.View style={{ transform: [{ rotate: lerp(0, 90).interpolate({ inputRange: [0, 90], outputRange: ['0deg', '90deg'] }) }] }}>
          <Page />
        </Animated.View>
      );
      break;
    case 'crop':
      scene = (
        <View style={styles.center}>
          <Page />
          <Animated.View style={[styles.cropBox, { borderColor: accent, width: lerp(PAGE_W + 16, PAGE_W - 18), height: lerp(PAGE_H + 16, PAGE_H - 22) }]} />
        </View>
      );
      break;
    case 'compress':
      scene = (
        <View style={styles.center}>
          <Animated.View style={{ transform: [{ scale: lerp(1, 0.72) }] }}>
            <Page lines={6} />
          </Animated.View>
          <Animated.View style={[styles.sizePill, { backgroundColor: colors.successSoft, opacity: t }]}>
            <AppText variant="label" color={colors.success}>
              3.8 MB → 0.9 MB
            </AppText>
          </Animated.View>
        </View>
      );
      break;
    case 'sign':
      scene = (
        <View style={styles.center}>
          <Page lines={4}>
            <View style={styles.signArea}>
              <Svg width={78} height={34} viewBox="0 0 78 34">
                <AnimatedPath
                  d="M4 24 C10 6 16 30 22 14 S30 26 36 16 S46 6 50 22 S62 30 74 12"
                  stroke="#1E3A8A"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray="140 140"
                  strokeDashoffset={lerp(140, 0)}
                />
              </Svg>
              <View style={[styles.line, { width: '100%', height: 1.5, backgroundColor: '#94A3B8', marginTop: -4 }]} />
            </View>
          </Page>
          <Float icon="signature" color={accent} style={{ position: 'absolute', right: 30, top: 8, transform: [{ translateY: bobY }] }} />
        </View>
      );
      break;
    case 'edit':
    case 'text':
      scene = (
        <View style={styles.center}>
          <Page lines={6}>
            <Animated.View style={[styles.highlight, { width: lerp(0, 60) }]} />
          </Page>
          <Float icon={kind === 'text' ? 'text-outline' : 'brush-outline'} color={accent} style={{ position: 'absolute', right: 34, top: 18, transform: [{ translateY: bobY }] }} />
        </View>
      );
      break;
    case 'redact':
      scene = (
        <View style={styles.center}>
          <Page lines={6}>
            <Animated.View style={[styles.redactBar, { top: 34, width: lerp(0, 58) }]} />
            <Animated.View style={[styles.redactBar, { top: 58, width: lerp(0, 44) }]} />
          </Page>
          <Float icon="eye-off" color={colors.danger} style={{ position: 'absolute', right: 34, top: 14, transform: [{ translateY: bobY }] }} />
        </View>
      );
      break;
    case 'watermark':
    case 'numbers':
      scene = (
        <View style={styles.center}>
          <Page lines={6}>
            {kind === 'watermark' ? (
              <Animated.View style={[styles.watermark, { opacity: lerp(0, 0.85) }]}>
                <AppText variant="label" color="#EF4444" style={styles.watermarkText}>
                  CONFIDENTIAL
                </AppText>
              </Animated.View>
            ) : (
              <Animated.View style={[styles.pageNo, { opacity: t, backgroundColor: colors.primarySoft }]}>
                <AppText variant="label" color={accent}>
                  1 / 12
                </AppText>
              </Animated.View>
            )}
          </Page>
        </View>
      );
      break;
    case 'protect':
    case 'unlock':
      scene = (
        <View style={styles.center}>
          <Page lines={6} />
          <Animated.View
            style={[
              styles.lock,
              {
                backgroundColor: kind === 'protect' ? colors.successSoft : colors.primarySoft,
                transform: [{ translateY: lerp(kind === 'protect' ? -60 : 0, kind === 'protect' ? 0 : -50) }, { scale: lerp(0.8, 1) }],
                opacity: kind === 'protect' ? t : lerp(1, 0.3),
              },
            ]}
          >
            <Icon name={kind === 'protect' ? 'lock-closed' : 'lock-open'} size={26} color={kind === 'protect' ? colors.success : accent} />
          </Animated.View>
        </View>
      );
      break;
    case 'ocr':
      scene = (
        <View style={[styles.row, { gap: 18 }]}>
          <Page lines={6}>
            <Animated.View style={[styles.beam, { top: lerp(8, PAGE_H - 12) }]} />
          </Page>
          <Animated.View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border, opacity: t, transform: [{ translateX: lerp(-16, 0) }] }]}>
            <AppText variant="bodyStrong">Aa</AppText>
            <AppText variant="caption" tone="muted">
              Text found
            </AppText>
          </Animated.View>
        </View>
      );
      break;
    case 'convert':
    case 'images':
    case 'repair':
    default:
      scene = (
        <View style={[styles.row, { gap: 22 }]}>
          <Animated.View style={{ opacity: lerp(1, 0.55), transform: [{ translateX: lerp(10, 0) }] }}>
            {kind === 'images' ? (
              <View style={[styles.photo, { backgroundColor: '#BAE6FD' }]}>
                <Icon name="image" size={30} color="#0369A1" />
              </View>
            ) : (
              <Page lines={5} />
            )}
          </Animated.View>
          <Animated.View style={{ opacity: t }}>
            <Icon name="arrow-forward" size={22} color={colors.textSubtle} />
          </Animated.View>
          <Animated.View style={{ opacity: t, transform: [{ scale: lerp(0.7, 1) }] }}>
            <Page lines={4} tint={kind === 'repair' ? colors.success : accent}>
              <Badge label={kind === 'images' ? 'PDF' : kind === 'repair' ? 'OK' : (badge ?? 'PDF')} color={kind === 'repair' ? colors.success : accent} />
            </Page>
          </Animated.View>
        </View>
      );
  }

  return (
    <View style={[styles.stage, { backgroundColor: colors.primarySoft }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.glow, { backgroundColor: colors.surface }]} />
      {/* Slight tilt gives the flat pages a sense of depth. */}
      <Animated.View style={{ transform: [{ perspective: 900 }, { rotateX: '14deg' }, { rotateZ: '-2deg' }, { translateY: bobY }] }}>{scene}</Animated.View>
      <View style={[styles.floor, { backgroundColor: colors.primary }]} />
    </View>
  );
}

const C = 16;
const styles = StyleSheet.create({
  stage: { width: '100%', height: STAGE_H + 30, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glow: { position: 'absolute', width: STAGE_W, height: STAGE_W, borderRadius: STAGE_W / 2, opacity: 0.6, top: -60 },
  floor: { position: 'absolute', bottom: 22, width: 160, height: 14, borderRadius: 80, opacity: 0.12 },
  center: { width: STAGE_W, height: STAGE_H, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
  page: {
    borderRadius: 8,
    padding: 10,
    gap: 7,
    overflow: 'hidden',
    shadowColor: '#1E1B4B',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  line: { height: 4, borderRadius: 2 },
  beam: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: '#22D3EE', shadowColor: '#22D3EE', shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  corners: { position: 'absolute' },
  corner: { position: 'absolute', width: C, height: C },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  spine: { position: 'absolute', width: 2, height: PAGE_H + 8 },
  idCard: { width: 150, height: 94, borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 6, shadowColor: '#1E1B4B', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 10 } },
  idPhoto: { width: 44, height: 54, borderRadius: 8, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' },
  float: { width: 40, height: 40, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#1E1B4B', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  cropBox: { position: 'absolute', borderWidth: 2.5, borderRadius: 6, borderStyle: 'dashed' },
  sizePill: { position: 'absolute', bottom: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  signArea: { position: 'absolute', left: 8, bottom: 8 },
  highlight: { position: 'absolute', top: 38, left: 10, height: 8, borderRadius: 3, backgroundColor: '#FDE047', opacity: 0.7 },
  redactBar: { position: 'absolute', left: 10, height: 7, borderRadius: 2, backgroundColor: '#0F172A' },
  watermark: { position: 'absolute', top: 50, left: -6, right: -6, alignItems: 'center', transform: [{ rotate: '-28deg' }] },
  watermarkText: { fontSize: 11, letterSpacing: 1.5 },
  pageNo: { position: 'absolute', bottom: 6, alignSelf: 'center', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  lock: { position: 'absolute', width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bubble: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  photo: { width: 80, height: 100, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fileBadge: { position: 'absolute', bottom: 8, right: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  fileBadgeText: { fontSize: 10 },
});
