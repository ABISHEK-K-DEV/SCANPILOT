import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Icon, type IconName } from '@/components/ui';
import type { ToolCategory } from '@/features/tools';
import { elevation, toolAccents, useAppTheme } from '@/theme';

interface ToolTileProps {
  icon: IconName;
  label: string;
  description?: string;
  category: ToolCategory;
  onPress: () => void;
  comingSoon?: boolean;
  width: number;
  /** Compact = borderless icon + label (home quick tools). */
  compact?: boolean;
}

export function ToolTile({ icon, label, description, category, onPress, comingSoon, width, compact }: ToolTileProps) {
  const { colors, radius, spacing, dark } = useAppTheme();
  const [fg, bg] = toolAccents[category][dark ? 'dark' : 'light'];
  const a11y = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: comingSoon ? `${label}, coming soon` : label,
    accessibilityHint: description,
    accessibilityState: { disabled: !!comingSoon },
  };

  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        disabled={comingSoon}
        {...a11y}
        style={({ pressed }) => [styles.compact, { width, gap: spacing.sm, opacity: comingSoon ? 0.45 : pressed ? 0.7 : 1 }]}
      >
        <View style={[styles.compactIcon, { backgroundColor: bg, borderRadius: radius.lg + 2 }]}>
          <Icon name={icon} size={23} color={fg} />
        </View>
        <AppText variant="caption" numberOfLines={2} align="center" style={styles.compactLabel}>
          {label}
        </AppText>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={comingSoon}
      {...a11y}
      style={({ pressed }) => [
        styles.tile,
        {
          width,
          padding: spacing.md,
          gap: spacing.sm + 2,
          borderRadius: radius.lg,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
          opacity: comingSoon ? 0.55 : 1,
        },
        !dark && elevation.card,
      ]}
    >
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: bg, borderRadius: radius.md - 2 }]}>
          <Icon name={icon} size={18} color={fg} />
        </View>
        {comingSoon ? <Badge label="Soon" /> : null}
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderWidth: StyleSheet.hairlineWidth },
  compact: { alignItems: 'center', paddingVertical: 6 },
  compactIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  compactLabel: { fontWeight: '500', fontSize: 12.5, lineHeight: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  text: { gap: 2 },
});
