import { create } from 'zustand';

import { deleteFileQuietly, deleteSessionFiles } from '@/services/scan/pageProcessing';
import {
  insertPages,
  movePage,
  orphanedFiles,
  removePage,
  replacePage,
  selectionAfterRemove,
} from '@/services/scan/sessionReducer';
import type { DocumentPreset, ScanPage } from '@/services/scan/types';
import { timestampedName } from '@/utils/filename';

interface ScanSessionState {
  pages: ScanPage[];
  selectedId: string | null;
  preset: DocumentPreset;
  name: string;
  /** Folder the finished PDF will be saved into. */
  folderId: string | null;
  start: (folderId?: string | null) => void;
  add: (pages: ScanPage[], afterSelected?: boolean) => void;
  select: (id: string) => void;
  remove: (id: string) => void;
  move: (id: string, delta: number) => void;
  update: (id: string, patch: Partial<ScanPage>) => void;
  setPreset: (preset: DocumentPreset) => void;
  setName: (name: string) => void;
  /** Ends the session and deletes all its temporary images. */
  clear: () => void;
}

/** Deletes files that the change made unreachable (edited-away versions, removed pages). */
function cleanup(previous: ScanPage[], next: ScanPage[]): void {
  orphanedFiles(previous, next).forEach(deleteFileQuietly);
}

export const useScanSession = create<ScanSessionState>((set, get) => ({
  pages: [],
  selectedId: null,
  preset: 'original',
  name: '',
  folderId: null,
  start: (folderId = null) => {
    deleteSessionFiles();
    set({ pages: [], selectedId: null, preset: 'original', name: timestampedName('Scan'), folderId });
  },
  add: (added, afterSelected = false) => {
    const { pages, selectedId } = get();
    const index = afterSelected && selectedId ? pages.findIndex((p) => p.id === selectedId) : undefined;
    set({ pages: insertPages(pages, added, index), selectedId: added[0]?.id ?? selectedId });
  },
  select: (id) => set({ selectedId: id }),
  remove: (id) => {
    const { pages } = get();
    const next = removePage(pages, id);
    cleanup(pages, next);
    set({ pages: next, selectedId: selectionAfterRemove(pages, id) });
  },
  move: (id, delta) => set({ pages: movePage(get().pages, id, delta) }),
  update: (id, patch) => {
    const { pages } = get();
    const next = replacePage(pages, id, patch);
    cleanup(pages, next);
    set({ pages: next });
  },
  setPreset: (preset) => set({ preset }),
  setName: (name) => set({ name }),
  clear: () => {
    deleteSessionFiles();
    set({ pages: [], selectedId: null, preset: 'original', name: '', folderId: null });
  },
}));
