import { create } from 'zustand';

/**
 * In-app dialogs and toasts, replacing the platform `Alert` everywhere so
 * confirmations look and behave like the rest of ScanPilot.
 *
 *   appAlert('Discard this scan?', '3 pages will be deleted.', [
 *     { text: 'Keep editing', style: 'cancel' },
 *     { text: 'Discard', style: 'destructive', onPress: discard },
 *   ]);
 *   toast('Copied to clipboard');
 *
 * `appAlert` mirrors `Alert.alert`'s signature so call sites read the same.
 */
export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export type DialogTone = 'info' | 'danger' | 'error' | 'success' | 'question';

export interface DialogRequest {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  tone: DialogTone;
}

export interface ToastRequest {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'error';
}

interface DialogState {
  queue: DialogRequest[];
  toast: ToastRequest | null;
  push: (dialog: DialogRequest) => void;
  dismiss: (id: number) => void;
  showToast: (toast: ToastRequest) => void;
  hideToast: (id: number) => void;
}

let nextId = 1;

export const useDialogStore = create<DialogState>((set) => ({
  queue: [],
  toast: null,
  push: (dialog) => set((s) => ({ queue: [...s.queue, dialog] })),
  dismiss: (id) => set((s) => ({ queue: s.queue.filter((d) => d.id !== id) })),
  showToast: (toast) => set({ toast }),
  hideToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : s)),
}));

const ERROR_TITLE = /fail|could not|couldn.t|error|wrong|unavailable|not available|incorrect|invalid/i;

export function inferTone(title: string, buttons: readonly DialogButton[]): DialogTone {
  if (buttons.some((b) => b.style === 'destructive')) return 'danger';
  if (ERROR_TITLE.test(title)) return 'error';
  if (buttons.length > 1) return 'question';
  return 'info';
}

export function appAlert(title: string, message?: string, buttons?: DialogButton[], options: { tone?: DialogTone } = {}): void {
  const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  useDialogStore.getState().push({ id: nextId++, title, message, buttons: list, tone: options.tone ?? inferTone(title, list) });
}

/** Promise-based confirmation; resolves true for the confirming button. */
export function confirmDialog(options: { title: string; message?: string; confirmLabel: string; cancelLabel?: string; destructive?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    appAlert(options.title, options.message, [
      { text: options.cancelLabel ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: options.confirmLabel, style: options.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

export function toast(message: string, tone: ToastRequest['tone'] = 'success'): void {
  useDialogStore.getState().showToast({ id: nextId++, message, tone });
}
