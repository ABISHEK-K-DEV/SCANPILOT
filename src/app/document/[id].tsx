import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { PdfViewer } from '@/components/pdf/PdfViewer';
import { AppText, Button, EmptyState, ErrorState, IconButton, LoadingState, TextPromptModal } from '@/components/ui';
import { getDocument } from '@/db/documentsRepository';
import { useAsyncQuery } from '@/hooks/useAsyncQuery';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { markOpened, recordPageCount } from '@/services/library/documentService';
import { shareDocument } from '@/services/share/shareService';
import { useAppTheme } from '@/theme';
import { errorMessage } from '@/utils/errors';

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
                <IconButton icon="share-outline" label="Share" onPress={() => shareDocument(doc).catch((e) => Alert.alert('Could not share', errorMessage(e)))} />
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
  pagePill: { position: 'absolute', bottom: 24, alignSelf: 'center', paddingVertical: 6 },
});
