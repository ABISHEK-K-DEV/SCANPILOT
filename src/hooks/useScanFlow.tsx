import { ActivityAction, startActivityAsync } from 'expo-intent-launcher';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import { loadValue, saveValue } from '@/db/settingsRepository';
import { useSettingsStore } from '@/stores/settingsStore';

import { ProgressOverlay } from '@/components/ui';
import { ScannerError } from '@/native/scanner';
import { capturePages, type IngestCallbacks, pickPages } from '@/services/scan/scanService';
import type { ScanPage } from '@/services/scan/types';
import { useScanSession } from '@/stores/scanSessionStore';
import { errorMessage } from '@/utils/errors';

interface Progress {
  title: string;
  completed: number;
  total: number;
}

export type AddMode = 'append' | 'after-selected' | { replace: string };

/**
 * Starts and extends scan sessions. Used by Home/Files/Tools ("Scan document")
 * and by the review screen ("Add pages", "Retake"). Render `overlay` once.
 */
export function useScanFlow() {
  const [progress, setProgress] = useState<Progress | null>(null);

  const callbacks = (title: string): IngestCallbacks => ({
    onStart: (total) => setProgress({ title, completed: 0, total }),
    onProgress: (completed, total) => setProgress({ title, completed, total }),
  });

  const apply = (pages: ScanPage[], mode: AddMode) => {
    const session = useScanSession.getState();
    if (typeof mode === 'object') {
      const [first] = pages;
      if (!first) return;
      // Retake: the new capture becomes both the page and its new original.
      session.update(mode.replace, {
        uri: first.uri,
        width: first.width,
        height: first.height,
        originalUri: first.originalUri,
        originalWidth: first.originalWidth,
        originalHeight: first.originalHeight,
      });
      session.select(mode.replace);
    } else {
      session.add(pages, mode === 'after-selected');
    }
  };

  const offerPhotosInstead = (message: string, mode: AddMode, navigate: boolean) => {
    Alert.alert('Scanner unavailable', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose photos', onPress: () => void addFromPhotos(mode, navigate) },
      { text: 'Use ScanPilot camera', onPress: () => openCamera(mode, navigate) },
    ]);
  };

  async function addFromPhotos(mode: AddMode = 'append', navigate = false): Promise<void> {
    try {
      const pages = await pickPages({ single: typeof mode === 'object', ...callbacks('Adding photos') });
      setProgress(null);
      if (!pages) return;
      apply(pages, mode);
      if (navigate) router.push('/scan/review');
    } catch (error) {
      setProgress(null);
      Alert.alert('Could not add photos', errorMessage(error));
    }
  }

  const openCamera = (mode: AddMode, navigate: boolean) => {
    const params =
      typeof mode === 'object' ? { mode: 'retake', page: mode.replace } : navigate ? { mode: 'new' } : { mode: 'add' };
    router.push({ pathname: '/scan/camera', params });
  };

  /** Opens Android's settings page for Google Play services (its camera permission powers Google's scanner). */
  const openPlayServicesSettings = () => {
    if (Platform.OS !== 'android') return void Linking.openSettings();
    void startActivityAsync(ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: 'package:com.google.android.gms' }).catch(() =>
      Alert.alert('Open settings manually', 'Settings → Apps → Google Play services → Permissions → Camera → Allow.'),
    );
  };

  /**
   * Google's scanner closed without pages. That is usually a deliberate cancel,
   * but on some phones (Xiaomi, Realme, Vivo, Oppo…) its preview stays black
   * because Google Play services has no camera permission — offer both fixes.
   */
  const offerFallback = async (mode: AddMode, navigate: boolean) => {
    if (Platform.OS !== 'android' || (await loadValue<boolean>('hideScannerHint'))) return;
    Alert.alert(
      'Camera was black or not working?',
      'Google’s scanner needs camera access for “Google Play services”. You can allow it, or scan with ScanPilot’s own camera instead.',
      [
        { text: 'Use ScanPilot camera', onPress: () => openCamera(mode, navigate) },
        { text: 'Fix camera permission', onPress: openPlayServicesSettings },
        {
          text: 'It was fine',
          style: 'cancel',
          onPress: () => void saveValue('hideScannerHint', true),
        },
      ],
    );
  };

  async function capture(mode: AddMode = 'append', navigate = false): Promise<void> {
    if (useSettingsStore.getState().settings.scanner === 'camera') {
      openCamera(mode, navigate);
      return;
    }
    try {
      const pages = await capturePages({ maxPages: typeof mode === 'object' ? 1 : undefined, ...callbacks('Preparing pages') });
      setProgress(null);
      if (!pages) {
        void offerFallback(mode, navigate);
        return;
      }
      apply(pages, mode);
      if (navigate) router.push('/scan/review');
    } catch (error) {
      setProgress(null);
      if (error instanceof ScannerError && error.reason === 'unavailable') offerPhotosInstead(error.message, mode, navigate);
      else Alert.alert('Scan failed', errorMessage(error));
    }
  }

  /** Begins a brand-new scan session and opens the review screen when pages arrive. */
  const startScan = (folderId: string | null = null) => {
    useScanSession.getState().start(folderId);
    void capture('append', true);
  };

  const startFromPhotos = (folderId: string | null = null) => {
    useScanSession.getState().start(folderId);
    void addFromPhotos('append', true);
  };

  const overlay = (
    <ProgressOverlay
      visible={progress !== null}
      title={progress?.title ?? ''}
      progress={progress && progress.total > 0 ? progress.completed / progress.total : null}
      detail={progress && progress.total > 0 ? `Page ${Math.min(progress.completed + 1, progress.total)} of ${progress.total}` : undefined}
    />
  );

  return { startScan, startFromPhotos, capture, addFromPhotos, openPlayServicesSettings, overlay };
}
