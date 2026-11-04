import { router } from 'expo-router';
import { useRef, useState } from 'react';


import { ProgressOverlay } from '@/components/ui';
import { type ImportCallbacks, importImagesAsPdf, importPdfs } from '@/services/import/importService';
import { errorMessage, isCancelled } from '@/utils/errors';
import { appAlert } from '@/stores/dialogStore';

interface ProgressState {
  title: string;
  completed: number;
  total: number;
}

/**
 * Import flows with a cancellable progress overlay. The overlay appears only
 * after the user has picked files. Render `overlay` once in the screen.
 */
export function useImportActions(folderId: string | null = null) {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const token = useRef({ cancelled: false });

  const callbacksFor = (title: string): ImportCallbacks => {
    token.current = { cancelled: false };
    return {
      cancelToken: token.current,
      folderId,
      onStart: (total) => setProgress({ title, completed: 0, total }),
      onProgress: (completed, total) => setProgress({ title, completed, total }),
    };
  };

  const importPdf = async () => {
    try {
      const result = await importPdfs(callbacksFor('Importing PDFs'));
      setProgress(null);
      if (!result) return;
      if (result.failed.length > 0) {
        appAlert(
          result.imported.length > 0 ? 'Some files were not imported' : 'Import failed',
          result.failed.map((f) => `• ${f.name}: ${f.reason}`).join('\n'),
        );
      }
      if (result.imported.length === 1 && result.failed.length === 0) {
        router.push({ pathname: '/document/[id]', params: { id: result.imported[0].id } });
      }
    } catch (error) {
      setProgress(null);
      if (!isCancelled(error)) appAlert('Import failed', errorMessage(error));
    }
  };

  const importImages = async () => {
    try {
      const doc = await importImagesAsPdf(callbacksFor('Creating PDF from images'));
      setProgress(null);
      if (doc) router.push({ pathname: '/document/[id]', params: { id: doc.id } });
    } catch (error) {
      setProgress(null);
      if (!isCancelled(error)) appAlert('Could not create PDF', errorMessage(error));
    }
  };

  const overlay = (
    <ProgressOverlay
      visible={progress !== null}
      title={progress?.title ?? ''}
      progress={progress && progress.total > 0 ? progress.completed / progress.total : null}
      detail={progress && progress.total > 0 ? `${progress.completed} of ${progress.total}` : undefined}
      onCancel={() => {
        token.current.cancelled = true;
      }}
    />
  );

  return { importPdf, importImages, overlay, busy: progress !== null };
}
