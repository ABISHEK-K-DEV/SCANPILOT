import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { useAppTheme } from '@/theme';

import { LogoMark } from './Logo';

const MARK = 88;

/**
 * Branded start-up screen shown while the library opens: the mark with a
 * sweeping scan beam, the name, and a slim indeterminate progress bar.
 * `fontsReady` is false before Inter has loaded, so text uses the system font.
 */
export function BootScreen({ fontsReady = true }: { fontsReady?: boolean }) {
  const { colors, spacing } = useAppTheme();
  const appear = useState(() => new Animated.Value(0))[0];
  const beam = useState(() => new Animated.Value(0))[0];
  const bar = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(beam, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(beam, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const progress = Animated.loop(Animated.timing(bar, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }));
    sweep.start();
    progress.start();
    return () => {
      sweep.stop();
      progress.stop();
    };
  }, [appear, beam, bar]);

  const textStyle = fontsReady ? undefined : styles.systemFont;
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.background }]} accessibilityRole="progressbar" accessibilityLabel="Opening ScanPilot">
      <Animated.View
        style={[
          styles.center,
          { gap: spacing.lg, opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
        ]}
      >
        <View style={styles.markShadow}>
          <LogoMark size={MARK}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.beam,
                { transform: [{ translateY: beam.interpolate({ inputRange: [0, 1], outputRange: [-MARK * 0.22, MARK * 0.22] }) }] },
              ]}
            />
          </LogoMark>
        </View>
        <View style={styles.text}>
          <AppText variant="display" style={[styles.name, textStyle]}>
            ScanPilot
          </AppText>
          <AppText tone="muted" variant="caption" align="center" style={textStyle}>
            Scan, edit and sign — privately on your device
          </AppText>
        </View>
      </Animated.View>
      <View style={[styles.footer, { paddingBottom: spacing.xxl }]}>
        <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
          <Animated.View
            style={[
              styles.thumb,
              { backgroundColor: colors.primary, transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-56, 140] }) }] },
            ]}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markShadow: {
    borderRadius: MARK * 0.3,
    shadowColor: '#4F46E5',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  beam: {
    position: 'absolute',
    left: MARK * 0.28,
    right: MARK * 0.28,
    top: MARK * 0.495,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#5EEAD4',
    shadowColor: '#5EEAD4',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  text: { alignItems: 'center', gap: 4 },
  name: { letterSpacing: -0.8 },
  systemFont: { fontFamily: undefined },
  footer: { alignItems: 'center' },
  track: { width: 140, height: 3, borderRadius: 2, overflow: 'hidden' },
  thumb: { width: 56, height: 3, borderRadius: 2 },
});
