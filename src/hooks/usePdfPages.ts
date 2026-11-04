import { useEffect, useRef, useState } from 'react';

import { getPdfRenderer } from '@/native/pdfRenderer';
import { createWorkDir, type WorkDir } from '@/services/storage/fileStore';
import type { ScanDocument } from '@/types/document';
import { errorMessage } from '@/utils/errors';

export interface PdfPages {
  pageCount: number | null;
  /** Displayed width / height per page. */
  aspects: number[];
  images: Record<number, string>;
  error: string | null;
  supported: boolean;
  /** Renders a page if not yet rendered (no-op otherwise). */
  ensure: (index: number) => void;
}

/** Renders pages of a PDF on demand for the editors (Android PdfRenderer). */
export function usePdfPages(doc: ScanDocument | null, dpi = 130): PdfPages {
  const renderer = getPdfRenderer();
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [aspects, setAspects] = useState<number[]>([]);
  const [images, setImages] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(new Set<number>());
  const dir = useRef<WorkDir | null>(null);

  useEffect(() => {
    if (!doc || !renderer) return;
    let active = true;
    requested.current = new Set();
    const d = createWorkDir('edit');
    dir.current = d;
    renderer
      .getInfo(doc.fileUri)
      .then((info) => {
        if (!active) return;
        setPageCount(info.pageCount);
        setAspects(info.pageSizes.map(([w, h]) => w / h));
        setImages({});
      })
      .catch((e: unknown) => active && setError(errorMessage(e)));
    return () => {
      active = false;
      setTimeout(d.remove, 2000);
    };
  }, [doc, renderer]);

  const ensure = (index: number) => {
    if (!doc || !renderer || !dir.current || pageCount === null || index < 0 || index >= pageCount) return;
    if (requested.current.has(index)) return;
    requested.current.add(index);
    renderer
      .renderPage(doc.fileUri, index, { dpi, quality: 0.85, maxEdge: 1800, outputUri: dir.current.fileUri(`${index}.jpg`) })
      .then((page) => setImages((prev) => ({ ...prev, [index]: page.uri })))
      .catch((e: unknown) => {
        requested.current.delete(index);
        setError(errorMessage(e));
      });
  };

  return { pageCount, aspects, images, error, supported: renderer !== null, ensure };
}
