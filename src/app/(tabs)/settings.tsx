import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { LogoMark } from '@/components/brand/Logo';
import { ActionSheet, AppText, Icon, ListGroup, ListRow, Screen } from '@/components/ui';
import { ensureLockedFolder } from '@/services/library/folderService';
import { authenticate, canAuthenticate } from '@/services/security/authService';
import { useSecurityStore } from '@/stores/securityStore';
import { useLibraryStats } from '@/hooks/useLibraryQueries';
import { clearTemp, storageUsage, type StorageUsage } from '@/services/storage/fileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { elevation, useAppTheme } from '@/theme';
import type { ThemePreference } from '@/types/settings';
import { formatBytes } from '@/utils/format';
import { appAlert, toast } from '@/stores/dialogStore';

const THEME_LABEL: Record<ThemePreference, string> = { system: 'Match device', light: 'Light', dark: 'Dark' };

export default function SettingsScreen() {
  const { spacing, colors, radius, dark } = useAppTheme();
  const unlockFolder = useSecurityStore((s) => s.unlockFolder);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const stats = useLibraryStats();
  const [themeSheet, setThemeSheet] = useState(false);
  const [scannerSheet, setScannerSheet] = useState(false);
  const [usage, setUsage] = useState<StorageUsage | null>(null);

  useFocusEffect(
    useCallback(() => {
      try {
        setUsage(storageUsage());
      } catch {
        setUsage(null);
      }
    }, []),
  );

  const clearTemporary = () => {
    clearTemp();
    setUsage(storageUsage());
    toast('Temporary files cleared');
  };

  const toggleAppLock = async (enable: boolean) => {
    if (enable && !(await canAuthenticate())) {
      appAlert('Set up a screen lock first', 'App lock uses your fingerprint, face or device PIN. Add one in your phone settings.');
      return;
    }
    if (await authenticate(enable ? 'Turn on app lock' : 'Turn off app lock')) await update('appLock', enable);
  };

  const openLockedFolder = async () => {
    if (!(await canAuthenticate())) {
      appAlert('Set up a screen lock first', 'The locked folder uses your fingerprint, face or device PIN. Add one in your phone settings.');
      return;
    }
    if (!(await authenticate('Open the locked folder'))) return;
    const id = await ensureLockedFolder();
    unlockFolder(id);
    router.push({ pathname: '/folder/[id]', params: { id } });
  };

  const version = Constants.expoConfig?.version ?? '—';

  return (
    <Screen scroll>
      <AppText variant="display" style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
        Settings
      </AppText>
      <View style={{ gap: spacing.xl }}>
        <View
          style={[
            styles.summary,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
            !dark && elevation.card,
          ]}
          accessible
          accessibilityLabel={stats.data ? `Library: ${stats.data.documentCount} documents, ${formatBytes(stats.data.totalBytes)}, stored on this device` : 'Library'}
        >
          <View style={[styles.summaryIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
            <Icon name="documents-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <AppText variant="heading">
              {stats.data ? `${stats.data.documentCount} ${stats.data.documentCount === 1 ? 'document' : 'documents'}` : 'Your library'}
            </AppText>
            <AppText variant="caption" tone="muted">
              {stats.data ? `${formatBytes(stats.data.totalBytes)} · on this device only` : 'On this device only'}
            </AppText>
          </View>
          <View style={[styles.offline, { backgroundColor: colors.successSoft, borderRadius: radius.pill }]}>
            <Icon name="cloud-offline-outline" size={14} color={colors.success} />
            <AppText variant="label" color={colors.success}>
              Offline
            </AppText>
          </View>
        </View>

        <ListGroup title="Appearance">
          <ListRow icon="contrast-outline" title="Theme" value={THEME_LABEL[settings.theme]} onPress={() => setThemeSheet(true)} />
          <ListRow
            icon={settings.viewMode === 'grid' ? 'grid-outline' : 'list-outline'}
            title="Library layout"
            value={settings.viewMode === 'grid' ? 'Grid' : 'List'}
            onPress={() => void update('viewMode', settings.viewMode === 'grid' ? 'list' : 'grid')}
          />
        </ListGroup>

        <ListGroup title="Scanning">
          <ListRow
            icon="scan"
            title="Scanner"
            subtitle={settings.scanner === 'camera' ? 'ScanPilot camera · auto edge detection on this phone' : 'System scanner (Google Play services / Apple VisionKit)'}
            value={settings.scanner === 'camera' ? 'ScanPilot' : 'System'}
            onPress={() => setScannerSheet(true)}
          />
          <ListRow
            icon="camera"
            title="Auto capture"
            subtitle="Take the photo as soon as the page is found and held still"
            trailing={<Switch value={settings.autoCapture} onValueChange={(v) => void update('autoCapture', v)} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel="Auto capture" />}
            showChevron={false}
          />
          <ListRow
            icon="scan-text"
            title="Searchable text (OCR)"
            subtitle="Recognise the words when saving a scan, on this phone"
            trailing={<Switch value={settings.scanOcr} onValueChange={(v) => void update('scanOcr', v)} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel="Searchable text when saving scans" />}
            showChevron={false}
          />
        </ListGroup>

        <ListGroup title="Privacy & security">
          <ListRow icon="shield-checkmark-outline" title="How ScanPilot protects your files" onPress={() => router.push('/privacy')} />
          <ListRow
            icon="finger-print-outline"
            title="App lock"
            subtitle="Fingerprint, face or screen lock to open ScanPilot"
            trailing={<Switch value={settings.appLock} onValueChange={(v) => void toggleAppLock(v)} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel="App lock" />}
            showChevron={false}
          />
          <ListRow icon="lock-closed-outline" title="Locked folder" subtitle="Hidden documents that need your fingerprint, face or PIN" onPress={() => void openLockedFolder()} />
        </ListGroup>

        <ListGroup title="Storage">
          <ListRow
            icon="documents-outline"
            title="Documents"
            value={stats.data ? `${stats.data.documentCount} · ${formatBytes(stats.data.totalBytes)}` : '…'}
          />
          <ListRow icon="images-outline" title="Thumbnails" value={usage ? formatBytes(usage.thumbnailsBytes) : '—'} />
          <ListRow
            icon="trash-bin-outline"
            title="Clear temporary files"
            subtitle="Removes leftovers from imports and sharing"
            value={usage ? formatBytes(usage.tempBytes) : undefined}
            onPress={clearTemporary}
          />
        </ListGroup>

        <ListGroup title="About">
          <ListRow icon="information-circle-outline" title="Version" value={version} />
          <ListRow icon="scale" title="Licence" value="MIT License" onPress={() => router.push('/licenses')} />
          <ListRow icon="help-circle-outline" title="Tool guides" subtitle="How every tool works, with animated demos" onPress={() => router.push('/guides')} />
          <ListRow icon="play-circle-outline" title="Show introduction again" onPress={() => void update('onboardingComplete', false)} />
        </ListGroup>

        <View style={[styles.footer, { gap: spacing.sm }]}>
          <LogoMark size={36} />
          <AppText variant="bodyStrong">ScanPilot {version}</AppText>
          <AppText variant="caption" tone="subtle" align="center">
            Free, with no subscription, watermark or account.
          </AppText>
        </View>
      </View>

      <ActionSheet
        visible={scannerSheet}
        title="Scanner"
        subtitle="Both run entirely on this phone"
        onClose={() => setScannerSheet(false)}
        actions={[
          {
            key: 'camera',
            label: 'ScanPilot camera',
            hint: 'Frame guide, flash, batch pages, automatic edge detection',
            icon: 'camera',
            selected: settings.scanner === 'camera',
            onPress: () => void update('scanner', 'camera'),
          },
          {
            key: 'system',
            label: 'System scanner',
            hint: "Google's scanner from Play services (Apple VisionKit on iPhone)",
            icon: 'scan-outline',
            selected: settings.scanner === 'system',
            onPress: () => void update('scanner', 'system'),
          },
        ]}
      />
      <ActionSheet
        visible={themeSheet}
        title="Theme"
        onClose={() => setThemeSheet(false)}
        actions={(Object.keys(THEME_LABEL) as ThemePreference[]).map((key) => ({
          key,
          label: THEME_LABEL[key],
          icon: key === 'system' ? 'phone-portrait-outline' : key === 'light' ? 'sunny-outline' : 'moon-outline',
          selected: settings.theme === key,
          onPress: () => void update('theme', key),
        }))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  summaryIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4 },
  footer: { alignItems: 'center', paddingVertical: 8 },
});
