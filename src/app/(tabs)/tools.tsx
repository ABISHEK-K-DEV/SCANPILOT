import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ToolTile } from '@/components/documents/ToolTile';
import { AppText, Screen, SectionHeader } from '@/components/ui';
import { type ToolDefinition, type ToolId, TOOLS } from '@/features/tools';
import { useImportActions } from '@/hooks/useImportActions';
import { useScanFlow } from '@/hooks/useScanFlow';
import { useAppTheme } from '@/theme';

const GROUPS: { title: string; ids: ToolId[] }[] = [
  { title: 'Create', ids: ['scan', 'import-pdf', 'import-images'] },
  { title: 'PDF toolkit', ids: ['merge', 'split', 'compress', 'organize'] },
  { title: 'Edit & recognise', ids: ['annotate', 'sign', 'ocr'] },
];

export default function ToolsScreen() {
  const { spacing } = useAppTheme();
  const { width } = useWindowDimensions();
  const importer = useImportActions();
  const scanner = useScanFlow();
  const contentWidth = Math.min(width, 820) - spacing.lg * 2;
  const columns = contentWidth >= 560 ? 3 : 2;
  const tileWidth = (contentWidth - spacing.md * (columns - 1)) / columns;

  const run = (t: ToolDefinition) => {
    if (t.id === 'scan') scanner.startScan();
    if (t.id === 'import-pdf') void importer.importPdf();
    if (t.id === 'import-images') void importer.importImages();
  };

  return (
    <Screen scroll>
      <AppText variant="display" style={{ marginTop: spacing.md }}>
        Tools
      </AppText>
      <AppText tone="muted" style={{ marginTop: spacing.xs }}>
        Every tool is free, works offline and never adds a watermark. Tools marked “Soon” are on the way.
      </AppText>
      {GROUPS.map((group) => (
        <View key={group.title}>
          <SectionHeader title={group.title} />
          <View style={[styles.grid, { gap: spacing.md }]}>
            {group.ids.map((id) => {
              const t = TOOLS.find((x) => x.id === id);
              return t ? (
                <ToolTile key={t.id} icon={t.icon} label={t.label} description={t.description} comingSoon={!t.available} width={tileWidth} onPress={() => run(t)} />
              ) : null;
            })}
          </View>
        </View>
      ))}
      {importer.overlay}
      {scanner.overlay}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
