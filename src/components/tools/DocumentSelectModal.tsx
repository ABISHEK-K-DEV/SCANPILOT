import { useDeferredValue, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentThumbnail } from '@/components/documents/DocumentThumbnail';
import { documentMeta } from '@/components/documents/documentLabels';
import { AppText, Button, EmptyState, ErrorState, Icon, IconButton, LoadingState, SearchField } from '@/components/ui';
import { type DocumentSource, useDocumentSources } from '@/hooks/useDocumentSources';
import { useDocuments } from '@/hooks/useLibraryQueries';
import { useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';

import { SourceButtons } from './DocumentSources';

interface DocumentSelectModalProps {
  visible: boolean;
  title: string;
  /** Multi-select shows checkboxes and a Done button; single-select returns on tap. */
  multiple?: boolean;
  excludeIds?: readonly string[];
  onClose: () => void;
  onSelect: (docs: ScanDocument[]) => void;
}

export function DocumentSelectModal(props: DocumentSelectModalProps) {
  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose} presentationStyle="fullScreen">
      {props.visible ? <SelectBody {...props} /> : null}
    </Modal>
  );
}

function SelectBody({ title, multiple = false, excludeIds = [], onClose, onSelect }: DocumentSelectModalProps) {
  const { colors, spacing, radius } = useAppTheme();
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search);
  const [picked, setPicked] = useState<ScanDocument[]>([]);
  const docs = useDocuments({ search: deferred, sort: { field: 'date', direction: 'desc' } });
  const available = (docs.data ?? []).filter((d) => !excludeIds.includes(d.id));
  const isPicked = (doc: ScanDocument) => picked.some((p) => p.id === doc.id);
  const sources = useDocumentSources();

  // New documents from the camera / import / photos are selected straight away.
  const addNew = async (source: DocumentSource) => {
    const created = await sources.add(source);
    if (!created?.length) return;
    if (!multiple) {
      onSelect([created[0]]);
      return;
    }
    setPicked((prev) => [...prev, ...created.filter((c) => !prev.some((p) => p.id === c.id))]);
    docs.refresh();
  };

  const toggle = (doc: ScanDocument) => {
    if (!multiple) {
      onSelect([doc]);
      return;
    }
    setPicked((prev) => (prev.some((p) => p.id === doc.id) ? prev.filter((p) => p.id !== doc.id) : [...prev, doc]));
  };

  let empty;
  if (docs.error) empty = <ErrorState message={docs.error} onRetry={docs.refresh} />;
  else if (!docs.data) empty = <LoadingState />;
  else
    empty = (
      <EmptyState
        icon="documents-outline"
        title={deferred ? 'No matches' : 'No PDFs available'}
        message={deferred ? `No documents match "${deferred}".` : 'Scan with the camera, import a PDF or turn photos into a PDF using the buttons above.'}
      />
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingHorizontal: spacing.sm }]}>
        <IconButton icon="close" label="Close" onPress={onClose} />
        <AppText variant="heading" style={styles.flex} numberOfLines={1}>
          {title}
        </AppText>
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
        <SourceButtons onPick={(s) => void addNew(s)} disabled={sources.busy} />
        <SearchField value={search} onChangeText={setSearch} placeholder="Search your library" />
        <AppText variant="label" tone="subtle">
          YOUR LIBRARY
        </AppText>
      </View>
      <FlatList
        data={available}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.sm, flexGrow: 1 }}
        ListEmptyComponent={empty}
        renderItem={({ item }) => {
          const selected = isPicked(item);
          const order = picked.findIndex((p) => p.id === item.id);
          return (
            <Pressable
              onPress={() => toggle(item)}
              accessibilityRole={multiple ? 'checkbox' : 'button'}
              accessibilityState={multiple ? { checked: selected } : undefined}
              accessibilityLabel={`${item.name}, ${documentMeta(item)}`}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.sm,
                  gap: spacing.md,
                },
              ]}
            >
              <DocumentThumbnail doc={item} width={44} height={56} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {documentMeta(item)}
                </AppText>
              </View>
              {multiple ? (
                <View
                  style={[
                    styles.check,
                    { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' },
                  ]}
                >
                  {selected ? (
                    <AppText variant="label" color={colors.onPrimary}>
                      {order + 1}
                    </AppText>
                  ) : null}
                </View>
              ) : (
                <Icon name="chevron-forward" size={18} color={colors.textSubtle} />
              )}
            </Pressable>
          );
        }}
      />
      {multiple ? (
        <View style={[styles.footer, { padding: spacing.lg, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Button
            label={picked.length === 0 ? 'Select PDFs' : `Add ${picked.length} ${picked.length === 1 ? 'PDF' : 'PDFs'}`}
            fullWidth
            disabled={picked.length === 0}
            onPress={() => onSelect(picked)}
          />
        </View>
      ) : null}
      {sources.overlay}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth },
});
