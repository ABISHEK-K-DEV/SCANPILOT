import type { IconName } from '@/components/ui';

export type ToolId =
  | 'scan'
  | 'import-pdf'
  | 'import-images'
  | 'merge'
  | 'split'
  | 'compress'
  | 'organize'
  | 'ocr'
  | 'sign'
  | 'annotate';

export interface ToolDefinition {
  id: ToolId;
  label: string;
  description: string;
  icon: IconName;
  /** Whether the tool works in this build. Unavailable tools render disabled with a "Soon" badge. */
  available: boolean;
  milestone: number;
}

/**
 * Single source of truth for the toolbox. Flip `available` to true when the
 * feature ships so the home screen and Tools tab pick it up automatically.
 */
export const TOOLS: readonly ToolDefinition[] = [
  { id: 'scan', label: 'Scan document', description: 'Camera scan with edge detection', icon: 'scan-outline', available: false, milestone: 2 },
  { id: 'import-pdf', label: 'Import PDF', description: 'Add PDFs from your device', icon: 'document-attach-outline', available: true, milestone: 1 },
  { id: 'import-images', label: 'Images to PDF', description: 'Turn photos into a PDF', icon: 'images-outline', available: true, milestone: 1 },
  { id: 'merge', label: 'Merge PDF', description: 'Combine several PDFs', icon: 'git-merge-outline', available: false, milestone: 4 },
  { id: 'split', label: 'Split PDF', description: 'Extract pages or ranges', icon: 'cut-outline', available: false, milestone: 4 },
  { id: 'compress', label: 'Compress PDF', description: 'Reduce file size', icon: 'contract-outline', available: false, milestone: 4 },
  { id: 'organize', label: 'Organise pages', description: 'Reorder, rotate, delete', icon: 'albums-outline', available: false, milestone: 4 },
  { id: 'ocr', label: 'Extract text', description: 'Offline OCR', icon: 'text-outline', available: false, milestone: 5 },
  { id: 'annotate', label: 'Annotate', description: 'Text, highlight, draw', icon: 'brush-outline', available: false, milestone: 5 },
  { id: 'sign', label: 'Sign', description: 'Add your signature', icon: 'pencil-outline', available: false, milestone: 5 },
];

export function tool(id: ToolId): ToolDefinition {
  const found = TOOLS.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown tool ${id}`);
  return found;
}
