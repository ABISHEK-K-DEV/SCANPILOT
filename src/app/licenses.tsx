import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, type IconName, ListGroup, ListRow, Screen } from '@/components/ui';
import {
  COPYRIGHT,
  LICENSE_CONDITIONS,
  LICENSE_LIMITATIONS,
  LICENSE_NAME,
  LICENSE_PERMISSIONS,
  LICENSE_SPDX,
  LICENSE_SUMMARY,
  LICENSE_TEXT,
} from '@/features/appLicense';
import { LICENSES } from '@/features/licenses';
import { elevation, useAppTheme } from '@/theme';

function TermColumn({ title, items, icon, color }: { title: string; items: readonly string[]; icon: IconName; color: string }) {
  const { spacing } = useAppTheme();
  return (
    <View style={[styles.column, { gap: spacing.sm }]}>
      <AppText variant="label" tone="subtle" style={styles.upper}>
        {title}
      </AppText>
      {items.map((item) => (
        <View key={item} style={[styles.term, { gap: 6 }]}>
          <Icon name={icon} size={15} color={color} />
          <AppText variant="caption" style={styles.flex}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export default function LicensesScreen() {
  const { colors, spacing, radius, dark } = useAppTheme();
  const [showThirdParty, setShowThirdParty] = useState(false);
  const version = Constants.expoConfig?.version ?? '—';
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }, !dark && elevation.card];

  return (
    <Screen scroll edges={['left', 'right']} contentStyle={{ paddingTop: spacing.md }}>
      <View style={{ gap: spacing.lg }}>
        <View style={card}>
          <View style={[styles.headerRow, { gap: spacing.md }]}>
            <View style={[styles.badge, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
              <Icon name="scale" size={22} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <AppText variant="title">{LICENSE_NAME}</AppText>
              <AppText variant="caption" tone="muted">
                ScanPilot {version} · SPDX: {LICENSE_SPDX}
              </AppText>
            </View>
          </View>
          <AppText tone="muted" style={{ marginTop: spacing.md }}>
            {LICENSE_SUMMARY}
          </AppText>
          <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: spacing.lg }]} />
          <View style={[styles.columns, { gap: spacing.lg }]}>
            <TermColumn title="Permissions" items={LICENSE_PERMISSIONS} icon="checkmark" color={colors.success} />
            <TermColumn title="Limitations" items={LICENSE_LIMITATIONS} icon="close" color={colors.danger} />
          </View>
          <View style={{ marginTop: spacing.lg }}>
            <TermColumn title="Conditions" items={LICENSE_CONDITIONS} icon="information-circle-outline" color={colors.primary} />
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="label" tone="subtle" style={[styles.upper, { paddingHorizontal: spacing.xs }]}>
            Full licence text
          </AppText>
          <View style={[card, { backgroundColor: colors.surfaceAlt }]}>
            <AppText variant="caption" style={{ fontWeight: '600' }}>
              {COPYRIGHT}
            </AppText>
            <AppText selectable variant="caption" tone="muted" style={{ marginTop: spacing.sm, lineHeight: 20 }}>
              {LICENSE_TEXT.split('\n').slice(3).join('\n').trim()}
            </AppText>
          </View>
        </View>

        <ListGroup title="Acknowledgements" footer="ScanPilot is built on free software. Each component keeps its own licence.">
          <ListRow
            icon="code-slash-outline"
            title="Third-party components"
            value={`${LICENSES.length}`}
            onPress={() => setShowThirdParty((v) => !v)}
            trailing={<Icon name={showThirdParty ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textSubtle} />}
            showChevron={false}
          />
          {showThirdParty
            ? LICENSES.map((entry) => (
                <Pressable
                  key={entry.name}
                  onPress={() => void Linking.openURL(entry.url)}
                  accessibilityRole="link"
                  accessibilityLabel={`${entry.name}, ${entry.license}`}
                  accessibilityHint="Opens the project page"
                  style={({ pressed }) => [styles.dep, { paddingHorizontal: spacing.lg, gap: spacing.md }, pressed && { backgroundColor: colors.surfacePressed }]}
                >
                  <View style={styles.flex}>
                    <AppText variant="body" numberOfLines={2}>
                      {entry.name}
                    </AppText>
                    <AppText variant="caption" tone="muted" numberOfLines={1}>
                      {entry.usage}
                    </AppText>
                  </View>
                  <View style={[styles.pill, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
                    <AppText variant="label" tone="muted" numberOfLines={1}>
                      {entry.license}
                    </AppText>
                  </View>
                </Pressable>
              ))
            : null}
        </ListGroup>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  badge: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  columns: { flexDirection: 'row' },
  column: { flex: 1 },
  term: { flexDirection: 'row', alignItems: 'center' },
  upper: { textTransform: 'uppercase' },
  dep: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingVertical: 10 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, maxWidth: 150 },
});
