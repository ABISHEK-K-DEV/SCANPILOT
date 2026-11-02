import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/index';
import { TextPromptModal } from '@/components/ui';
import { importImagesAsPdf, importPdfs } from '@/services/import/importService';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    // jest.mock factories may not close over imports, so require React here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, []);
  },
}));

// Icon fonts are loaded through the asset registry, which isn't available under Jest.
jest.mock('@expo/vector-icons/Ionicons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>;
  return { __esModule: true, default: MockIcon };
});

jest.mock('@/db/documentsRepository', () => ({
  listDocuments: jest.fn(async () => []),
  getLibraryStats: jest.fn(async () => ({ documentCount: 0, totalBytes: 0, favoriteCount: 0 })),
}));

jest.mock('@/db/foldersRepository', () => ({
  listFolders: jest.fn(async () => []),
  getFolder: jest.fn(async () => null),
}));

jest.mock('@/services/import/importService', () => ({
  importPdfs: jest.fn(async () => null),
  importImagesAsPdf: jest.fn(async () => null),
}));

jest.mock('@/services/library/documentService', () => ({ ensureThumbnail: jest.fn() }));
jest.mock('@/services/library/folderService', () => ({ createFolder: jest.fn() }));
jest.mock('@/services/share/shareService', () => ({ canSaveToDevice: true, saveToDevice: jest.fn(), shareDocument: jest.fn() }));

describe('Home screen', () => {
  it('shows the empty library state and wires import actions', async () => {
    await render(<HomeScreen />);
    expect(await screen.findByText('Your library is empty')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Import your first PDF'));
    await waitFor(() => expect(importPdfs).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getAllByLabelText('Images to PDF')[0]);
    await waitFor(() => expect(importImagesAsPdf).toHaveBeenCalledTimes(1));
  });

  it('marks unreleased tools as disabled rather than silently doing nothing', async () => {
    await render(<HomeScreen />);
    expect(await screen.findByLabelText('Merge PDF, coming soon')).toBeDisabled();
    screen.getAllByLabelText('Import PDF').forEach((button) => expect(button).toBeEnabled());
  });
});

describe('TextPromptModal', () => {
  it('validates names and submits trimmed values', async () => {
    const onSubmit = jest.fn();
    await render(<TextPromptModal visible title="Rename document" initialValue="Old" onCancel={jest.fn()} onSubmit={onSubmit} />);
    const input = screen.getByLabelText('Rename document');

    await fireEvent.changeText(input, 'bad/name');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText(/cannot contain/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    await fireEvent.changeText(input, '  Invoice 2026  ');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Invoice 2026'));
  });

  it('keeps the dialog open and shows the error when submit throws', async () => {
    const onSubmit = jest.fn(async () => {
      throw new Error('A document named "X" already exists.');
    });
    await render(<TextPromptModal visible title="Rename" initialValue="X" onCancel={jest.fn()} onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('A document named "X" already exists.')).toBeTruthy();
  });
});
