import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ActionSheet, Button, EmptyState, ErrorState, IconButton, ListGroup, ListRow, LoadingState, Screen, TextPromptModal } from '@/components/ui';
import { useFolders } from '@/hooks/useLibraryQueries';
import { createFolder, deleteFolder, renameFolder } from '@/services/library/folderService';
import { useAppTheme } from '@/theme';
import type { FolderWithCount } from '@/types/document';
import { errorMessage } from '@/utils/errors';
import { appAlert } from '@/stores/dialogStore';

type Mode = { kind: 'create' } | { kind: 'menu'; folder: FolderWithCount } | { kind: 'rename'; folder: FolderWithCount } | null;

export default function FoldersScreen() {
  const { spacing } = useAppTheme();
  const folders = useFolders();
  const [mode, setMode] = useState<Mode>(null);

  const confirmDelete = (folder: FolderWithCount) =>
    appAlert('Delete folder?', `"${folder.name}" will be removed. Its ${folder.documentCount} document(s) are kept.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete folder', style: 'destructive', onPress: () => deleteFolder(folder.id).catch((e) => appAlert('Could not delete', errorMessage(e))) },
    ]);

  let body;
  if (folders.error) body = <ErrorState message={folders.error} onRetry={folders.refresh} />;
  else if (!folders.data) body = <LoadingState />;
  else if (folders.data.length === 0)
    body = (
      <EmptyState
        icon="folder-open-outline"
        title="No folders yet"
        message="Folders help you group receipts, IDs, notes and more."
        actionLabel="Create folder"
        onAction={() => setMode({ kind: 'create' })}
      />
    );
  else
    body = (
      <View style={{ gap: spacing.lg }}>
        <ListGroup>
          {folders.data.map((folder) => (
            <ListRow
              key={folder.id}
              icon={folder.isLocked ? 'lock-closed' : 'folder'}
              title={folder.name}
              subtitle={folder.isLocked ? 'Locked · needs fingerprint, face or PIN' : `${folder.documentCount} ${folder.documentCount === 1 ? 'document' : 'documents'}`}
              onPress={() => router.push({ pathname: '/folder/[id]', params: { id: folder.id } })}
              trailing={<IconButton icon="ellipsis-horizontal" label={`Actions for ${folder.name}`} onPress={() => setMode({ kind: 'menu', folder })} />}
              showChevron={false}
            />
          ))}
        </ListGroup>
        <Button label="New folder" icon="add" variant="secondary" onPress={() => setMode({ kind: 'create' })} />
      </View>
    );

  return (
    <Screen scroll edges={['left', 'right']} contentStyle={{ paddingTop: spacing.lg }}>
      <Stack.Screen options={{ headerRight: () => <IconButton icon="add" label="New folder" onPress={() => setMode({ kind: 'create' })} /> }} />
      {body}
      <ActionSheet
        visible={mode?.kind === 'menu'}
        title={mode?.kind === 'menu' ? mode.folder.name : undefined}
        onClose={() => setMode(null)}
        actions={
          mode?.kind === 'menu'
            ? [
                { key: 'rename', label: 'Rename', icon: 'create-outline', onPress: () => setMode({ kind: 'rename', folder: mode.folder }) },
                { key: 'delete', label: 'Delete folder', icon: 'trash-outline', destructive: true, hint: 'Documents are kept', onPress: () => confirmDelete(mode.folder) },
              ]
            : []
        }
      />
      <TextPromptModal
        visible={mode?.kind === 'create'}
        title="New folder"
        placeholder="Folder name"
        confirmLabel="Create"
        onCancel={() => setMode(null)}
        onSubmit={async (value) => {
          await createFolder(value);
          setMode(null);
        }}
      />
      <TextPromptModal
        visible={mode?.kind === 'rename'}
        title="Rename folder"
        initialValue={mode?.kind === 'rename' ? mode.folder.name : ''}
        onCancel={() => setMode(null)}
        onSubmit={async (value) => {
          if (mode?.kind === 'rename') await renameFolder(mode.folder.id, value);
          setMode(null);
        }}
      />
    </Screen>
  );
}
