import { router } from 'expo-router';

import { tool, type ToolId } from '@/features/tools';

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
    if (id === 'scan') return scanner.startScan(folderId);
    if (id === 'import-pdf') return void importer.importPdf();
    if (id === 'import-images') return void importer.importImages();
    const def = tool(id);
    if (!def.route || !def.available) return;
    const [pathname, query] = def.route.split('?');
    const params: Record<string, string> = Object.fromEntries(new URLSearchParams(query ?? ''));
    if (documentId) {
      if (id === 'merge') params.ids = documentId;
      else params.id = documentId;
    }
    router.push({ pathname: pathname as never, params });
  };

  const overlays = (
    <>
      {importer.overlay}
      {scanner.overlay}
    </>
  );

  return { launch, overlays, importer, scanner };
}
