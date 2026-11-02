import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, Icon, type IconName } from '@/components/ui';
import { useAppTheme } from '@/theme';

interface ToolTileProps {
  icon: IconName;
  label: string;
  description?: string;
  onPress: () => void;
  /** Shown as a badge when the tool is not available yet. */
  comingSoon?: boolean;
  width: number;
}

export function ToolTile({ icon, label, description, onPress, comingSoon, width }: ToolTileProps) {
  const { colors, radius, spacing } = useAppTheme();
  return (
    <Card
      onPress={onPress}
      disabled={comingSoon}
      padded={false}
      accessibilityLabel={comingSoon ? `${label}, coming soon` : label}
      accessibilityHint={description}
      style={[styles.tile, { width, padding: spacing.md, gap: spacing.sm }]}
    >
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
          <Icon name={icon} size={22} color={colors.primary} />
        </View>
        {comingSoon ? <Badge label="Soon" /> : null}
      </View>
      <AppText variant="bodyStrong" numberOfLines={1}>
        {label}
      </AppText>
      {description ? (
        <AppText variant="caption" tone="muted" numberOfLines={2}>
          {description}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { minHeight: 112 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
});
