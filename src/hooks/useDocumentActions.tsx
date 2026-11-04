import { router } from 'expo-router';
import { useState } from 'react';


import { ActionSheet, type SheetAction, TextPromptModal } from '@/components/ui';
import { listFolders } from '@/db/foldersRepository';
import { type ToolId, TOOLS } from '@/features/tools';
import { printDocument } from '@/services/share/printService';
import {
  deleteDocument,
  duplicateDocument,
  moveToFolder,
  renameDocument,
  setFavorite,
} from '@/services/library/documentService';
import { createFolder } from '@/services/library/folderService';
import { canSaveToDevice, saveToDevice, shareDocument } from '@/services/share/shareService';
import type { FolderWithCount, ScanDocument } from '@/types/document';
import { errorMessage } from '@/utils/errors';
import { formatBytes, formatPageCount } from '@/utils/format';
import { appAlert, toast } from '@/stores/dialogStore';

/** Creation tools don't take an existing document. */
const DOC_TOOL_EXCLUDE: ToolId[] = ['text-to-pdf'];

type Mode = { kind: 'menu' } | { kind: 'tools' } | { kind: 'rename' } | { kind: 'move'; folders: FolderWithCount[] } | { kind: 'new-folder' };

function report(title: string) {
  return (error: unknown) => appAlert(title, errorMessage(error));
}

/** Confirmation used everywhere a document can be deleted. */
export function confirmDelete(doc: ScanDocument, onDeleted?: () => void) {
  appAlert('Delete document?', `"${doc.name}" will be permanently removed from this device.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        deleteDocument(doc.id)
          .then(onDeleted)
          .catch(report('Could not delete'));
      },
    },
  ]);
}

/**
 * Document context menu (long-press / "more" button) and its follow-up
 * dialogs. Render `elements` once in the screen.
 */
export function useDocumentActions(options: { onDeleted?: () => void; hideOpen?: boolean } = {}) {
  const [doc, setDoc] = useState<ScanDocument | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  const close = () => setMode(null);

  const show = (target: ScanDocument) => {
    setDoc(target);
    setMode({ kind: 'menu' });
  };

  const openMove = async () => {
    try {
      setMode({ kind: 'move', folders: await listFolders() });
    } catch (error) {
      report('Could not load folders')(error);
    }
  };

  const menuActions = (target: ScanDocument): SheetAction[] => [
    ...(options.hideOpen
      ? []
      : [
          {
            key: 'open',
            label: 'Open',
            icon: 'document-text-outline' as const,
            onPress: () => router.push({ pathname: '/document/[id]', params: { id: target.id } }),
          },
        ]),
    { key: 'share', label: 'Share', icon: 'share-outline', onPress: () => shareDocument(target).catch(report('Could not share')) },
    ...(canSaveToDevice
      ? [
          {
            key: 'save',
            label: 'Save to device…',
            icon: 'download-outline' as const,
            hint: 'Choose a folder on your phone',
            onPress: () =>
              saveToDevice(target)
                .then((saved) => saved && toast(`Saved "${target.name}.pdf"`))
                .catch(report('Could not save')),
          },
        ]
      : []),
    {
      key: 'favorite',
      label: target.isFavorite ? 'Remove from favourites' : 'Add to favourites',
      icon: target.isFavorite ? 'star' : 'star-outline',
      onPress: () => setFavorite(target.id, !target.isFavorite).catch(report('Could not update')),
    },
    { key: 'rename', label: 'Rename', icon: 'create-outline', onPress: () => setMode({ kind: 'rename' }) },
    { key: 'tools', label: 'PDF tools…', icon: 'grid-outline', hint: 'Sign, edit, compress, split, convert and more', onPress: () => setMode({ kind: 'tools' }) },
    { key: 'print', label: 'Print', icon: 'print-outline', onPress: () => printDocument(target).catch(report('Could not print')) },
    { key: 'move', label: 'Move to folder', icon: 'folder-open-outline', onPress: openMove },
    {
      key: 'duplicate',
      label: 'Duplicate',
      icon: 'copy-outline',
      onPress: () => duplicateDocument(target.id).catch(report('Could not duplicate')),
    },
    { key: 'delete', label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(target, options.onDeleted) },
  ];

  const toolActions = (target: ScanDocument): SheetAction[] =>
    TOOLS.filter((t) => t.route && t.available && !DOC_TOOL_EXCLUDE.includes(t.id)).map((t) => ({
      key: t.id,
      label: t.label,
      icon: t.icon,
      hint: t.description,
      onPress: () => {
        const [pathname, query] = (t.route as string).split('?');
        const params: Record<string, string> = Object.fromEntries(new URLSearchParams(query ?? ''));
        if (t.id === 'merge') params.ids = target.id;
        else params.id = target.id;
        router.push({ pathname: pathname as never, params });
      },
    }));

  const moveActions = (target: ScanDocument, folders: FolderWithCount[]): SheetAction[] => [
    {
      key: 'root',
      label: 'No folder (All documents)',
      icon: 'documents-outline',
      selected: target.folderId === null,
      onPress: () => moveToFolder(target.id, null).catch(report('Could not move')),
    },
    ...folders.map<SheetAction>((folder) => ({
      key: folder.id,
      label: folder.name,
      icon: 'folder-outline',
      selected: target.folderId === folder.id,
      hint: `${folder.documentCount} ${folder.documentCount === 1 ? 'document' : 'documents'}`,
      onPress: () => moveToFolder(target.id, folder.id).catch(report('Could not move')),
    })),
    { key: 'new', label: 'New folder…', icon: 'add-circle-outline', onPress: () => setMode({ kind: 'new-folder' }) },
  ];

  const elements = doc ? (
    <>
      <ActionSheet
        visible={mode?.kind === 'menu' || mode?.kind === 'move' || mode?.kind === 'tools'}
        title={mode?.kind === 'move' ? `Move "${doc.name}"` : mode?.kind === 'tools' ? 'PDF tools' : doc.name}
        subtitle={mode?.kind === 'menu' ? `${formatPageCount(doc.pageCount)} · ${formatBytes(doc.sizeBytes)}` : mode?.kind === 'tools' ? doc.name : undefined}
        actions={mode?.kind === 'move' ? moveActions(doc, mode.folders) : mode?.kind === 'tools' ? toolActions(doc) : menuActions(doc)}
        onClose={close}
      />
      <TextPromptModal
        visible={mode?.kind === 'rename'}
        title="Rename document"
        initialValue={doc.name}
        onCancel={close}
        onSubmit={async (value) => {
          await renameDocument(doc.id, value);
          close();
        }}
      />
      <TextPromptModal
        visible={mode?.kind === 'new-folder'}
        title="New folder"
        message={`"${doc.name}" will be moved into it.`}
        placeholder="Folder name"
        confirmLabel="Create & move"
        onCancel={close}
        onSubmit={async (value) => {
          const folder = await createFolder(value);
          await moveToFolder(doc.id, folder.id);
          close();
        }}
      />
    </>
  ) : null;

  return { show, elements };
}
