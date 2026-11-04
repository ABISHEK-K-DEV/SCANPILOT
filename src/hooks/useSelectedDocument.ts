import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { getDocument } from '@/db/documentsRepository';
import type { ScanDocument } from '@/types/document';

import { useAsyncQuery } from './useAsyncQuery';

/** Document chosen via the `id` route param or, later, via a picker. */
export function useSelectedDocument() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [chosenId, setChosenId] = useState<string | null>(id ?? null);
  const query = useAsyncQuery(() => (chosenId ? getDocument(chosenId) : Promise.resolve(null)), `tool-doc:${chosenId ?? ''}`);
  return { doc: chosenId ? (query.data ?? null) : null, loading: !!chosenId && query.loading && !query.data, choose: (doc: ScanDocument) => setChosenId(doc.id) };
}
