import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PdfViewer } from '@/components/pdf/PdfViewer';
import { ActionSheet, AppText, Button, EmptyState, ErrorState, Icon, IconButton, type IconName, LoadingState, ProgressOverlay, TextPromptModal } from '@/components/ui';
import { getDocument } from '@/db/documentsRepository';
import { useAsyncQuery } from '@/hooks/useAsyncQuery';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { type DocumentSource, useDocumentSources } from '@/hooks/useDocumentSources';
import { useToolLauncher } from '@/hooks/useToolLauncher';
import { tool, type ToolId } from '@/features/tools';
import { mergeDocuments } from '@/services/tools/mergeService';
import type { ScanDocument } from '@/types/document';
import { availableName, deleteDocument, markOpened, recordPageCount } from '@/services/library/documentService';
import { shareDocument } from '@/services/share/shareService';
import { useAppTheme } from '@/theme';
import { errorMessage } from '@/utils/errors';
import { appAlert } from '@/stores/dialogStore';

function BarButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors, radius } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.barButton, { borderRadius: radius.md, opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={21} color={colors.text} />
      <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.barLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Bottom toolbar: add pages (camera / photos / another PDF) and the most used tools. */
function DocumentBar({ doc, onMore }: { doc: ScanDocument; onMore: () => void }) {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const tools = useToolLauncher();
  const sources = useDocumentSources(doc?.folderId ?? null);
  const [addSheet, setAddSheet] = useState(false);
  const [appending, setAppending] = useState(false);

  /** Scan or pick photos, then save "<name> + pages" as a new copy; the original is kept. */
  const addPages = async (source: DocumentSource) => {
    const created = await sources.add(source);
    if (!created?.length) return;
    setAppending(true);
    try {
      const merged = await mergeDocuments([doc, ...created], { name: await availableName(doc.name), folderId: doc.folderId });
      // The scanned/imported pages were only a stepping stone (imported PDFs stay).
      if (source !== 'import') await Promise.all(created.map((c: ScanDocument) => deleteDocument(c.id).catch(() => undefined)));
      router.replace({ pathname: '/document/[id]', params: { id: merged.id } });
    } catch (error) {
      appAlert('Could not add pages', errorMessage(error));
    } finally {
      setAppending(false);
    }
  };

  const quickTools = (['sign', 'edit', 'compress'] as ToolId[]).filter((t) => tool(t).available);

  return (
    <>
      <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingHorizontal: spacing.sm, paddingBottom: insets.bottom + 8 }]}>
        <BarButton icon="add-circle-outline" label="Add pages" onPress={() => setAddSheet(true)} />
        {quickTools.map((t) => (
          <BarButton key={t} icon={tool(t).icon} label={t === 'sign' ? 'Sign' : t === 'edit' ? 'Edit' : 'Compress'} onPress={() => tools.launch(t, doc.id)} />
        ))}
        <BarButton icon="grid-outline" label="More" onPress={onMore} />
      </View>
      <ActionSheet
        visible={addSheet}
        title="Add pages"
        subtitle={`Saved as a new copy of "${doc.name}"`}
        onClose={() => setAddSheet(false)}
        actions={[
          { key: 'scan', label: 'Scan with camera', hint: 'Pages are added at the end', icon: 'scan', onPress: () => addPages('scan') },
          { key: 'photos', label: 'From photos', hint: 'Pick images from your gallery', icon: 'file-image', onPress: () => addPages('photos') },
          { key: 'pdf', label: 'Another PDF', hint: 'Choose and reorder in Merge', icon: 'git-merge', onPress: () => tools.launch('merge', doc.id) },
        ]}
      />
      <ProgressOverlay visible={appending} title="Adding pages" progress={null} />
      {sources.overlay}
      {tools.overlays}
    </>
  );
}

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, radius, spacing } = useAppTheme();
  const query = useAsyncQuery(() => getDocument(id), `doc:${id}`);
  const actions = useDocumentActions({ hideOpen: true, onDeleted: () => router.back() });
  const [page, setPage] = useState<{ current: number; total: number } | null>(null);
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [passwordPrompt, setPasswordPrompt] = useState<'closed' | 'first' | 'retry'>('closed');
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const doc = query.data ?? null;

  useEffect(() => {
    if (id) void markOpened(id).catch(() => undefined);
  }, [id]);

  const header = (
    <Stack.Screen
      options={{
        title: doc?.name ?? '',
        headerRight: doc
          ? () => (
              <View style={styles.headerActions}>
                <IconButton icon="share-outline" label="Share" onPress={() => shareDocument(doc).catch((e) => appAlert('Could not share', errorMessage(e)))} />
                <IconButton icon="ellipsis-horizontal" label="More actions" onPress={() => actions.show(doc)} />
              </View>
            )
          : undefined,
      }}
    />
  );

  if (query.error) return (<>{header}<ErrorState message={query.error} onRetry={query.refresh} /></>);
  if (query.loading && !doc) return (<>{header}<LoadingState label="Opening document…" /></>);
  if (!doc) {
    return (
      <>
        {header}
        <EmptyState icon="document-outline" title="Document not found" message="It may have been deleted." actionLabel="Back to library" onAction={() => router.back()} />
      </>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.surfaceAlt }]}>
      {header}
      {viewerError ? (
        <ErrorState message={`This PDF could not be displayed. ${viewerError}`} onRetry={() => setViewerError(null)} />
      ) : locked ? (
        <EmptyState
          icon="lock-closed-outline"
          title="Password protected"
          message="Enter the password to view this PDF. It is only used on this device to open the file."
          actionLabel="Enter password"
          onAction={() => setPasswordPrompt('first')}
        />
      ) : (
        <PdfViewer
          uri={doc.fileUri}
          password={password}
          onLoadComplete={(count) => {
            setLocked(false);
            setPage((p) => ({ current: p?.current ?? 1, total: count }));
            void recordPageCount(doc, count).catch(() => undefined);
          }}
          onPageChanged={(current, total) => setPage({ current, total })}
          onPasswordRequired={(incorrect) => {
            setLocked(true);
            setPasswordPrompt(incorrect ? 'retry' : 'first');
          }}
          onError={setViewerError}
        />
      )}
      {page && !locked && !viewerError ? (
        <View
          pointerEvents="none"
          style={[styles.pagePill, { backgroundColor: colors.overlay, borderRadius: radius.pill, paddingHorizontal: spacing.md }]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Page ${page.current} of ${page.total}`}
        >
          <AppText variant="caption" color="#FFFFFF">
            {page.current} / {page.total}
          </AppText>
        </View>
      ) : null}
      {!locked && !viewerError ? <DocumentBar doc={doc} onMore={() => actions.show(doc)} /> : null}
      {locked ? (
        <View style={{ padding: spacing.lg }}>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      ) : null}
      <TextPromptModal
        visible={passwordPrompt !== 'closed'}
        title="Enter PDF password"
        message={passwordPrompt === 'retry' ? 'That password was incorrect. Try again.' : `"${doc.name}" is password protected.`}
        confirmLabel="Open"
        secureTextEntry
        onCancel={() => setPasswordPrompt('closed')}
        onSubmit={(value) => {
          setPassword(value);
          setLocked(false);
          setPasswordPrompt('closed');
        }}
      />
      {actions.elements}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  pagePill: { position: 'absolute', bottom: 96, alignSelf: 'center', paddingVertical: 6 },
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  barButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 3 },
  barLabel: { fontSize: 11.5, fontWeight: '500' },
});
