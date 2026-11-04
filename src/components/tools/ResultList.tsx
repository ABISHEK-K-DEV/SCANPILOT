import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DocumentThumbnail } from '@/components/documents/DocumentThumbnail';
import { documentMeta } from '@/components/documents/documentLabels';
import { AppText, Card, IconButton } from '@/components/ui';
import { shareDocument } from '@/services/share/shareService';
import { useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';
import { errorMessage } from '@/utils/errors';
import { appAlert } from '@/stores/dialogStore';

/** Created documents with Open / Share actions, shown after a tool finishes. */
export function ResultList({ title, docs }: { title: string; docs: ScanDocument[] }) {
  const { colors, spacing } = useAppTheme();
  return (
    <View style={{ gap: spacing.sm }} accessibilityLiveRegion="polite">
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={[styles.dot, { backgroundColor: colors.successSoft }]}>
          <AppText variant="label" tone="success">
            ✓
          </AppText>
        </View>
        <AppText variant="heading">{title}</AppText>
      </View>
      {docs.map((doc) => (
        <Card key={doc.id} padded={false} style={[styles.row, { padding: spacing.sm, gap: spacing.md }]}>
          <DocumentThumbnail doc={doc} width={40} height={52} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {doc.name}
            </AppText>
            <AppText variant="caption" tone="muted">
              {documentMeta(doc)}
            </AppText>
          </View>
          <IconButton icon="share-outline" label={`Share ${doc.name}`} onPress={() => shareDocument(doc).catch((e) => appAlert('Could not share', errorMessage(e)))} />
          <IconButton icon="open-outline" label={`Open ${doc.name}`} onPress={() => router.push({ pathname: '/document/[id]', params: { id: doc.id } })} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
