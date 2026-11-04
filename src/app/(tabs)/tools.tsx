import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ToolTile } from '@/components/documents/ToolTile';
import { AppText, EmptyState, Screen, SearchField, SectionHeader } from '@/components/ui';
import { CATEGORIES, searchTools, TOOLS } from '@/features/tools';
import { useToolLauncher } from '@/hooks/useToolLauncher';
import { useAppTheme } from '@/theme';

export default function ToolsScreen() {
  const { spacing } = useAppTheme();
  const { width } = useWindowDimensions();
  const tools = useToolLauncher();
  const [query, setQuery] = useState('');
  const contentWidth = Math.min(width, 820) - spacing.lg * 2;
  const columns = contentWidth >= 560 ? 3 : 2;
  const gap = spacing.md - 2;
  const tileWidth = Math.floor((contentWidth - gap * (columns - 1)) / columns);
  const matches = searchTools(query);

  return (
    <Screen scroll>
      <AppText variant="display" style={{ marginTop: spacing.lg }}>
        Tools
      </AppText>
      <AppText tone="muted" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {TOOLS.filter((t) => t.available).length} PDF tools that run offline, with no watermark.
      </AppText>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search tools — e.g. sign, merge, word" />
      {matches.length === 0 ? <EmptyState compact icon="search" title="No tool found" message={`Nothing matches "${query.trim()}".`} /> : null}
      {CATEGORIES.map((cat) => {
        const list = matches.filter((t) => t.category === cat.id);
        if (list.length === 0) return null;
        return (
          <View key={cat.id}>
            <SectionHeader title={cat.label} />
            <View style={[styles.grid, { gap }]}>
              {list.map((t) => (
                <ToolTile key={t.id} icon={t.icon} label={t.label} description={t.description} category={t.category} comingSoon={!t.available} width={tileWidth} onPress={() => tools.launch(t.id)} />
              ))}
            </View>
          </View>
        );
      })}
      {tools.overlays}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
