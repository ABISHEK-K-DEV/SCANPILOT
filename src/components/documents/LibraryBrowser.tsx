import { router } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionSheet,
  AppText,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  SearchField,
  TextPromptModal,
} from '@/components/ui';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { useImportActions } from '@/hooks/useImportActions';
import { useDocuments, useFolders } from '@/hooks/useLibraryQueries';
import { useScanFlow } from '@/hooks/useScanFlow';
import { createFolder } from '@/services/library/folderService';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppTheme } from '@/theme';
import type { SortOption } from '@/types/document';

import { DocumentCollection } from './DocumentCollection';
import { FolderTile } from './FolderTile';
import { SORT_CHOICES, sortLabel } from './sortOptions';

interface LibraryBrowserProps {
  /** Undefined = every document; a string = only that folder. */
  folderId?: string;
  title?: string;
  initialSearch?: string;
  autoFocusSearch?: boolean;
}

type Sheet = 'sort' | 'add' | 'new-folder' | null;

export function LibraryBrowser({ folderId, title, initialSearch = '', autoFocusSearch }: LibraryBrowserProps) {
  const { spacing } = useAppTheme();
  const viewMode = useSettingsStore((s) => s.settings.viewMode);
  const sort = useSettingsStore((s) => s.settings.sort);
  const updateSetting = useSettingsStore((s) => s.update);
  const [search, setSearch] = useState(initialSearch);
  const deferredSearch = useDeferredValue(search);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  const documents = useDocuments({ search: deferredSearch, folderId, favoritesOnly, sort });
  const folders = useFolders();
  const actions = useDocumentActions();
  const importer = useImportActions(folderId ?? null);
  const scanner = useScanFlow();
  const showFolders = folderId === undefined && deferredSearch.trim().length === 0 && !favoritesOnly;

  const setSort = (value: SortOption) => void updateSetting('sort', value);

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
      <View style={styles.titleRow}>
        {title ? (
          <AppText variant="display" numberOfLines={1} style={styles.flex}>
            {title}
          </AppText>
        ) : (
          <View style={styles.flex} />
        )}
        <IconButton icon="swap-vertical" label={`Sort: ${sortLabel(sort)}`} onPress={() => setSheet('sort')} />
        <IconButton
          icon={viewMode === 'grid' ? 'list' : 'grid'}
          label={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
          onPress={() => void updateSetting('viewMode', viewMode === 'grid' ? 'list' : 'grid')}
        />
        <IconButton icon="add" label="Add documents" filled onPress={() => setSheet('add')} />
      </View>
      <SearchField value={search} onChangeText={setSearch} autoFocus={autoFocusSearch} />
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Chip label="All" selected={!favoritesOnly} onPress={() => setFavoritesOnly(false)} />
        <Chip label="Favourites" icon="star" selected={favoritesOnly} onPress={() => setFavoritesOnly(true)} />
        <View style={styles.flex} />
        <AppText variant="caption" tone="subtle">
          {sortLabel(sort)}
        </AppText>
      </View>
      {showFolders && folders.data && folders.data.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <View style={styles.titleRow}>
            <AppText variant="heading" style={styles.flex}>
              Folders
            </AppText>
            <Chip label="Manage" onPress={() => router.push('/folders')} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingVertical: 2 }}>
            {folders.data.map((folder) => (
              <FolderTile key={folder.id} folder={folder} onPress={() => router.push({ pathname: '/folder/[id]', params: { id: folder.id } })} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      {documents.data && documents.data.length > 0 ? (
        <AppText variant="heading">{showFolders ? 'Documents' : `${documents.data.length} ${documents.data.length === 1 ? 'result' : 'results'}`}</AppText>
      ) : null}
    </View>
  );

  let empty;
  if (documents.error) empty = <ErrorState message={documents.error} onRetry={documents.refresh} />;
  else if (!documents.data) empty = <LoadingState />;
  else if (deferredSearch.trim()) empty = <EmptyState icon="search" title="No matches" message={`No documents match "${deferredSearch.trim()}".`} />;
  else if (favoritesOnly)
    empty = <EmptyState icon="star-outline" title="No favourites yet" message="Use a document's ⋮ menu to add it to your favourites." />;
  else
    empty = (
      <EmptyState
        icon="documents-outline"
        title={folderId ? 'This folder is empty' : 'No documents yet'}
        message={folderId ? 'Scan or import files here, or move documents into this folder.' : 'Scan a document, import a PDF or turn photos into a PDF to get started.'}
        actionLabel="Scan document"
        onAction={() => scanner.startScan(folderId ?? null)}
      />
    );

  return (
    <>
      <DocumentCollection
        documents={documents.data ?? []}
        viewMode={viewMode}
        onMore={actions.show}
        header={header}
        empty={empty}
        refreshing={false}
        onRefresh={documents.refresh}
      />
      <ActionSheet
        visible={sheet === 'sort'}
        title="Sort by"
        onClose={() => setSheet(null)}
        actions={SORT_CHOICES.map((choice) => ({
          key: choice.key,
          label: choice.label,
          icon: 'swap-vertical',
          selected: choice.sort.field === sort.field && choice.sort.direction === sort.direction,
          onPress: () => setSort(choice.sort),
        }))}
      />
      <ActionSheet
        visible={sheet === 'add'}
        title="Add to library"
        onClose={() => setSheet(null)}
        actions={[
          { key: 'scan', label: 'Scan document', icon: 'scan-outline', onPress: () => scanner.startScan(folderId ?? null) },
          { key: 'pdf', label: 'Import PDF', icon: 'document-attach-outline', onPress: importer.importPdf },
          { key: 'images', label: 'Images to PDF', icon: 'images-outline', onPress: importer.importImages },
          ...(folderId === undefined
            ? [{ key: 'folder', label: 'New folder', icon: 'folder-open-outline' as const, onPress: () => setSheet('new-folder') }]
            : []),
        ]}
      />
      <TextPromptModal
        visible={sheet === 'new-folder'}
        title="New folder"
        placeholder="Folder name"
        confirmLabel="Create"
        onCancel={() => setSheet(null)}
        onSubmit={async (value) => {
          await createFolder(value);
          setSheet(null);
        }}
      />
      {actions.elements}
      {importer.overlay}
      {scanner.overlay}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
