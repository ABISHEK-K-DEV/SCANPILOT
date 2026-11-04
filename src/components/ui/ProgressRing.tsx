import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '@/theme';

import { AppText } from './AppText';

interface ProgressRingProps {
  /** 0–1, or null for an indeterminate spinner. */
  progress: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  /** Show the percentage in the centre (determinate only). */
  showLabel?: boolean;
}

/** Circular progress: a smooth determinate ring or a rotating arc. */
export function ProgressRing({ progress, size = 64, stroke = 5, color, trackColor, showLabel = true }: ProgressRingProps) {
  const { colors } = useAppTheme();
  const spin = useState(() => new Animated.Value(0))[0];
  const indeterminate = progress === null;

  useEffect(() => {
    if (!indeterminate) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [indeterminate, spin]);

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const value = indeterminate ? 0.28 : Math.min(1, Math.max(0, progress));
  const tint = color ?? colors.primary;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, indeterminate ? { transform: [{ rotate }] } : null]}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor ?? colors.surfaceAlt} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={tint}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - value)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
      </Animated.View>
      {!indeterminate && showLabel ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <AppText variant="bodyStrong" style={{ fontSize: size * 0.22 }}>
            {Math.round(value * 100)}%
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
