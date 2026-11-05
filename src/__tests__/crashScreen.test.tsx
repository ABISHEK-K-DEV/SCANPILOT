import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CrashScreen } from '@/components/ui/CrashScreen';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrapper = ({ children }: { children: ReactNode }) => <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>;

describe('crash screen', () => {
  it('explains the problem and offers retry and home', async () => {
    const retry = jest.fn(async () => undefined);
    await render(<CrashScreen error={new Error('Boom')} retry={retry} />, { wrapper });
    expect(screen.getByText('This screen ran into a problem')).toBeTruthy();
    expect(screen.getByText('Boom')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Try again'));
    expect(retry).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Go to Home'));
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
