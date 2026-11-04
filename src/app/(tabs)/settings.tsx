import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { ActionSheet, AppText, ListGroup, ListRow, Screen } from '@/components/ui';
import { ensureLockedFolder } from '@/services/library/folderService';
import { authenticate, canAuthenticate } from '@/services/security/authService';
import { useSecurityStore } from '@/stores/securityStore';
import { useLibraryStats } from '@/hooks/useLibraryQueries';
import { clearTemp, storageUsage, type StorageUsage } from '@/services/storage/fileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppTheme } from '@/theme';
import type { ThemePreference } from '@/types/settings';
import { formatBytes } from '@/utils/format';

const THEME_LABEL: Record<ThemePreference, string> = { system: 'Match device', light: 'Light', dark: 'Dark' };

export default function SettingsScreen() {
  const { spacing, colors } = useAppTheme();
  const unlockFolder = useSecurityStore((s) => s.unlockFolder);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const stats = useLibraryStats();
  const [themeSheet, setThemeSheet] = useState(false);
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
    Alert.alert('Temporary files cleared', 'Your documents were not affected.');
  };

  const toggleAppLock = async (enable: boolean) => {
    if (enable && !(await canAuthenticate())) {
      Alert.alert('Set up a screen lock first', 'App lock uses your fingerprint, face or device PIN. Add one in your phone settings.');
      return;
    }
    if (await authenticate(enable ? 'Turn on app lock' : 'Turn off app lock')) await update('appLock', enable);
  };

  const openLockedFolder = async () => {
    if (!(await canAuthenticate())) {
      Alert.alert('Set up a screen lock first', 'The locked folder uses your fingerprint, face or device PIN. Add one in your phone settings.');
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
      <AppText variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
        Settings
      </AppText>
      <View style={{ gap: spacing.xl }}>
        <ListGroup title="Appearance">
          <ListRow icon="contrast-outline" title="Theme" value={THEME_LABEL[settings.theme]} onPress={() => setThemeSheet(true)} />
          <ListRow
            icon={settings.viewMode === 'grid' ? 'grid-outline' : 'list-outline'}
            title="Library layout"
            value={settings.viewMode === 'grid' ? 'Grid' : 'List'}
            onPress={() => void update('viewMode', settings.viewMode === 'grid' ? 'list' : 'grid')}
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
          <ListRow icon="code-slash-outline" title="Open-source licences" onPress={() => router.push('/licenses')} />
          <ListRow icon="play-circle-outline" title="Show introduction again" onPress={() => void update('onboardingComplete', false)} />
        </ListGroup>

        <AppText variant="caption" tone="subtle" align="center">
          ScanPilot is free: no subscription, no watermark, no account.
        </AppText>
      </View>

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
