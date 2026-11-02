import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';

import { useLibraryStore } from '@/stores/libraryStore';
import { errorMessage } from '@/utils/errors';

export interface QueryState<T> {
  data: T | undefined;
  /** True while the latest request is in flight (previous data stays visible). */
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface Result<T> {
  requestKey: string;
  data: T | undefined;
  error: string | null;
}

/**
 * Runs `fetcher` whenever `key` changes, the library revision changes, the
 * screen regains focus, or `refresh()` is called. Responses from superseded
 * requests are ignored.
 */
export function useAsyncQuery<T>(fetcher: () => Promise<T>, key: string): QueryState<T> {
  const revision = useLibraryStore((state) => state.revision);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const requestKey = `${key}|${revision}|${nonce}`;
  const load = useEffectEvent(() => fetcher());

  useEffect(() => {
    let active = true;
    load().then(
      (data) => {
        if (active) setResult({ requestKey, data, error: null });
      },
      (error: unknown) => {
        if (active) {
          setResult((previous) => ({
            requestKey,
            data: previous?.data,
            error: errorMessage(error, 'Could not load your documents.'),
          }));
        }
      },
    );
    return () => {
      active = false;
    };
  }, [requestKey]);

  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      // The first focus coincides with mount, which already loads.
      if (focusedBefore.current) setNonce((n) => n + 1);
      focusedBefore.current = true;
    }, []),
  );

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: result?.data,
    loading: result?.requestKey !== requestKey,
    error: result?.requestKey === requestKey ? result.error : null,
    refresh,
  };
}
