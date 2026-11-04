import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/ui';
import { getDatabase } from '@/db/database';
import { initialiseStorage } from '@/services/storage/fileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppTheme } from '@/theme';
import { errorMessage } from '@/utils/errors';

void SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

type BootState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

async function bootstrap(): Promise<void> {
  initialiseStorage();
  await getDatabase();
  await useSettingsStore.getState().load();
}

export default function RootLayout() {
  const theme = useAppTheme();
  const onboardingComplete = useSettingsStore((state) => state.settings.onboardingComplete);
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });

  const start = useCallback(() => {
    bootstrap()
      .then(() => setBoot({ status: 'ready' }))
      .catch((error: unknown) => setBoot({ status: 'error', message: errorMessage(error, 'ScanPilot could not open its library.') }))
      .finally(() => {
        void SplashScreen.hideAsync();
      });
  }, []);

  useEffect(start, [start]);

  const retry = () => {
    setBoot({ status: 'loading' });
    start();
  };

  const base = theme.dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.primary,
    },
  };

  if (boot.status === 'loading') return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  if (boot.status === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ErrorState message={boot.message} onRetry={retry} />
      </View>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { color: theme.colors.text, fontWeight: '600' },
          headerStyle: { backgroundColor: theme.colors.surface },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Protected guard={onboardingComplete}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="document/[id]" options={{ title: '' }} />
          <Stack.Screen name="folder/[id]" options={{ title: 'Folder' }} />
          <Stack.Screen name="folders" options={{ title: 'Folders' }} />
          <Stack.Screen name="tool/merge" options={{ title: 'Merge PDFs' }} />
          <Stack.Screen name="tool/split" options={{ title: 'Split PDF' }} />
          <Stack.Screen name="tool/compress" options={{ title: 'Compress PDF' }} />
          <Stack.Screen name="tool/organize" options={{ title: 'Organise pages' }} />
          <Stack.Screen name="scan/review" options={{ title: 'Review scan', gestureEnabled: false }} />
          <Stack.Screen
            name="scan/crop"
            options={{ title: 'Adjust corners', headerStyle: { backgroundColor: '#0A1120' }, headerTintColor: '#FFFFFF', headerTitleStyle: { color: '#FFFFFF' } }}
          />
          <Stack.Screen name="licenses" options={{ title: 'Open-source licences' }} />
          <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
        </Stack.Protected>
        <Stack.Protected guard={!onboardingComplete}>
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
