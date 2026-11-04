import { getDatabase } from './database';

/** OCR text per document page, used for library search and re-export. */
export async function saveDocumentText(documentId: string, pages: readonly string[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM document_text WHERE document_id = ?', [documentId]);
    for (let i = 0; i < pages.length; i += 1) {
      await db.runAsync('INSERT INTO document_text (document_id, page, text) VALUES (?, ?, ?)', [documentId, i, pages[i]]);
    }
  });
}

export async function getDocumentText(documentId: string): Promise<string[] | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ page: number; text: string }>('SELECT page, text FROM document_text WHERE document_id = ? ORDER BY page', [documentId]);
  return rows.length > 0 ? rows.map((r) => r.text) : null;
}
