import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Icon, type IconName } from '@/components/ui';
import type { ToolCategory } from '@/features/tools';
import { toolAccents, useAppTheme } from '@/theme';

interface ToolTileProps {
  icon: IconName;
  label: string;
  description?: string;
  category: ToolCategory;
  onPress: () => void;
  comingSoon?: boolean;
  width: number;
  /** Compact = icon + label only (home grid). */
  compact?: boolean;
}

export function ToolTile({ icon, label, description, category, onPress, comingSoon, width, compact }: ToolTileProps) {
  const { colors, radius, spacing, dark } = useAppTheme();
  const [fg, bg] = toolAccents[category][dark ? 'dark' : 'light'];
  return (
    <Pressable
      onPress={onPress}
      disabled={comingSoon}
      accessibilityRole="button"
      accessibilityLabel={comingSoon ? `${label}, coming soon` : label}
      accessibilityHint={description}
      accessibilityState={{ disabled: !!comingSoon }}
      style={({ pressed }) => [
        styles.tile,
        compact ? styles.compact : null,
        {
          width,
          padding: compact ? spacing.sm : spacing.md,
          gap: compact ? 6 : spacing.sm,
          borderRadius: radius.lg,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
          opacity: comingSoon ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        !dark && styles.shadow,
      ]}
    >
      <View style={[styles.top, compact && styles.center]}>
        <View style={[compact ? styles.iconSmall : styles.icon, { backgroundColor: bg, borderRadius: compact ? 14 : radius.md }]}>
          <Icon name={icon} size={compact ? 22 : 22} color={fg} />
        </View>
        {comingSoon && !compact ? <Badge label="Soon" /> : null}
      </View>
      <AppText variant={compact ? 'caption' : 'bodyStrong'} numberOfLines={compact ? 2 : 1} align={compact ? 'center' : 'left'} style={compact ? styles.compactLabel : undefined}>
        {label}
      </AppText>
      {description && !compact ? (
        <AppText variant="caption" tone="muted" numberOfLines={2}>
          {description}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderWidth: StyleSheet.hairlineWidth, minHeight: 112 },
  compact: { minHeight: 96, alignItems: 'center', justifyContent: 'center' },
  compactLabel: { fontWeight: '600' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  center: { justifyContent: 'center' },
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  iconSmall: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  shadow: { shadowColor: '#0B1B3F', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
});
