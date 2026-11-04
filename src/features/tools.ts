import { Platform } from 'react-native';

import type { IconName } from '@/components/ui';

export type ToolId =
  | 'scan'
  | 'import-pdf'
  | 'import-images'
  | 'text-to-pdf'
  | 'merge'
  | 'split'
  | 'organize'
  | 'rotate'
  | 'crop'
  | 'compress'
  | 'repair'
  | 'edit'
  | 'sign'
  | 'watermark'
  | 'page-numbers'
  | 'redact'
  | 'ocr'
  | 'pdf-to-word'
  | 'pdf-to-images'
  | 'protect'
  | 'unlock';

export type ToolCategory = 'create' | 'organise' | 'optimise' | 'edit' | 'convert' | 'security';

export interface ToolDefinition {
  id: ToolId;
  label: string;
  description: string;
  icon: IconName;
  category: ToolCategory;
  /** Route for tools with their own screen; scan/import tools run inline. */
  route?: string;
  /** Unavailable tools render disabled with a "Soon" badge. */
  available: boolean;
}

/** Tools that render pages natively (Android PdfRenderer / ML Kit in modules/scanpilot-native). */
const NATIVE = Platform.OS === 'android' || process.env.EXPO_PUBLIC_SCANPILOT_DEMO === '1';

export const CATEGORIES: readonly { id: ToolCategory; label: string }[] = [
  { id: 'create', label: 'Scan & create' },
  { id: 'organise', label: 'Organise' },
  { id: 'edit', label: 'Edit & sign' },
  { id: 'convert', label: 'Convert' },
  { id: 'optimise', label: 'Optimise' },
  { id: 'security', label: 'Security' },
];

export const TOOLS: readonly ToolDefinition[] = [
  { id: 'scan', label: 'Scan document', description: 'Camera scan with edge detection', icon: 'scan', category: 'create', available: true },
  { id: 'import-images', label: 'JPG to PDF', description: 'Turn photos into a PDF', icon: 'images', category: 'create', available: true },
  { id: 'import-pdf', label: 'Import PDF', description: 'Add PDFs from your phone', icon: 'document-attach', category: 'create', available: true },
  { id: 'text-to-pdf', label: 'Text to PDF', description: 'Write or paste text, any language', icon: 'create', category: 'create', route: '/tool/text-to-pdf', available: true },
  { id: 'merge', label: 'Merge PDF', description: 'Combine several PDFs', icon: 'git-merge', category: 'organise', route: '/tool/merge', available: true },
  { id: 'split', label: 'Split PDF', description: 'Ranges, pages or every page', icon: 'cut', category: 'organise', route: '/tool/split', available: true },
  { id: 'organize', label: 'Organise pages', description: 'Reorder, rotate, delete', icon: 'albums', category: 'organise', route: '/tool/organize', available: true },
  { id: 'rotate', label: 'Rotate PDF', description: 'Turn all pages at once', icon: 'refresh', category: 'organise', route: '/tool/rotate', available: true },
  { id: 'crop', label: 'Crop PDF', description: 'Trim page margins', icon: 'crop', category: 'organise', route: '/tool/crop', available: true },
  { id: 'edit', label: 'Edit PDF', description: 'Text, draw, highlight, shapes', icon: 'brush', category: 'edit', route: '/tool/edit', available: NATIVE },
  { id: 'sign', label: 'Sign PDF', description: 'Draw and place your signature', icon: 'pencil', category: 'edit', route: '/tool/sign', available: NATIVE },
  { id: 'watermark', label: 'Watermark', description: 'Stamp text across pages', icon: 'water', category: 'edit', route: '/tool/watermark', available: true },
  { id: 'page-numbers', label: 'Page numbers', description: 'Number every page', icon: 'list', category: 'edit', route: '/tool/page-numbers', available: true },
  { id: 'redact', label: 'Redact PDF', description: 'Permanently black out info', icon: 'eye-off', category: 'edit', route: '/tool/redact', available: NATIVE },
  { id: 'ocr', label: 'Extract text', description: 'Offline OCR · English & Hindi', icon: 'text', category: 'convert', route: '/tool/ocr', available: NATIVE },
  { id: 'pdf-to-word', label: 'PDF to Word', description: 'Editable text as .docx', icon: 'document-text', category: 'convert', route: '/tool/ocr?output=word', available: NATIVE },
  { id: 'pdf-to-images', label: 'PDF to JPG', description: 'Every page as an image', icon: 'image', category: 'convert', route: '/tool/pdf-to-images', available: NATIVE },
  { id: 'compress', label: 'Compress PDF', description: 'Make files smaller', icon: 'contract', category: 'optimise', route: '/tool/compress', available: NATIVE },
  { id: 'repair', label: 'Repair PDF', description: 'Fix damaged files', icon: 'construct', category: 'optimise', route: '/tool/repair', available: true },
  { id: 'protect', label: 'Protect PDF', description: 'Add a password', icon: 'lock-closed', category: 'security', route: '/tool/protect', available: true },
  { id: 'unlock', label: 'Unlock PDF', description: 'Remove a password', icon: 'lock-open', category: 'security', route: '/tool/unlock', available: true },
];

/** Shown on the home screen. */
export const POPULAR: readonly ToolId[] = ['merge', 'compress', 'split', 'sign', 'edit', 'ocr', 'pdf-to-images', 'protect', 'watermark'];

export function tool(id: ToolId): ToolDefinition {
  const found = TOOLS.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown tool ${id}`);
  return found;
}

export function searchTools(query: string): ToolDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...TOOLS];
  return TOOLS.filter((t) => `${t.label} ${t.description} ${t.category}`.toLowerCase().includes(q));
}
