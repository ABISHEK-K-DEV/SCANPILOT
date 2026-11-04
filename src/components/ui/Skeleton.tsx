import { useEffect, useState } from 'react';
import { Animated, type DimensionValue, Easing, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

/** Softly pulsing placeholder block shown while content loads. */
export function Skeleton({ width = '100%', height = 14, radius: r }: { width?: DimensionValue; height?: number; radius?: number }) {
  const { colors, radius } = useAppTheme();
  const [pulse] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={{ width, height, borderRadius: r ?? radius.sm, backgroundColor: colors.surfacePressed, opacity: pulse }} />;
}

/** Placeholder for a document card (thumbnail + two text lines). */
export function DocumentSkeleton({ width }: { width: number }) {
  const { colors, radius, spacing } = useAppTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.card, { width, padding: spacing.sm, gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Skeleton height={(width - spacing.sm * 2) * 1.3} radius={radius.md} />
      <Skeleton width="80%" height={12} />
      <Skeleton width="50%" height={10} />
    </View>
  );
}

/** A row of document placeholders, used on Home and in Files. */
export function DocumentSkeletonRow({ count = 3, width = 148 }: { count?: number; width?: number }) {
  const { spacing } = useAppTheme();
  return (
    <View style={[styles.row, { gap: spacing.md }]} accessibilityRole="progressbar" accessibilityLabel="Loading documents">
      {Array.from({ length: count }, (_, i) => (
        <DocumentSkeleton key={i} width={width} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
