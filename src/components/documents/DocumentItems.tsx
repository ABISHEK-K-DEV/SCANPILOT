import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, IconButton } from '@/components/ui';
import { useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';
import { formatDate } from '@/utils/format';

import { documentAccessibilityLabel, documentMeta } from './documentLabels';
import { DocumentThumbnail } from './DocumentThumbnail';

interface ItemProps {
  doc: ScanDocument;
  onPress: (doc: ScanDocument) => void;
  onMore: (doc: ScanDocument) => void;
}

function TypeTag() {
  const { colors, radius } = useAppTheme();
  return (
    <View style={[styles.tag, { backgroundColor: colors.dangerSoft, borderRadius: radius.sm / 2 }]}>
      <AppText variant="label" color={colors.danger} style={styles.tagText}>
        PDF
      </AppText>
    </View>
  );
}

export function DocumentGridItem({ doc, onPress, onMore, width }: ItemProps & { width: number }) {
  const { colors, radius, spacing } = useAppTheme();
  const thumbWidth = width - spacing.sm * 2;
  return (
    <Pressable
      onPress={() => onPress(doc)}
      onLongPress={() => onMore(doc)}
      accessibilityRole="button"
      accessibilityLabel={documentAccessibilityLabel(doc)}
      accessibilityHint="Opens the document. Long press for more actions."
      style={({ pressed }) => [
        styles.grid,
        {
          width,
          padding: spacing.sm,
          borderRadius: radius.lg,
          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View>
        <DocumentThumbnail doc={doc} width={thumbWidth} height={thumbWidth * 1.3} />
        <View style={[styles.gridBadges, { gap: 4 }]}>
          <TypeTag />
          {doc.isFavorite ? (
            <View style={[styles.star, { backgroundColor: colors.surface }]}>
              <Icon name="star" size={12} color={colors.warning} />
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.gridFooter}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {doc.name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {documentMeta(doc)}
          </AppText>
          <AppText variant="caption" tone="subtle" numberOfLines={1}>
            {formatDate(doc.updatedAt)}
          </AppText>
        </View>
        <IconButton icon="ellipsis-vertical" size={18} label={`More actions for ${doc.name}`} onPress={() => onMore(doc)} style={styles.more} />
      </View>
    </Pressable>
  );
}

export function DocumentListItem({ doc, onPress, onMore }: ItemProps) {
  const { colors, radius, spacing } = useAppTheme();
  return (
    <Pressable
      onPress={() => onPress(doc)}
      onLongPress={() => onMore(doc)}
      accessibilityRole="button"
      accessibilityLabel={documentAccessibilityLabel(doc)}
      accessibilityHint="Opens the document. Long press for more actions."
      style={({ pressed }) => [
        styles.list,
        {
          padding: spacing.sm,
          gap: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <DocumentThumbnail doc={doc} width={52} height={66} />
      <View style={[styles.flex, { gap: 2 }]}>
        <View style={styles.titleRow}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>
            {doc.name}
          </AppText>
          {doc.isFavorite ? <Icon name="star" size={14} color={colors.warning} /> : null}
        </View>
        <View style={[styles.titleRow, { gap: 6 }]}>
          <TypeTag />
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {documentMeta(doc)}
          </AppText>
        </View>
        <AppText variant="caption" tone="subtle" numberOfLines={1}>
          {formatDate(doc.updatedAt)}
        </AppText>
      </View>
      <IconButton icon="ellipsis-vertical" size={18} label={`More actions for ${doc.name}`} onPress={() => onMore(doc)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { borderWidth: StyleSheet.hairlineWidth },
  gridBadges: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center' },
  star: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gridFooter: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  more: { marginRight: -8, marginTop: -6 },
  list: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { paddingHorizontal: 5, paddingVertical: 1 },
  tagText: { fontSize: 10, lineHeight: 13 },
});
