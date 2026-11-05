import type { IconName } from '@/components/ui';

/**
 * "How it works" guides shown the first time a tool is opened (and from the
 * ? button). Each guide has an animated demo kind and three short steps.
 */
export type DemoKind =
  | 'scan'
  | 'whiteboard'
  | 'book'
  | 'id-card'
  | 'business-card'
  | 'merge'
  | 'split'
  | 'organize'
  | 'compress'
  | 'sign'
  | 'edit'
  | 'redact'
  | 'watermark'
  | 'numbers'
  | 'protect'
  | 'unlock'
  | 'ocr'
  | 'convert'
  | 'images'
  | 'rotate'
  | 'crop'
  | 'repair'
  | 'text';

export interface GuideStep {
  icon: IconName;
  title: string;
  text: string;
}

export interface ToolGuide {
  id: string;
  title: string;
  tagline: string;
  demo: DemoKind;
  /** Short file-type label for convert demos (DOCX, PPTX, …). */
  badge?: string;
  steps: [GuideStep, GuideStep, GuideStep];
}

const pick: GuideStep = { icon: 'folder-open-outline', title: 'Choose a PDF', text: 'From your library — or scan, import or use photos right here.' };

export const TOOL_GUIDES: Record<string, ToolGuide> = {
  camera: {
    id: 'camera',
    title: 'Scanning with ScanPilot',
    tagline: 'Pick a mode, frame the page, tap the shutter.',
    demo: 'scan',
    steps: [
      { icon: 'scan', title: 'Choose a mode', text: 'Document, Whiteboard, Book, ID card or Business card — the frame adapts.' },
      { icon: 'camera', title: 'Capture pages', text: 'Keep the page inside the frame. Edges are found and straightened for you.' },
      { icon: 'checkmark-circle-outline', title: 'Review and save', text: 'Tap Done to reorder, crop, apply filters and save your PDF.' },
    ],
  },
  scan: {
    id: 'scan',
    title: 'Scan a document',
    tagline: 'Paper to a clean PDF in seconds.',
    demo: 'scan',
    steps: [
      { icon: 'camera', title: 'Point the camera', text: 'Hold the phone above the page and fit it inside the frame.' },
      { icon: 'crop-outline', title: 'Edges are found', text: 'ScanPilot crops and straightens each page automatically.' },
      { icon: 'color-wand-outline', title: 'Enhance and save', text: 'Pick a filter, reorder pages, then save as a PDF.' },
    ],
  },
  'scan-whiteboard': {
    id: 'scan-whiteboard',
    title: 'Whiteboard',
    tagline: 'Glare-free boards with bright marker colours.',
    demo: 'whiteboard',
    steps: [
      { icon: 'whiteboard', title: 'Frame the whole board', text: 'Stand straight in front of it; a slight angle is fine.' },
      { icon: 'sparkles', title: 'Glare is removed', text: 'Shadows and reflections fade, the board turns white.' },
      { icon: 'save-outline', title: 'Save or share', text: 'Keep the notes as a PDF or share them with the class.' },
    ],
  },
  'scan-book': {
    id: 'scan-book',
    title: 'Book',
    tagline: 'Two open pages, split automatically.',
    demo: 'book',
    steps: [
      { icon: 'book', title: 'Open the book flat', text: 'Fit both pages in the frame, spine in the middle.' },
      { icon: 'cut-outline', title: 'Split in two', text: 'Each photo becomes a left page and a right page.' },
      { icon: 'albums-outline', title: 'Keep turning', text: 'Capture as many spreads as you like, then tap Done.' },
    ],
  },
  'scan-id-card': {
    id: 'scan-id-card',
    title: 'ID card',
    tagline: 'Both sides on one A4 page, at real size.',
    demo: 'id-card',
    steps: [
      { icon: 'id-card', title: 'Scan the front', text: 'Place the card on a dark surface and fit it in the frame.' },
      { icon: 'refresh', title: 'Flip and scan the back', text: 'ScanPilot asks for the back straight after the front.' },
      { icon: 'print-outline', title: 'Ready to print', text: 'Both sides are saved together on one A4 page.' },
    ],
  },
  'scan-business-card': {
    id: 'scan-business-card',
    title: 'Business card',
    tagline: 'Scan a card, save it as a contact.',
    demo: 'business-card',
    steps: [
      { icon: 'contact', title: 'Scan the card', text: 'Fit the card in the frame; a plain background helps.' },
      { icon: 'scan-text', title: 'Details are read', text: 'Name, phone, email and website are found on your phone.' },
      { icon: 'person', title: 'Save the contact', text: 'Open the Contact tab and tap Save contact.' },
    ],
  },
  'import-images': {
    id: 'import-images',
    title: 'JPG to PDF',
    tagline: 'Turn photos into one tidy PDF.',
    demo: 'images',
    steps: [
      { icon: 'images', title: 'Pick photos', text: 'Select one or many pictures from your gallery, in order.' },
      { icon: 'albums-outline', title: 'One page per photo', text: 'Each photo becomes a page, in the order you chose.' },
      { icon: 'save-outline', title: 'Saved to your library', text: 'Open, share or keep editing the new PDF.' },
    ],
  },
  'text-to-pdf': {
    id: 'text-to-pdf',
    title: 'Text to PDF',
    tagline: 'Type or paste — get a clean PDF.',
    demo: 'text',
    steps: [
      { icon: 'text-outline', title: 'Write or paste', text: 'Any language, including Hindi and other scripts.' },
      { icon: 'document-text-outline', title: 'Pick a layout', text: 'Choose the page size and font size.' },
      { icon: 'save-outline', title: 'Create the PDF', text: 'It is saved to your library on this phone.' },
    ],
  },
  merge: {
    id: 'merge',
    title: 'Merge PDF',
    tagline: 'Combine several PDFs into one.',
    demo: 'merge',
    steps: [
      { icon: 'add-circle-outline', title: 'Add PDFs', text: 'Choose two or more documents — or scan and import new ones.' },
      { icon: 'swap-vertical', title: 'Set the order', text: 'Move documents up or down; that is the page order.' },
      { icon: 'git-merge', title: 'Merge', text: 'A new combined PDF is created. Originals are kept.' },
    ],
  },
  split: {
    id: 'split',
    title: 'Split PDF',
    tagline: 'Break a PDF into smaller files.',
    demo: 'split',
    steps: [
      pick,
      { icon: 'list', title: 'Choose how', text: 'By page ranges (1-3, 4-6), extract chosen pages, or every page.' },
      { icon: 'cut', title: 'Split', text: 'New PDFs appear in your library. The original is kept.' },
    ],
  },
  'extract-pages': {
    id: 'extract-pages',
    title: 'Extract pages',
    tagline: 'Copy chosen pages into a new PDF.',
    demo: 'split',
    steps: [
      pick,
      { icon: 'list', title: 'Type the pages', text: 'For example 2, 5-7. A preview shows what you will get.' },
      { icon: 'copy-outline', title: 'Extract', text: 'The selected pages become a new PDF.' },
    ],
  },
  organize: {
    id: 'organize',
    title: 'Organise pages',
    tagline: 'Reorder, rotate, duplicate and delete.',
    demo: 'organize',
    steps: [
      pick,
      { icon: 'checkbox', title: 'Select pages', text: 'Tap pages to select them; use the toolbar to move or rotate.' },
      { icon: 'save-outline', title: 'Save', text: 'Save as a new copy, or replace the original.' },
    ],
  },
  'remove-pages': {
    id: 'remove-pages',
    title: 'Remove pages',
    tagline: 'Delete pages you do not need.',
    demo: 'organize',
    steps: [
      pick,
      { icon: 'checkbox', title: 'Select pages', text: 'Tap the pages you want to remove.' },
      { icon: 'trash-outline', title: 'Delete and save', text: 'Tap Delete, then save as a new copy.' },
    ],
  },
  rotate: {
    id: 'rotate',
    title: 'Rotate PDF',
    tagline: 'Turn every page the right way up.',
    demo: 'rotate',
    steps: [pick, { icon: 'refresh', title: 'Choose the angle', text: '90° left, 90° right or 180°.' }, { icon: 'save-outline', title: 'Save', text: 'A rotated copy is created.' }],
  },
  crop: {
    id: 'crop',
    title: 'Crop PDF',
    tagline: 'Trim margins from every page.',
    demo: 'crop',
    steps: [pick, { icon: 'crop', title: 'Set the margins', text: 'Watch the live preview as you adjust.' }, { icon: 'save-outline', title: 'Crop', text: 'A trimmed copy is saved.' }],
  },
  compress: {
    id: 'compress',
    title: 'Compress PDF',
    tagline: 'Make big scans small enough to send.',
    demo: 'compress',
    steps: [
      pick,
      { icon: 'contract', title: 'Pick a level', text: 'Low, medium or high — estimated sizes are shown.' },
      { icon: 'checkmark-circle-outline', title: 'Compress', text: 'A smaller copy is created. Your original stays as it is.' },
    ],
  },
  repair: {
    id: 'repair',
    title: 'Repair PDF',
    tagline: 'Fix PDFs that will not open properly.',
    demo: 'repair',
    steps: [pick, { icon: 'construct', title: 'Rebuild', text: 'ScanPilot rewrites the file structure on your phone.' }, { icon: 'save-outline', title: 'Use the copy', text: 'A repaired copy is added to your library.' }],
  },
  edit: {
    id: 'edit',
    title: 'Edit PDF',
    tagline: 'Text, drawings, highlights, shapes and images.',
    demo: 'edit',
    steps: [
      pick,
      { icon: 'brush-outline', title: 'Pick a tool', text: 'Text, pen, highlighter, box, arrow, image or whiteout.' },
      { icon: 'save-outline', title: 'Save', text: 'Undo anything, then save an edited copy.' },
    ],
  },
  sign: {
    id: 'sign',
    title: 'Sign PDF',
    tagline: 'Draw once, sign anything.',
    demo: 'sign',
    steps: [
      pick,
      { icon: 'signature', title: 'Draw your signature', text: 'It is saved on this phone for next time.' },
      { icon: 'hand-left-outline', title: 'Place and save', text: 'Drag it into place, add a date, then save a signed copy.' },
    ],
  },
  watermark: {
    id: 'watermark',
    title: 'Watermark',
    tagline: 'Stamp text across every page.',
    demo: 'watermark',
    steps: [pick, { icon: 'water', title: 'Type the text', text: 'Choose position, size and transparency.' }, { icon: 'save-outline', title: 'Apply', text: 'A watermarked copy is created.' }],
  },
  'page-numbers': {
    id: 'page-numbers',
    title: 'Page numbers',
    tagline: 'Number every page neatly.',
    demo: 'numbers',
    steps: [pick, { icon: 'list', title: 'Pick a style', text: 'Position, format (1, Page 1, 1 of 10) and start number.' }, { icon: 'save-outline', title: 'Apply', text: 'A numbered copy is created.' }],
  },
  redact: {
    id: 'redact',
    title: 'Redact PDF',
    tagline: 'Remove private information for good.',
    demo: 'redact',
    steps: [
      pick,
      { icon: 'eye-off', title: 'Draw boxes', text: 'Drag over account numbers, addresses or faces.' },
      { icon: 'shield-checkmark-outline', title: 'Burned in', text: 'Redacted pages are flattened, so the text is really gone.' },
    ],
  },
  ocr: {
    id: 'ocr',
    title: 'Extract text',
    tagline: 'Copy text from photos, scans and PDFs.',
    demo: 'ocr',
    steps: [
      { icon: 'camera', title: 'Camera, photos or PDF', text: 'Choose where the text comes from and the language.' },
      { icon: 'scan-text', title: 'Text is recognised', text: 'Runs on your phone — nothing is uploaded.' },
      { icon: 'create-outline', title: 'Edit, copy, export', text: 'Fix any word, then copy, share as .txt, Word or a searchable PDF.' },
    ],
  },
  'pdf-to-word': {
    id: 'pdf-to-word',
    title: 'PDF to Word',
    tagline: 'Editable text as a .docx file.',
    demo: 'convert',
    badge: 'DOCX',
    steps: [pick, { icon: 'scan-text', title: 'Text is read', text: 'Each page is recognised on your phone.' }, { icon: 'share-outline', title: 'Open in Word', text: 'Share or save the .docx file.' }],
  },
  'pdf-to-ppt': {
    id: 'pdf-to-ppt',
    title: 'PDF to PowerPoint',
    tagline: 'Every page becomes a slide.',
    demo: 'convert',
    badge: 'PPTX',
    steps: [pick, { icon: 'presentation-outline', title: 'Slides are made', text: 'Pages are rendered sharply and placed on slides.' }, { icon: 'share-outline', title: 'Present', text: 'Share or save the .pptx file.' }],
  },
  'pdf-to-excel': {
    id: 'pdf-to-excel',
    title: 'PDF to Excel',
    tagline: 'Tables to rows and columns.',
    demo: 'convert',
    badge: 'XLSX',
    steps: [pick, { icon: 'sheet', title: 'Tables are rebuilt', text: 'Text is read and lined up into rows and columns.' }, { icon: 'share-outline', title: 'Open in Excel', text: 'One sheet per page; numbers are real numbers.' }],
  },
  'pdf-to-images': {
    id: 'pdf-to-images',
    title: 'PDF to JPG',
    tagline: 'Every page as an image.',
    demo: 'convert',
    badge: 'JPG',
    steps: [pick, { icon: 'image', title: 'Pick a quality', text: 'Standard, high or maximum resolution.' }, { icon: 'download-outline', title: 'Save or share', text: 'Save the images to a folder or share them as a ZIP.' }],
  },
  protect: {
    id: 'protect',
    title: 'Protect PDF',
    tagline: 'Lock a PDF with a password.',
    demo: 'protect',
    steps: [pick, { icon: 'lock-closed', title: 'Set a password', text: 'Type it twice. Strong AES-256 encryption is used.' }, { icon: 'shield-checkmark-outline', title: 'Share safely', text: 'Only people with the password can open the copy.' }],
  },
  unlock: {
    id: 'unlock',
    title: 'Unlock PDF',
    tagline: 'Remove a password you know.',
    demo: 'unlock',
    steps: [pick, { icon: 'lock-open', title: 'Enter the password', text: 'It is only used on this phone.' }, { icon: 'save-outline', title: 'Save', text: 'An unlocked copy is created.' }],
  },
};

/** The guide for the current route (pathname + params), e.g. /tool/pdf-to-office?format=pptx → pdf-to-ppt. */
export function guideForRoute(pathname: string, params: Record<string, string | string[] | undefined>): ToolGuide | null {
  const p = (k: string) => (Array.isArray(params[k]) ? params[k]?.[0] : params[k]) as string | undefined;
  if (pathname === '/scan/camera') {
    const mode = p('scanMode');
    if (mode && TOOL_GUIDES[`scan-${mode}`]) return TOOL_GUIDES[`scan-${mode}`];
    return p('mode') === 'replace' ? null : TOOL_GUIDES.camera;
  }
  if (!pathname.startsWith('/tool/')) return null;
  const name = pathname.slice('/tool/'.length);
  if (name === 'ocr') return p('output') === 'word' ? TOOL_GUIDES['pdf-to-word'] : TOOL_GUIDES.ocr;
  if (name === 'pdf-to-office') return p('format') === 'xlsx' ? TOOL_GUIDES['pdf-to-excel'] : TOOL_GUIDES['pdf-to-ppt'];
  if (name === 'split' && p('mode') === 'extract') return TOOL_GUIDES['extract-pages'];
  return TOOL_GUIDES[name] ?? null;
}
