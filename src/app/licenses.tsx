import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { AppText, Icon, type IconName, Screen } from '@/components/ui';
import {
  COPYRIGHT,
  LICENSE_CONDITIONS,
  LICENSE_NAME,
  LICENSE_PERMISSIONS,
  LICENSE_SPDX,
  LICENSE_SUMMARY,
  LICENSE_TEXT,
} from '@/features/appLicense';
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
          <AppText variant="label" tone="subtle" style={[styles.upper, { marginBottom: spacing.sm }]}>
            You may
          </AppText>
          <View style={[styles.chips, { gap: spacing.sm }]}>
            {LICENSE_PERMISSIONS.map((item) => (
              <View key={item} style={[styles.chip, { backgroundColor: colors.successSoft, borderRadius: radius.pill }]}>
                <Icon name="checkmark" size={14} color={colors.success} strokeWidth={2.4} />
                <AppText variant="caption" color={colors.success} style={styles.chipText}>
                  {item}
                </AppText>
              </View>
            ))}
          </View>
          <View style={{ marginTop: spacing.lg }}>
            <TermColumn title="Condition" items={LICENSE_CONDITIONS} icon="information-circle-outline" color={colors.primary} />
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
  column: { flex: 1 },
  term: { flexDirection: 'row', alignItems: 'center' },
  upper: { textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { fontWeight: '600' },
});
