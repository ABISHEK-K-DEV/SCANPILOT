import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router as mockRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '@/app/(tabs)/index';
import ScanReviewScreen from '@/app/scan/review';
import { capturePages, savePagesAsPdf } from '@/services/scan/scanService';
import type { ScanPage } from '@/services/scan/types';
import { useDialogStore } from '@/stores/dialogStore';
import { useScanSession } from '@/stores/scanSessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { DEFAULT_SETTINGS } from '@/types/settings';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, []);
  },
  usePreventRemove: () => jest.fn(),
  Stack: { Screen: () => null },
}));

jest.mock('@expo/vector-icons/Ionicons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>;
  return { __esModule: true, default: MockIcon };
});

jest.mock('@/db/documentsRepository', () => ({ listDocuments: jest.fn(async () => []) }));
jest.mock('@/db/foldersRepository', () => ({ listFolders: jest.fn(async () => []) }));
jest.mock('@/services/import/importService', () => ({ importPdfs: jest.fn(), importImagesAsPdf: jest.fn() }));
jest.mock('@/services/library/documentService', () => ({ ensureThumbnail: jest.fn(), availableName: jest.fn(async (n: string) => n) }));
jest.mock('@/services/library/folderService', () => ({ createFolder: jest.fn() }));
jest.mock('@/services/share/shareService', () => ({ canSaveToDevice: false, saveToDevice: jest.fn(), shareDocument: jest.fn() }));
jest.mock('@/services/scan/pageProcessing', () => ({
  deleteFileQuietly: jest.fn(),
  deleteSessionFiles: jest.fn(),
  rotateImage: jest.fn(async () => ({ uri: 'rotated.jpg', width: 20, height: 10 })),
}));
jest.mock('@/services/scan/scanService', () => ({
  capturePages: jest.fn(async () => null),
  pickPages: jest.fn(async () => null),
  savePagesAsPdf: jest.fn(async () => ({ id: 'doc-1' })),
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrapper = ({ children }: { children: ReactNode }) => <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>;

const page = (id: string): ScanPage => ({
  id,
  uri: `${id}.jpg`,
  originalUri: `${id}.jpg`,
  width: 10,
  height: 20,
  originalWidth: 10,
  originalHeight: 20,
});

beforeEach(() => {
  jest.clearAllMocks();
  // No component is mounted yet, so the store can be prepared without act().
  useScanSession.getState().start();
  useScanSession.getState().setName('Receipts');
});

describe('scan entry points', () => {
  it('Home "Scan document" opens ScanPilot\'s camera by default', async () => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, onboardingComplete: true } });
    await render(<HomeScreen />, { wrapper });
    await fireEvent.press(screen.getAllByLabelText('Scan document')[0]);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/scan/camera', params: { mode: 'new' } });
    expect(capturePages).not.toHaveBeenCalled();
  });
});

describe('scan entry points (system scanner)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, onboardingComplete: true, scanner: 'system' } });
  });

  it('Home "Scan document" opens the native scanner and the review screen on success', async () => {
    (capturePages as jest.Mock).mockResolvedValueOnce([page('p1'), page('p2')]);
    await render(<HomeScreen />, { wrapper });
    await fireEvent.press(screen.getAllByLabelText('Scan document')[0]);
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/scan/review'));
    expect(useScanSession.getState().pages.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('does not navigate when the user cancels the scanner', async () => {
    await render(<HomeScreen />, { wrapper });
    await fireEvent.press(screen.getAllByLabelText('Scan document')[0]);
    await waitFor(() => expect(capturePages).toHaveBeenCalled());
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('scan review screen', () => {
  beforeEach(() => {
    useScanSession.getState().add([page('a'), page('b'), page('c')]);
  });

  it('reorders pages and selects them', async () => {
    await render(<ScanReviewScreen />, { wrapper });
    expect(screen.getByText('1 / 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Move page later'));
    expect(useScanSession.getState().pages.map((p) => p.id)).toEqual(['b', 'a', 'c']);
    await fireEvent.press(screen.getByLabelText('Page 3'));
    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(screen.getByLabelText('Move page later')).toBeDisabled();
  });

  it('deletes a page after confirmation', async () => {
    await render(<ScanReviewScreen />, { wrapper });
    await fireEvent.press(screen.getByLabelText('Delete'));
    const dialog = useDialogStore.getState().queue[0];
    expect(dialog.tone).toBe('danger');
    dialog.buttons.find((b) => b.style === 'destructive')?.onPress?.();
    expect(useScanSession.getState().pages.map((p) => p.id)).toEqual(['b', 'c']);
    useDialogStore.setState({ queue: [] });
  });

  it('rotates the selected page', async () => {
    await render(<ScanReviewScreen />, { wrapper });
    await fireEvent.press(screen.getByLabelText('Right'));
    await waitFor(() => expect(useScanSession.getState().pages[0].uri).toBe('rotated.jpg'));
  });

  it('saves with the chosen preset and opens the new document', async () => {
    await render(<ScanReviewScreen />, { wrapper });
    await fireEvent.press(screen.getByLabelText('Page size'));
    await fireEvent.press(screen.getByLabelText('Receipt, 80 mm wide'));
    await fireEvent.press(screen.getByLabelText('Save PDF · 3 pages'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/document/[id]', params: { id: 'doc-1' } }));
    const [pages, options] = (savePagesAsPdf as jest.Mock).mock.calls[0];
    expect(pages).toHaveLength(3);
    expect(options).toMatchObject({ name: 'Receipts', preset: 'receipt' });
    expect(useScanSession.getState().pages).toHaveLength(0); // session cleared
  });
});
