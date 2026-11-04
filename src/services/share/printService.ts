import { printAsync } from 'expo-print';

import type { ScanDocument } from '@/types/document';

/** Opens the system print dialog (also offers "Save as PDF" / nearby printers). */
export async function printDocument(doc: ScanDocument): Promise<void> {
  await printAsync({ uri: doc.fileUri });
}
