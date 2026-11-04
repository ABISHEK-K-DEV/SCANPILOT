import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';


import { LibraryBrowser } from '@/components/documents/LibraryBrowser';
import { ActionSheet, EmptyState, IconButton, LoadingState, Screen, TextPromptModal } from '@/components/ui';
import { useFolder } from '@/hooks/useLibraryQueries';
import { deleteFolder, renameFolder, setFolderLocked } from '@/services/library/folderService';
import { authenticate, canAuthenticate } from '@/services/security/authService';
import { useSecurityStore } from '@/stores/securityStore';
import { errorMessage } from '@/utils/errors';
import { appAlert, toast } from '@/stores/dialogStore';

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const folder = useFolder(id);
  const [mode, setMode] = useState<'menu' | 'rename' | null>(null);
  const unlocked = useSecurityStore((s) => s.unlockedFolders.has(id));
  const unlockFolder = useSecurityStore((s) => s.unlockFolder);
  const isLocked = !!folder.data?.isLocked;

  const openLocked = async () => {
    if (await authenticate(`Open "${folder.data?.name ?? 'folder'}"`)) unlockFolder(id);
  };

  const toggleLock = async () => {
    if (!folder.data) return;
    if (!isLocked) {
      if (!(await canAuthenticate())) {
        appAlert('Set up a screen lock first', 'Locked folders use your fingerprint, face or device PIN. Add one in your phone settings.');
        return;
      }
      if (!(await authenticate('Lock this folder'))) return;
      unlockFolder(id);
      await setFolderLocked(id, true);
      toast('Folder locked · hidden from Home, Files and search');
    } else {
      if (!(await authenticate('Remove the lock'))) return;
      await setFolderLocked(id, false);
    }
  };

  const confirmDelete = () => {
    if (!folder.data) return;
    appAlert('Delete folder?', `"${folder.data.name}" will be removed. Its documents are kept and moved to All documents.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete folder',
        style: 'destructive',
        onPress: () =>
          deleteFolder(id)
            .then(() => router.back())
            .catch((e) => appAlert('Could not delete folder', errorMessage(e))),
      },
    ]);
  };

  return (
    <Screen edges={['left', 'right']} contentStyle={{ paddingHorizontal: 0, paddingTop: 12 }}>
      <Stack.Screen
        options={{
          title: `${isLocked ? '🔒 ' : ''}${folder.data?.name ?? 'Folder'}`,
          headerRight: folder.data ? () => <IconButton icon="ellipsis-horizontal" label="Folder actions" onPress={() => setMode('menu')} /> : undefined,
        }}
      />
      {folder.loading && !folder.data ? (
        <LoadingState />
      ) : !folder.data ? (
        <EmptyState icon="folder-outline" title="Folder not found" message="It may have been deleted." actionLabel="Go back" onAction={() => router.back()} />
      ) : (
        isLocked && !unlocked ? (
          <EmptyState icon="lock-closed" title="This folder is locked" message="Use your fingerprint, face or screen lock to see its documents." actionLabel="Unlock" onAction={() => void openLocked()} />
        ) : (
          <LibraryBrowser folderId={id} />
        )
      )}
      <ActionSheet
        visible={mode === 'menu'}
        title={folder.data?.name}
        onClose={() => setMode(null)}
        actions={[
          { key: 'rename', label: 'Rename folder', icon: 'create-outline', onPress: () => setMode('rename') },
          {
            key: 'lock',
            label: isLocked ? 'Remove lock' : 'Lock folder',
            icon: isLocked ? 'lock-open-outline' : 'lock-closed-outline',
            hint: isLocked ? undefined : 'Hide its documents and require your fingerprint, face or PIN',
            onPress: () => toggleLock().catch((e) => appAlert('Could not change the lock', errorMessage(e))),
          },
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
