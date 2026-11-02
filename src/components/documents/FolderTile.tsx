import { StyleSheet, View } from 'react-native';

import { AppText, Card, Icon } from '@/components/ui';
import { useAppTheme } from '@/theme';
import type { FolderWithCount } from '@/types/document';

interface FolderTileProps {
  folder: FolderWithCount;
  onPress: () => void;
  onLongPress?: () => void;
}

export function FolderTile({ folder, onPress, onLongPress }: FolderTileProps) {
  const { colors, radius, spacing } = useAppTheme();
  const countLabel = `${folder.documentCount} ${folder.documentCount === 1 ? 'document' : 'documents'}`;
  return (
    <Card
      onPress={onPress}
      onLongPress={onLongPress}
      padded={false}
      accessibilityLabel={`Folder ${folder.name}, ${countLabel}`}
      style={[styles.tile, { padding: spacing.md, gap: spacing.sm }]}
    >
      <View style={[styles.icon, { backgroundColor: colors.primarySoft, borderRadius: radius.sm }]}>
        <Icon name="folder" size={20} color={colors.primary} />
      </View>
      <View>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {folder.name}
        </AppText>
        <AppText variant="caption" tone="muted">
          {countLabel}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { width: 150 },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
