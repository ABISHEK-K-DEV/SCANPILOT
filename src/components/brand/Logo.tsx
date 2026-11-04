import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { AppText } from '@/components/ui';

export const BRAND_GRADIENT = ['#4F46E5', '#7C3AED'] as const;

/** The glyph inside the mark: a page inside scan-frame corners, crossed by a scan beam. */
export function LogoGlyph({ size, beam = true }: { size: number; beam?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Scan frame corners */}
      <Path d="M22 36 V28 a6 6 0 0 1 6 -6 h8" stroke="#FFFFFF" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.95} />
      <Path d="M64 22 h8 a6 6 0 0 1 6 6 v8" stroke="#FFFFFF" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.95} />
      <Path d="M78 64 v8 a6 6 0 0 1 -6 6 h-8" stroke="#FFFFFF" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.95} />
      <Path d="M36 78 h-8 a6 6 0 0 1 -6 -6 v-8" stroke="#FFFFFF" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.95} />
      {/* Page with folded corner */}
      <Path d="M38 31 h17 l9 9 v26 a3 3 0 0 1 -3 3 h-23 a3 3 0 0 1 -3 -3 v-32 a3 3 0 0 1 3 -3 z" fill="#FFFFFF" />
      <Path d="M55 31 v9 h9 z" fill="#C7C4FF" />
      <Rect x="41" y="44" width="15" height="3" rx="1.5" fill="#A5A1F5" />
      <Rect x="41" y="57" width="19" height="3" rx="1.5" fill="#D4D2FA" />
      <Rect x="41" y="63" width="11" height="3" rx="1.5" fill="#D4D2FA" />
      {beam ? <Rect x="28" y="49.5" width="44" height="3.5" rx="1.75" fill="#5EEAD4" /> : null}
    </Svg>
  );
}

/** App mark: indigo→violet squircle with the scan glyph (matches the launcher icon). */
export function LogoMark({ size = 40, children }: { size?: number; children?: ReactNode }) {
  return (
    <LinearGradient
      colors={BRAND_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.mark, { width: size, height: size, borderRadius: size * 0.3 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LogoGlyph size={size} beam={!children} />
      {children}
    </LinearGradient>
  );
}

export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="ScanPilot">
      <LogoMark size={size} />
      <AppText variant="title" style={styles.word}>
        ScanPilot
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  word: { fontSize: 20, letterSpacing: -0.5 },
});
