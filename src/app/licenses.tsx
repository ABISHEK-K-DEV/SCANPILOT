import { Linking, View } from 'react-native';

import { AppText, ListGroup, ListRow, Screen } from '@/components/ui';
import { LICENSES } from '@/features/licenses';
import { useAppTheme } from '@/theme';

export default function LicensesScreen() {
  const { spacing } = useAppTheme();
  return (
    <Screen scroll edges={['left', 'right']} contentStyle={{ paddingTop: spacing.lg }}>
      <View style={{ gap: spacing.lg }}>
        <AppText tone="muted">
          ScanPilot is built with open-source software. Each component below is used under its licence; tap one to read its source and licence text.
        </AppText>
        <ListGroup>
          {LICENSES.map((entry) => (
            <ListRow
              key={entry.name}
              title={entry.name}
              subtitle={`${entry.license} · ${entry.usage}`}
              onPress={() => void Linking.openURL(entry.url)}
            />
          ))}
        </ListGroup>
      </View>
    </Screen>
  );
}
