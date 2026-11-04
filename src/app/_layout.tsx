import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { BootScreen } from '@/components/brand/BootScreen';
import { LockScreen, useAppLockWatcher } from '@/components/security/LockScreen';
import { ErrorState } from '@/components/ui';
import { getDatabase } from '@/db/database';
import { initialiseStorage } from '@/services/storage/fileStore';
import { useSecurityStore } from '@/stores/securityStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppTheme } from '@/theme';
import { errorMessage } from '@/utils/errors';

void SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

type BootState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

/** Keeps the start-up screen up long enough to read as intentional, not as a flicker. */
const MIN_BOOT_MS = 650;

async function bootstrap(): Promise<void> {
  const shown = Date.now();
  initialiseStorage();
  await getDatabase();
  await useSettingsStore.getState().load();
  const remaining = MIN_BOOT_MS - (Date.now() - shown);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export default function RootLayout() {
  const theme = useAppTheme();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const fontsSettled = fontsLoaded || !!fontError;
  const onboardingComplete = useSettingsStore((state) => state.settings.onboardingComplete);
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });
  const appLock = useSettingsStore((state) => state.settings.appLock);
  const locked = useSecurityStore((state) => state.locked);
  useAppLockWatcher();

  const start = useCallback(() => {
    bootstrap()
      .then(() => setBoot({ status: 'ready' }))
      .catch((error: unknown) => setBoot({ status: 'error', message: errorMessage(error, 'ScanPilot could not open its library.') }));
  }, []);

  useEffect(start, [start]);

  // The native splash hands over to the animated BootScreen as soon as fonts are ready.
  useEffect(() => {
    if (fontsSettled) void SplashScreen.hideAsync();
  }, [fontsSettled]);

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

  if (!fontsSettled) return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  if (boot.status === 'loading') return <BootScreen fontsReady={fontsLoaded} />;
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
          headerTitleStyle: { color: theme.colors.text, fontFamily: theme.typography.heading.fontFamily, fontSize: 17 },
          headerStyle: { backgroundColor: theme.colors.background },
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
          <Stack.Screen name="tool/sign" options={{ title: 'Sign PDF' }} />
          <Stack.Screen name="tool/edit" options={{ title: 'Edit PDF' }} />
          <Stack.Screen name="tool/redact" options={{ title: 'Redact PDF' }} />
          <Stack.Screen name="tool/watermark" options={{ title: 'Add watermark' }} />
          <Stack.Screen name="tool/page-numbers" options={{ title: 'Page numbers' }} />
          <Stack.Screen name="tool/protect" options={{ title: 'Protect PDF' }} />
          <Stack.Screen name="tool/unlock" options={{ title: 'Unlock PDF' }} />
          <Stack.Screen name="tool/repair" options={{ title: 'Repair PDF' }} />
          <Stack.Screen name="tool/rotate" options={{ title: 'Rotate PDF' }} />
          <Stack.Screen name="tool/crop" options={{ title: 'Crop PDF' }} />
          <Stack.Screen name="tool/ocr" options={{ title: 'Extract text' }} />
          <Stack.Screen name="tool/pdf-to-images" options={{ title: 'PDF to JPG' }} />
          <Stack.Screen name="tool/text-to-pdf" options={{ title: 'Text to PDF' }} />
          <Stack.Screen name="scan/camera" options={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="scan/review" options={{ title: 'Review scan', gestureEnabled: false }} />
          <Stack.Screen
            name="scan/crop"
            options={{ title: 'Adjust corners', headerStyle: { backgroundColor: '#0B0D12' }, headerTintColor: '#FFFFFF', headerTitleStyle: { color: '#FFFFFF' } }}
          />
          <Stack.Screen name="licenses" options={{ title: 'Licence' }} />
          <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
        </Stack.Protected>
        <Stack.Protected guard={!onboardingComplete}>
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
      {appLock && locked ? <LockScreen /> : null}
    </ThemeProvider>
  );
}
