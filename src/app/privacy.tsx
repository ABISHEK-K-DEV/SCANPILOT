import { View } from 'react-native';

import { AppText, Card, Icon, type IconName, Screen } from '@/components/ui';
import { useAppTheme } from '@/theme';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'phone-portrait-outline',
    title: 'Stored on your device',
    body: 'Documents, thumbnails and their names are saved in ScanPilot’s private app storage. Other apps cannot read them.',
  },
  {
    icon: 'cloud-offline-outline',
    title: 'No uploads, no account',
    body: 'ScanPilot has no servers. Nothing you import or create is sent anywhere unless you choose Share or Save to device.',
  },
  {
    icon: 'eye-off-outline',
    title: 'No content analytics',
    body: 'The app contains no analytics or advertising SDKs, and never inspects document contents for tracking.',
  },
  {
    icon: 'hand-left-outline',
    title: 'Minimal permissions',
    body: 'Release builds have no internet permission at all, so the app cannot send anything. The camera is used only while you scan, and imports use the system pickers — ScanPilot only sees the files you select, never your whole storage.',
  },
  {
    icon: 'archive-outline',
    title: 'You control backups',
    body: 'Automatic cloud backup of the app is disabled on Android. Export or share documents yourself whenever you want a copy elsewhere.',
  },
];

export default function PrivacyScreen() {
  const { colors, spacing } = useAppTheme();
  return (
    <Screen scroll edges={['left', 'right']} contentStyle={{ paddingTop: spacing.lg, gap: spacing.md }}>
      {POINTS.map((point) => (
        <Card key={point.title}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Icon name={point.icon} color={colors.primary} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="heading">{point.title}</AppText>
              <AppText tone="muted">{point.body}</AppText>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
