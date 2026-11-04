import { router } from 'expo-router';
import { useState } from 'react';


import { ProgressOverlay } from '@/components/ui';
import { ScannerError } from '@/native/scanner';
import { filterImage } from '@/services/scan/pageProcessing';
import { capturePages, type IngestCallbacks, pickPages } from '@/services/scan/scanService';
import type { ScanPage } from '@/services/scan/types';
import type { ScanMode } from '@/services/scan/modes';
import { useScanSession } from '@/stores/scanSessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { errorMessage } from '@/utils/errors';
import { appAlert } from '@/stores/dialogStore';

interface Progress {
  title: string;
  completed: number;
  total: number;
}

export type AddMode = 'append' | 'after-selected' | { replace: string };

/**
 * Starts and extends scan sessions. Used by Home/Files/Tools ("Scan document")
 * and by the review screen ("Add pages", "Retake"). Render `overlay` once.
 */
export function useScanFlow() {
  const [progress, setProgress] = useState<Progress | null>(null);

  const callbacks = (title: string): IngestCallbacks => ({
    onStart: (total) => setProgress({ title, completed: 0, total }),
    onProgress: (completed, total) => setProgress({ title, completed, total }),
  });

  const apply = (pages: ScanPage[], mode: AddMode) => {
    const session = useScanSession.getState();
    if (typeof mode === 'object') {
      const [first] = pages;
      if (!first) return;
      // Retake: the new capture becomes both the page and its new original.
      session.update(mode.replace, {
        uri: first.uri,
        width: first.width,
        height: first.height,
        originalUri: first.originalUri,
        originalWidth: first.originalWidth,
        originalHeight: first.originalHeight,
        base: first.base,
        filter: first.filter,
      });
      session.select(mode.replace);
    } else {
      session.add(pages, mode === 'after-selected');
    }
  };

  const offerPhotosInstead = (message: string, mode: AddMode, navigate: boolean) => {
    appAlert('Scanner unavailable', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose photos', onPress: () => void addFromPhotos(mode, navigate) },
    ]);
  };

  async function addFromPhotos(mode: AddMode = 'append', navigate = false): Promise<void> {
    try {
      const pages = await pickPages({ single: typeof mode === 'object', ...callbacks('Adding photos') });
      setProgress(null);
      if (!pages) return;
      apply(pages, mode);
      if (navigate) router.push('/scan/review');
    } catch (error) {
      setProgress(null);
      appAlert('Could not add photos', errorMessage(error));
    }
  }

  /**
   * The system scanner runs in its basic mode (camera + crop), so camera pages
   * start with ScanPilot's "Auto enhance". The untouched capture is kept as the
   * page's base, so Filter → Original restores it.
   */
  async function autoEnhance(pages: ScanPage[]): Promise<ScanPage[]> {
    const out: ScanPage[] = [];
    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i];
      setProgress({ title: 'Enhancing pages', completed: i, total: pages.length });
      try {
        const result = await filterImage(page.uri, 'auto');
        out.push({ ...page, ...result, base: { uri: page.uri, width: page.width, height: page.height }, filter: 'auto' });
      } catch {
        out.push(page);
      }
    }
    return out;
  }

  async function capture(mode: AddMode = 'append', navigate = false, scanMode?: ScanMode): Promise<void> {
    // ScanPilot's own camera screen (default). It adds pages to the session itself.
    if (useSettingsStore.getState().settings.scanner === 'camera') {
      const params: Record<string, string> =
        typeof mode === 'object' ? { mode: 'replace', replace: mode.replace } : { mode: navigate ? 'new' : 'append', ...(scanMode ? { scanMode } : {}) };
      router.push({ pathname: '/scan/camera', params });
      return;
    }
    try {
      const pages = await capturePages({ maxPages: typeof mode === 'object' ? 1 : undefined, ...callbacks('Preparing pages') });
      if (!pages) {
        setProgress(null);
        return;
      }
      apply(await autoEnhance(pages), mode);
      setProgress(null);
      if (navigate) router.push('/scan/review');
    } catch (error) {
      setProgress(null);
      if (error instanceof ScannerError && error.reason === 'unavailable') offerPhotosInstead(error.message, mode, navigate);
      else appAlert('Scan failed', errorMessage(error));
    }
  }

  /** Begins a brand-new scan session and opens the review screen when pages arrive. */
  /** Begins a new scan; `scanMode` preselects Whiteboard / Book / ID card / Business card. */
  const startScan = (folderId: string | null = null, scanMode?: ScanMode) => {
    useScanSession.getState().start(folderId);
    void capture('append', true, scanMode);
  };

  const startFromPhotos = (folderId: string | null = null) => {
    useScanSession.getState().start(folderId);
    void addFromPhotos('append', true);
  };

  const overlay = (
    <ProgressOverlay
      visible={progress !== null}
      title={progress?.title ?? ''}
      progress={progress && progress.total > 0 ? progress.completed / progress.total : null}
      detail={progress && progress.total > 0 ? `Page ${Math.min(progress.completed + 1, progress.total)} of ${progress.total}` : undefined}
    />
  );

  return { startScan, startFromPhotos, capture, addFromPhotos, overlay };
}
