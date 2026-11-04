import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { ProgressOverlay } from '@/components/ui';
import { ScannerError } from '@/native/scanner';
import { importImagesAsPdf, importPdfs } from '@/services/import/importService';
import { availableName } from '@/services/library/documentService';
import { filterImage } from '@/services/scan/pageProcessing';
import { capturePages, savePagesAsPdf } from '@/services/scan/scanService';
import type { ScanPage } from '@/services/scan/types';
import type { ScanDocument } from '@/types/document';
import { errorMessage, isCancelled } from '@/utils/errors';
import { timestampedName } from '@/utils/filename';

export type DocumentSource = 'scan' | 'import' | 'photos';

interface Busy {
  title: string;
  completed: number;
  total: number;
}

/**
 * Brings a new document into the library *without leaving the current screen*:
 * camera scan (saved straight to PDF), PDF import, or photos → PDF.
 * Used wherever a document is chosen (tool pickers, empty states) so the camera
 * and import are always one tap away. Render `overlay` once.
 */
export function useDocumentSources(folderId: string | null = null) {
  const [busy, setBusy] = useState<Busy | null>(null);
  const token = useRef({ cancelled: false });

  const callbacks = (title: string) => {
    token.current = { cancelled: false };
    return {
      cancelToken: token.current,
      folderId,
      onStart: (total: number) => setBusy({ title, completed: 0, total }),
      onProgress: (completed: number, total: number) => setBusy({ title, completed, total }),
    };
  };

  async function fromPhotos(): Promise<ScanDocument[] | null> {
    try {
      const doc = await importImagesAsPdf(callbacks('Creating PDF from photos'));
      return doc ? [doc] : null;
    } catch (error) {
      if (!isCancelled(error)) Alert.alert('Could not create PDF', errorMessage(error));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function fromImport(): Promise<ScanDocument[] | null> {
    try {
      const result = await importPdfs(callbacks('Importing PDFs'));
      if (!result) return null;
      if (result.failed.length > 0) {
        Alert.alert(
          result.imported.length > 0 ? 'Some files were not imported' : 'Import failed',
          result.failed.map((f) => `• ${f.name}: ${f.reason}`).join('\n'),
        );
      }
      return result.imported.length > 0 ? result.imported : null;
    } catch (error) {
      if (!isCancelled(error)) Alert.alert('Import failed', errorMessage(error));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function fromScan(): Promise<ScanDocument[] | null> {
    try {
      const pages = await capturePages(callbacks('Preparing pages'));
      if (!pages || pages.length === 0) return null;
      // This path skips the review screen, so apply ScanPilot's auto-enhance here.
      const enhanced: ScanPage[] = [];
      for (let i = 0; i < pages.length; i += 1) {
        setBusy({ title: 'Enhancing pages', completed: i, total: pages.length });
        try {
          enhanced.push({ ...pages[i], ...(await filterImage(pages[i].uri, 'auto')) });
        } catch {
          enhanced.push(pages[i]);
        }
      }
      const cb = callbacks('Creating PDF');
      setBusy({ title: 'Creating PDF', completed: 0, total: pages.length + 1 });
      const doc = await savePagesAsPdf(enhanced, {
        name: await availableName(timestampedName('Scan')),
        preset: 'original',
        folderId,
        cancelToken: cb.cancelToken,
        onProgress: cb.onProgress,
      });
      return [doc];
    } catch (error) {
      if (isCancelled(error)) return null;
      if (error instanceof ScannerError && error.reason === 'unavailable') {
        setBusy(null);
        return new Promise((resolve) => {
          Alert.alert('Scanner unavailable', error.message, [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
            { text: 'Choose photos', onPress: () => void fromPhotos().then(resolve) },
          ]);
        });
      }
      Alert.alert('Scan failed', errorMessage(error));
      return null;
    } finally {
      setBusy(null);
    }
  }

  const add = (source: DocumentSource) => (source === 'scan' ? fromScan() : source === 'import' ? fromImport() : fromPhotos());

  const overlay = (
    <ProgressOverlay
      visible={busy !== null}
      title={busy?.title ?? ''}
      progress={busy && busy.total > 0 ? busy.completed / busy.total : null}
      detail={busy && busy.total > 1 ? `${Math.min(busy.completed + 1, busy.total)} of ${busy.total}` : undefined}
      onCancel={() => {
        token.current.cancelled = true;
      }}
    />
  );

  return { add, overlay, busy: busy !== null };
}
