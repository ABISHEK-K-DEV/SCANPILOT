import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { LibraryBrowser } from '@/components/documents/LibraryBrowser';
import { ActionSheet, EmptyState, IconButton, LoadingState, Screen, TextPromptModal } from '@/components/ui';
import { useFolder } from '@/hooks/useLibraryQueries';
import { deleteFolder, renameFolder } from '@/services/library/folderService';
import { errorMessage } from '@/utils/errors';

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const folder = useFolder(id);
  const [mode, setMode] = useState<'menu' | 'rename' | null>(null);

  const confirmDelete = () => {
    if (!folder.data) return;
    Alert.alert('Delete folder?', `"${folder.data.name}" will be removed. Its documents are kept and moved to All documents.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete folder',
        style: 'destructive',
        onPress: () =>
          deleteFolder(id)
            .then(() => router.back())
            .catch((e) => Alert.alert('Could not delete folder', errorMessage(e))),
      },
    ]);
  };

  return (
    <Screen edges={['left', 'right']} contentStyle={{ paddingHorizontal: 0, paddingTop: 12 }}>
      <Stack.Screen
        options={{
          title: folder.data?.name ?? 'Folder',
          headerRight: folder.data ? () => <IconButton icon="ellipsis-horizontal" label="Folder actions" onPress={() => setMode('menu')} /> : undefined,
        }}
      />
      {folder.loading && !folder.data ? (
        <LoadingState />
      ) : !folder.data ? (
        <EmptyState icon="folder-outline" title="Folder not found" message="It may have been deleted." actionLabel="Go back" onAction={() => router.back()} />
      ) : (
        <LibraryBrowser folderId={id} />
      )}
      <ActionSheet
        visible={mode === 'menu'}
        title={folder.data?.name}
        onClose={() => setMode(null)}
        actions={[
          { key: 'rename', label: 'Rename folder', icon: 'create-outline', onPress: () => setMode('rename') },
          { key: 'delete', label: 'Delete folder', icon: 'trash-outline', destructive: true, hint: 'Documents are kept', onPress: confirmDelete },
        ]}
      />
      <TextPromptModal
        visible={mode === 'rename'}
        title="Rename folder"
        initialValue={folder.data?.name}
        onCancel={() => setMode(null)}
        onSubmit={async (value) => {
          await renameFolder(id, value);
          setMode(null);
        }}
      />
    </Screen>
  );
}
