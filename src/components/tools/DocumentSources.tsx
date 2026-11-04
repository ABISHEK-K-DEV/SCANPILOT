import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Icon, type IconName } from '@/components/ui';
import { type DocumentSource, useDocumentSources } from '@/hooks/useDocumentSources';
import { elevation, useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';

const SOURCES: { id: DocumentSource; icon: IconName; label: string; hint: string }[] = [
  { id: 'scan', icon: 'scan', label: 'Scan', hint: 'Use the camera' },
  { id: 'import', icon: 'document-attach', label: 'Import PDF', hint: 'From Files or Drive' },
  { id: 'photos', icon: 'file-image', label: 'Photos', hint: 'Gallery to PDF' },
];

/** Three equal tiles: camera scan, PDF import, photos → PDF. */
export function SourceButtons({ onPick, disabled }: { onPick: (source: DocumentSource) => void; disabled?: boolean }) {
  const { colors, radius, spacing } = useAppTheme();
  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      {SOURCES.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => onPick(s.id)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={s.id === 'scan' ? 'Scan with camera' : s.id === 'import' ? 'Import PDF' : 'Photos to PDF'}
          accessibilityHint={s.hint}
          style={({ pressed }) => [
            styles.tile,
            {
              borderRadius: radius.md + 2,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.surfacePressed : colors.surface,
              paddingVertical: spacing.md,
              gap: 6,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          <View style={[styles.icon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
            <Icon name={s.icon} size={20} color={colors.primary} />
          </View>
          <AppText variant="caption" numberOfLines={1} style={styles.label}>
            {s.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

interface ChooseDocumentCardProps {
  icon: IconName;
  title: string;
  message: string;
  /** Opens the library picker. */
  onChoose: () => void;
  /** Receives the first document created by scan / import / photos. */
  onCreated: (doc: ScanDocument) => void;
  chooseLabel?: string;
}

/**
 * Empty state for tools: explains the tool, then offers the library picker
 * plus camera, import and photos — so a tool works even with an empty library.
 */
export function ChooseDocumentCard({ icon, title, message, onChoose, onCreated, chooseLabel = 'Choose from library' }: ChooseDocumentCardProps) {
  const { colors, radius, spacing, dark } = useAppTheme();
  const sources = useDocumentSources();
  const pick = async (source: DocumentSource) => {
    const docs = await sources.add(source);
    if (docs?.[0]) onCreated(docs[0]);
  };
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg },
        !dark && elevation.card,
      ]}
    >
      <View style={[styles.header, { gap: spacing.sm }]}>
        <View style={[styles.badge, { backgroundColor: colors.primarySoft, borderRadius: radius.lg }]}>
          <Icon name={icon} size={26} color={colors.primary} />
        </View>
        <AppText variant="heading" align="center">
          {title}
        </AppText>
        <AppText tone="muted" align="center" variant="caption" style={styles.message}>
          {message}
        </AppText>
      </View>
      <Button label={chooseLabel} icon="folder-open-outline" fullWidth onPress={onChoose} />
      <View style={[styles.dividerRow, { gap: spacing.sm }]}>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
        <AppText variant="label" tone="subtle">
          OR ADD A NEW ONE
        </AppText>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
      </View>
      <SourceButtons onPick={(s) => void pick(s)} disabled={sources.busy} />
      {sources.overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  tile: { flex: 1, alignItems: 'center', borderWidth: 1 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '600' },
  card: { borderWidth: StyleSheet.hairlineWidth },
  header: { alignItems: 'center' },
  badge: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  message: { maxWidth: 340 },
  dividerRow: { flexDirection: 'row', alignItems: 'center' },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
