import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CompressScreen from '@/app/tool/compress';
import MergeScreen from '@/app/tool/merge';
import OrganizeScreen from '@/app/tool/organize';
import SplitScreen from '@/app/tool/split';
import { isCompressionSupported } from '@/services/tools/compressService';
import { mergeDocuments } from '@/services/tools/mergeService';
import { saveOrganised } from '@/services/tools/organizeService';
import { splitDocument } from '@/services/tools/splitService';
import type { ScanDocument } from '@/types/document';

const mockParams: { id?: string; ids?: string } = {};

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
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

const mockDoc = (id: string, name: string, pageCount = 3): ScanDocument => ({
  id,
  name,
  kind: 'pdf',
  source: 'import-pdf',
  fileUri: `file:///docs/${id}.pdf`,
  thumbnailUri: null,
  pageCount,
  sizeBytes: 100_000,
  folderId: null,
  isFavorite: false,
  createdAt: 1,
  updatedAt: 1,
  lastOpenedAt: null,
});

const mockLibrary = [mockDoc('a', 'Alpha'), mockDoc('b', 'Bravo', 5), mockDoc('c', 'Charlie', 1)];

jest.mock('@/db/documentsRepository', () => ({
  listDocuments: jest.fn(async () => mockLibrary),
  getDocument: jest.fn(async (id: string) => mockLibrary.find((d) => d.id === id) ?? null),
}));
jest.mock('@/services/library/documentService', () => ({ ensureThumbnail: jest.fn(), availableName: jest.fn(async (n: string) => n) }));
jest.mock('@/services/import/importService', () => ({ importPdfs: jest.fn(async () => null) }));
jest.mock('@/services/share/shareService', () => ({ shareDocument: jest.fn() }));
jest.mock('@/services/tools/mergeService', () => ({ mergeDocuments: jest.fn(async () => ({ ...mockLibrary[0], id: 'merged', name: 'Merged' })) }));
jest.mock('@/services/tools/splitService', () => ({
  ...jest.requireActual('@/services/tools/splitService'),
  splitDocument: jest.fn(async () => [{ ...mockLibrary[1], id: 's1', name: 'Bravo – pages 1-2' }]),
}));
jest.mock('@/services/tools/organizeService', () => ({
  loadPageCount: jest.fn(async (d: ScanDocument) => d.pageCount ?? 1),
  renderPageThumbnails: jest.fn(() => ({ done: Promise.resolve(), cleanup: jest.fn() })),
  saveOrganised: jest.fn(async (d: ScanDocument) => d),
  extractToNewDocument: jest.fn(),
}));
jest.mock('@/services/tools/compressService', () => ({
  ...jest.requireActual('@/services/tools/compressService'),
  isCompressionSupported: jest.fn(() => false),
  estimateCompression: jest.fn(async () => ({ pageCount: 3, estimates: [] })),
  compressDocument: jest.fn(),
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrapper = ({ children }: { children: ReactNode }) => <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  delete mockParams.id;
  delete mockParams.ids;
});

describe('Merge', () => {
  it('selects PDFs, reorders them and merges in the chosen order', async () => {
    await render(<MergeScreen />, { wrapper });
    await fireEvent.press(screen.getByLabelText('Select PDFs'));
    await fireEvent.press(await screen.findByLabelText(/^Alpha,/));
    await fireEvent.press(screen.getByLabelText(/^Bravo,/));
    await fireEvent.press(screen.getByLabelText('Add 2 PDFs'));
    await fireEvent.press(await screen.findByLabelText('Move Bravo up'));
    await fireEvent.press(screen.getByLabelText('Merge 2 PDFs'));
    await waitFor(() => expect(mergeDocuments).toHaveBeenCalled());
    const [docs] = (mergeDocuments as jest.Mock).mock.calls[0];
    expect(docs.map((d: ScanDocument) => d.id)).toEqual(['b', 'a']);
    expect(await screen.findByText('Merged PDF created')).toBeTruthy();
  });

  it('needs at least two PDFs', async () => {
    mockParams.ids = 'a';
    await render(<MergeScreen />, { wrapper });
    expect(await screen.findByLabelText('Add at least one more PDF')).toBeDisabled();
  });
});

describe('Split', () => {
  it('validates ranges live and splits', async () => {
    mockParams.id = 'b';
    await render(<SplitScreen />, { wrapper });
    const input = await screen.findByLabelText('Page ranges');
    await fireEvent.changeText(input, '1-2, 9');
    expect(await screen.findByText(/outside the document/)).toBeTruthy();
    expect(screen.getByLabelText('Split PDF')).toBeDisabled();
    await fireEvent.changeText(input, '1-2, 3-5');
    expect(await screen.findByText(/Creates 2 PDFs: pages 1-2; pages 3-5/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Split PDF'));
    await waitFor(() => expect(splitDocument).toHaveBeenCalledWith(mockLibrary[1], { kind: 'ranges', expression: '1-2, 3-5' }, expect.anything()));
    expect(await screen.findByText('1 PDF created')).toBeTruthy();
  });

  it('asks for a document when opened from the Tools tab', async () => {
    await render(<SplitScreen />, { wrapper });
    expect(screen.getByLabelText('Choose PDF')).toBeTruthy();
  });
});

describe('Organise pages', () => {
  it('selects, rotates and saves as a copy', async () => {
    mockParams.id = 'a';
    await render(<OrganizeScreen />, { wrapper });
    expect(await screen.findByLabelText('No changes yet')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Page 2'));
    await fireEvent.press(screen.getByLabelText('Right'));
    expect(screen.getByLabelText('Page 2, rotated 90 degrees')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save changes'));
    await fireEvent.press(await screen.findByRole('menuitem', { name: 'Save as a new copy' }));
    await waitFor(() => expect(saveOrganised).toHaveBeenCalled(), { timeout: 2000 });
    const [, plan, mode] = (saveOrganised as jest.Mock).mock.calls[0];
    expect(mode).toBe('copy');
    expect(plan.map((p: { rotate: number }) => p.rotate)).toEqual([0, 90, 0]);
    expect(router.replace).toHaveBeenCalled();
  });

  it('refuses to delete every page', async () => {
    mockParams.id = 'c';
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<OrganizeScreen />, { wrapper });
    await fireEvent.press(await screen.findByLabelText('Select all'));
    await fireEvent.press(screen.getByLabelText('Delete'));
    expect(alert).toHaveBeenCalledWith('Keep at least one page', expect.any(String));
    alert.mockRestore();
  });
});

describe('Compress', () => {
  it('explains when the native renderer is unavailable', async () => {
    (isCompressionSupported as jest.Mock).mockReturnValue(false);
    await render(<CompressScreen />, { wrapper });
    expect(screen.getByText('Not available on this device yet')).toBeTruthy();
  });

  it('shows the three levels and the readability notice when supported', async () => {
    (isCompressionSupported as jest.Mock).mockReturnValue(true);
    mockParams.id = 'b';
    await render(<CompressScreen />, { wrapper });
    expect(await screen.findByText('Medium compression')).toBeTruthy();
    expect(screen.getByText('Low compression')).toBeTruthy();
    expect(screen.getByText('High compression')).toBeTruthy();
    expect(screen.getByText(/can’t be selected or searched/)).toBeTruthy();
  });
});
