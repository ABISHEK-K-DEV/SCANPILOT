import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { DocumentThumbnail } from '@/components/documents/DocumentThumbnail';
import { documentMeta } from '@/components/documents/documentLabels';
import { DocumentSelectModal } from '@/components/tools/DocumentSelectModal';
import { ResultList } from '@/components/tools/ResultList';
import { AppText, Button, Card, EmptyState, IconButton, ProgressOverlay, Screen } from '@/components/ui';
import { getDocument } from '@/db/documentsRepository';
import { importPdfs } from '@/services/import/importService';
import { availableName } from '@/services/library/documentService';
import { mergeDocuments } from '@/services/tools/mergeService';
import { useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';
import { errorMessage, isCancelled } from '@/utils/errors';
import { timestampedName, validateName } from '@/utils/filename';
import { formatBytes } from '@/utils/format';

export default function MergeScreen() {
  const { colors, spacing, radius, typography } = useAppTheme();
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const [docs, setDocs] = useState<ScanDocument[]>([]);
  const [picker, setPicker] = useState(false);
  const [name, setName] = useState(() => timestampedName('Merged'));
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ScanDocument | null>(null);
  const token = useRef({ cancelled: false });

  useEffect(() => {
    if (!ids) return;
    let active = true;
    void Promise.all(ids.split(',').map((id) => getDocument(id))).then((found) => {
      if (active) setDocs(found.filter((d): d is ScanDocument => d !== null));
    });
    return () => {
      active = false;
    };
  }, [ids]);

  const move = (index: number, delta: -1 | 1) =>
    setDocs((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const importMore = async () => {
    setPicker(false);
    try {
      const imported = await importPdfs();
      if (imported?.imported.length) setDocs((prev) => [...prev, ...imported.imported]);
      if (imported?.failed.length) Alert.alert('Some files were not imported', imported.failed.map((f) => `• ${f.name}: ${f.reason}`).join('\n'));
    } catch (error) {
      Alert.alert('Import failed', errorMessage(error));
    }
  };

  const merge = async () => {
    const problem = validateName(name);
    if (problem) {
      Alert.alert('Check the file name', problem);
      return;
    }
    token.current = { cancelled: false };
    setProgress(0);
    try {
      const doc = await mergeDocuments(docs, {
        name: await availableName(name),
        cancelToken: token.current,
        onProgress: (done, total) => setProgress(done / total),
      });
      setResult(doc);
      setDocs([]);
      setName(timestampedName('Merged'));
    } catch (error) {
      if (!isCancelled(error)) Alert.alert('Could not merge', errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  const totalPages = docs.reduce((sum, d) => sum + (d.pageCount ?? 0), 0);
  const totalBytes = docs.reduce((sum, d) => sum + d.sizeBytes, 0);

  return (
    <Screen scroll edges={['left', 'right', 'bottom']} contentStyle={{ paddingTop: spacing.lg, gap: spacing.lg }}>
      <Stack.Screen options={{ title: 'Merge PDFs' }} />
      {result ? <ResultList title="Merged PDF created" docs={[result]} /> : null}

      <View style={{ gap: spacing.sm }}>
        <View style={styles.row}>
          <AppText variant="heading" style={styles.flex}>
            {docs.length === 0 ? 'Choose PDFs to merge' : `${docs.length} PDFs · in this order`}
          </AppText>
          {docs.length > 0 ? <Button label="Add" icon="add" variant="ghost" compact onPress={() => setPicker(true)} /> : null}
        </View>
        {docs.length === 0 ? (
          <Card>
            <EmptyState
              compact
              icon="git-merge-outline"
              title="Combine several PDFs into one"
              message="Pick two or more documents. You can change their order before merging; the originals are kept."
              actionLabel="Select PDFs"
              onAction={() => setPicker(true)}
            />
          </Card>
        ) : (
          docs.map((doc, index) => (
            <Card key={doc.id} padded={false} style={[styles.row, { padding: spacing.sm, gap: spacing.sm }]}>
              <AppText variant="label" tone="subtle" style={styles.index}>
                {index + 1}
              </AppText>
              <DocumentThumbnail doc={doc} width={40} height={52} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {doc.name}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {documentMeta(doc)}
                </AppText>
              </View>
              <IconButton icon="chevron-up" label={`Move ${doc.name} up`} disabled={index === 0} onPress={() => move(index, -1)} size={20} />
              <IconButton icon="chevron-down" label={`Move ${doc.name} down`} disabled={index === docs.length - 1} onPress={() => move(index, 1)} size={20} />
              <IconButton icon="close" label={`Remove ${doc.name}`} onPress={() => setDocs((prev) => prev.filter((d) => d.id !== doc.id))} size={20} />
            </Card>
          ))
        )}
      </View>

      {docs.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label" tone="subtle">
            OUTPUT FILE NAME
          </AppText>
          <TextInput
            value={name}
            onChangeText={setName}
            accessibilityLabel="Output file name"
            style={[
              typography.body,
              styles.input,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
            ]}
          />
          <AppText variant="caption" tone="muted">
            {totalPages > 0 ? `${totalPages} pages · ` : ''}about {formatBytes(totalBytes)}
          </AppText>
        </View>
      ) : null}

      {docs.length > 0 ? (
        <Button
          label={docs.length < 2 ? 'Add at least one more PDF' : `Merge ${docs.length} PDFs`}
          icon="git-merge-outline"
          fullWidth
          disabled={docs.length < 2}
          onPress={() => void merge()}
        />
      ) : null}

      <DocumentSelectModal
        visible={picker}
        title="Select PDFs to merge"
        multiple
        excludeIds={docs.map((d) => d.id)}
        onClose={() => setPicker(false)}
        onImport={() => void importMore()}
        onSelect={(picked) => {
          setDocs((prev) => [...prev, ...picked]);
          setPicker(false);
          setResult(null);
        }}
      />
      <ProgressOverlay
        visible={progress !== null}
        title="Merging PDFs"
        progress={progress}
        onCancel={() => {
          token.current.cancelled = true;
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  index: { width: 18, textAlign: 'center' },
  input: { minHeight: 48, borderWidth: 1 },
});
