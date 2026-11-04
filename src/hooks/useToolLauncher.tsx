import { router } from 'expo-router';

import type { ToolId } from '@/features/tools';

import { useImportActions } from './useImportActions';
import { useScanFlow } from './useScanFlow';

/**
 * One place that knows how to start every tool, so Home, Tools and document
 * menus behave identically. Render `overlays` once in the screen.
 */
export function useToolLauncher(folderId: string | null = null) {
  const importer = useImportActions(folderId);
  const scanner = useScanFlow();

  const launch = (id: ToolId, documentId?: string) => {
    switch (id) {
      case 'scan':
        scanner.startScan(folderId);
        return;
      case 'import-pdf':
        void importer.importPdf();
        return;
      case 'import-images':
        void importer.importImages();
        return;
      case 'merge':
        router.push({ pathname: '/tool/merge', params: documentId ? { ids: documentId } : {} });
        return;
      case 'split':
      case 'compress':
      case 'organize':
        router.push({ pathname: `/tool/${id}`, params: documentId ? { id: documentId } : {} });
        return;
      default:
        // OCR, annotate and sign are shown as "Soon" and are disabled in the UI.
        return;
    }
  };

  const overlays = (
    <>
      {importer.overlay}
      {scanner.overlay}
    </>
  );

  return { launch, overlays, importer, scanner };
}
