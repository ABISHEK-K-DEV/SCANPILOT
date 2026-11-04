import { StyleSheet, View } from 'react-native';

import { DocumentThumbnail } from '@/components/documents/DocumentThumbnail';
import { documentMeta } from '@/components/documents/documentLabels';
import { AppText, Button, Card } from '@/components/ui';
import { useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';

export function SelectedDocumentCard({ doc, onChange }: { doc: ScanDocument; onChange?: () => void }) {
  const { spacing } = useAppTheme();
  return (
    <Card padded={false} style={[styles.row, { padding: spacing.md, gap: spacing.md }]}>
      <DocumentThumbnail doc={doc} width={52} height={68} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {doc.name}
        </AppText>
        <AppText variant="caption" tone="muted">
          {documentMeta(doc)}
        </AppText>
      </View>
      {onChange ? <Button label="Change" variant="ghost" compact onPress={onChange} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
