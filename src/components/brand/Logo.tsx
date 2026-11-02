import { StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { useAppTheme } from '@/theme';

export function LogoMark({ size = 40 }: { size?: number }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: colors.primary }]}>
      <Icon name="scan" size={size * 0.58} color={colors.onPrimary} />
    </View>
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
  mark: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
