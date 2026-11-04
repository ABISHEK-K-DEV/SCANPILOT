import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { AppText } from '@/components/ui';

/** App mark: gradient tile, white page with folded corner and a mint scan beam (matches the launcher icon). */
export function LogoMark({ size = 40 }: { size?: number }) {
  const s = 100;
  return (
    <LinearGradient
      colors={['#2D5BFF', '#7A3CF5']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.mark, { width: size, height: size, borderRadius: size * 0.28 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox={`0 0 ${s} ${s}`}>
        <Path d="M30 22 h30 l12 12 v42 a4 4 0 0 1 -4 4 h-38 a4 4 0 0 1 -4 -4 v-50 a4 4 0 0 1 4 -4 z" fill="#FFFFFF" />
        <Path d="M60 22 v12 h12 z" fill="#CDD8FF" />
        <Rect x="33" y="31" width="20" height="3.6" rx="1.8" fill="#7890DC" />
        <Rect x="33" y="39" width="27" height="3.6" rx="1.8" fill="#7890DC" />
        <Rect x="33" y="60" width="24" height="3.6" rx="1.8" fill="#BEC8F0" />
        <Rect x="33" y="68" width="16" height="3.6" rx="1.8" fill="#BEC8F0" />
        <Rect x="20" y="49" width="60" height="4" rx="2" fill="#3DF5C8" />
      </Svg>
    </LinearGradient>
  );
}

export function Wordmark() {
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="ScanPilot">
      <LogoMark size={34} />
      <AppText variant="title">
        Scan<AppText variant="title" tone="primary">Pilot</AppText>
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
