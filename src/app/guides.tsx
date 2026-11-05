import { View } from 'react-native';

import { AppText, Button, ListGroup, ListRow, Screen } from '@/components/ui';
import { TOOL_GUIDES } from '@/features/toolGuides';
import { tool, TOOLS } from '@/features/tools';
import { toast } from '@/stores/dialogStore';
import { useGuideStore } from '@/stores/guideStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { toolAccents, useAppTheme } from '@/theme';

const GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Scanning', ids: ['camera', 'scan-whiteboard', 'scan-book', 'scan-id-card', 'scan-business-card', 'import-images', 'text-to-pdf'] },
  { title: 'Organise', ids: ['merge', 'split', 'extract-pages', 'organize', 'remove-pages', 'rotate', 'crop'] },
  { title: 'Edit & sign', ids: ['edit', 'sign', 'watermark', 'page-numbers', 'redact'] },
  { title: 'Convert', ids: ['ocr', 'pdf-to-word', 'pdf-to-ppt', 'pdf-to-excel', 'pdf-to-images'] },
  { title: 'Optimise & security', ids: ['compress', 'repair', 'protect', 'unlock'] },
];

/** Every tool's animated "How it works" guide in one place. */
export default function GuidesScreen() {
  const { spacing, dark } = useAppTheme();
  const open = useGuideStore((s) => s.open);
  const seen = useSettingsStore((s) => s.settings.seenGuides);
  const update = useSettingsStore((s) => s.update);
  const toolFor = (id: string) => TOOLS.find((t) => t.id === (id === 'camera' ? 'scan' : id)) ?? tool('scan');

  return (
    <Screen scroll edges={['left', 'right']} contentStyle={{ paddingTop: spacing.md }}>
      <View style={{ gap: spacing.xl }}>
        <AppText tone="muted">Short animated walkthroughs. Each one also opens the first time you use a tool, and from its ? button.</AppText>
        {GROUPS.map((g) => (
          <ListGroup key={g.title} title={g.title}>
            {g.ids.map((id) => {
              const guide = TOOL_GUIDES[id];
              const t = toolFor(id);
              const [fg, bg] = toolAccents[t.category][dark ? 'dark' : 'light'];
              return (
                <ListRow
                  key={id}
                  icon={t.icon}
                  iconColor={fg}
                  iconBackground={bg}
                  title={guide.title}
                  subtitle={guide.tagline}
                  value={seen.includes(id) ? undefined : 'New'}
                  onPress={() => open(id)}
                />
              );
            })}
          </ListGroup>
        ))}
        <Button
          label="Show guides again automatically"
          icon="refresh"
          variant="secondary"
          disabled={seen.length === 0}
          onPress={() => void update('seenGuides', []).then(() => toast('Guides will show again'))}
        />
      </View>
    </Screen>
  );
}
