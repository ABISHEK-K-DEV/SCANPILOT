import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router as mockRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CameraScreen from '@/app/scan/camera';
import { useCameraPermissions } from '@/native/camera';
import { waitForCameraPages } from '@/services/scan/cameraBridge';
import { processCapturedPage } from '@/services/scan/pageProcessing';
import { useScanSession } from '@/stores/scanSessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { DEFAULT_SETTINGS } from '@/types/settings';

const mockParams: { mode?: string; replace?: string } = {};

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
  usePreventRemove: () => jest.fn(),
  Stack: { Screen: () => null },
}));

jest.mock('@/native/camera', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  // eslint-disable-next-line react/display-name
  const CameraView = React.forwardRef(({ onCameraReady }: { onCameraReady?: () => void }, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ takePictureAsync: async () => ({ uri: 'photo.jpg', width: 3000, height: 4000 }), getAvailablePictureSizesAsync: async () => ['4032x3024', '3264x2448'] }));
    React.useEffect(() => onCameraReady?.(), [onCameraReady]);
    return <View testID="camera" />;
  });
  return { CameraView, useCameraPermissions: jest.fn(() => [{ granted: true, canAskAgain: true }, jest.fn(), jest.fn()]) };
});

jest.mock('@/services/scan/pageProcessing', () => ({
  deleteSessionFiles: jest.fn(),
  detectQuadInImage: jest.fn(async () => [{ x: 300, y: 300 }, { x: 2700, y: 320 }, { x: 2680, y: 3700 }, { x: 320, y: 3680 }]),
  deleteFileQuietly: jest.fn(),
  ingestImage: jest.fn(async (uri: string) => ({ id: 'p1', uri, width: 3000, height: 4000, originalUri: uri, originalWidth: 3000, originalHeight: 4000 })),
  autoCropPage: jest.fn(async (page: object) => ({ ...page, uri: 'cropped.jpg', width: 2000, height: 2800 })),
  processCapturedPage: jest.fn(async (page: object, filter: string) => ({ ...page, uri: 'enhanced.jpg', width: 2000, height: 2800, base: { uri: 'cropped.jpg', width: 2000, height: 2800 }, filter })),
  filterImage: jest.fn(async () => ({ uri: 'enhanced.jpg', width: 2000, height: 2800 })),
}));
jest.mock('@/services/scan/scanService', () => ({ pickPages: jest.fn(async () => null) }));
jest.mock('@/db/settingsRepository', () => ({ saveSetting: jest.fn(async () => undefined), loadSettings: jest.fn() }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrapper = ({ children }: { children: ReactNode }) => <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  delete mockParams.mode;
  delete mockParams.replace;
  useScanSession.getState().start();
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, onboardingComplete: true, autoCapture: false } });
});

describe('ScanPilot camera', () => {
  it('asks for camera access before showing the camera', async () => {
    (useCameraPermissions as jest.Mock).mockReturnValueOnce([{ granted: false, canAskAgain: true }, jest.fn(), jest.fn()]);
    await render(<CameraScreen />, { wrapper });
    expect(screen.getByText('Allow the camera')).toBeTruthy();
    expect(screen.getByLabelText('Allow camera')).toBeTruthy();
    expect(screen.getByLabelText('Choose photos instead')).toBeTruthy();
  });

  it('captures, auto-crops and enhances a page, then opens the review screen', async () => {
    await render(<CameraScreen />, { wrapper });
    await fireEvent.press(screen.getByLabelText('Take photo'));
    await waitFor(() => expect(screen.getByLabelText('Done, 1 page')).toBeTruthy());
    expect(processCapturedPage).toHaveBeenCalledWith(expect.objectContaining({ uri: 'photo.jpg' }), 'auto');
    await fireEvent.press(screen.getByLabelText('Done, 1 page'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/scan/review'));
    const [added] = useScanSession.getState().pages;
    expect(added).toMatchObject({ uri: 'enhanced.jpg', filter: 'auto', base: { uri: 'cropped.jpg' } });
  });

  it('auto-captures once the page is found and held steady', async () => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, onboardingComplete: true, autoCapture: true } });
    await render(<CameraScreen />, { wrapper });
    expect(screen.getByLabelText('Auto capture')).toBeTruthy();
    // Two steady detections in a row → the snapshot becomes a page, no shutter press.
    await waitFor(() => expect(screen.getByLabelText('Done, 1 page')).toBeTruthy(), { timeout: 4000 });
    expect(processCapturedPage).toHaveBeenCalled();
    // Switching to manual stops it.
    await fireEvent.press(screen.getByLabelText('Manual capture'));
    expect(useSettingsStore.getState().settings.autoCapture).toBe(false);
  });

  it('hands pages back to a waiting tool in return mode', async () => {
    mockParams.mode = 'return';
    const result = waitForCameraPages();
    await render(<CameraScreen />, { wrapper });
    await fireEvent.press(screen.getByLabelText('Take photo'));
    await waitFor(() => expect(screen.getByLabelText('Done, 1 page')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Done, 1 page'));
    const pages = await result;
    expect(pages).toHaveLength(1);
    expect(mockRouter.back).toHaveBeenCalled();
    expect(useScanSession.getState().pages).toHaveLength(0);
  });
});
