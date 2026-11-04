import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Wordmark } from '@/components/brand/Logo';
import { DocumentGridItem } from '@/components/documents/DocumentItems';
import { FolderTile } from '@/components/documents/FolderTile';
import { ToolTile } from '@/components/documents/ToolTile';
import { AppText, Button, EmptyState, ErrorState, Icon, Screen, SectionHeader } from '@/components/ui';
import { type ToolId, TOOLS } from '@/features/tools';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { useToolLauncher } from '@/hooks/useToolLauncher';
import { useDocuments, useFolders } from '@/hooks/useLibraryQueries';
import { useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';

const HOME_TOOLS: ToolId[] = ['scan', 'import-pdf', 'import-images', 'merge', 'split', 'compress'];
const MAX_WIDTH = 820;

function HorizontalDocuments({ docs, onMore }: { docs: ScanDocument[]; onMore: (doc: ScanDocument) => void }) {
  const { spacing } = useAppTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -spacing.lg }}
      contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 2 }}
    >
      {docs.map((doc) => (
        <DocumentGridItem
          key={doc.id}
          doc={doc}
          width={148}
          onPress={() => router.push({ pathname: '/document/[id]', params: { id: doc.id } })}
          onMore={onMore}
        />
      ))}
    </ScrollView>
  );
}

export default function HomeScreen() {
  const { colors, spacing, radius } = useAppTheme();
  const { width } = useWindowDimensions();
  const recent = useDocuments({ sort: { field: 'date', direction: 'desc' }, limit: 10 });
  const favourites = useDocuments({ favoritesOnly: true, sort: { field: 'opened', direction: 'desc' }, limit: 10 });
  const folders = useFolders();
  const actions = useDocumentActions();
  const tools = useToolLauncher();
  const { importer, scanner } = tools;

  const contentWidth = Math.min(width, MAX_WIDTH) - spacing.lg * 2;
  const columns = contentWidth >= 560 ? 3 : 2;
  const tileWidth = (contentWidth - spacing.md * (columns - 1)) / columns;

  const runTool = (id: ToolId) => tools.launch(id);

  const refresh = () => {
    recent.refresh();
    favourites.refresh();
    folders.refresh();
  };

  return (
    <Screen scroll onRefresh={refresh} refreshing={false}>
      <View style={[styles.header, { marginTop: spacing.md, marginBottom: spacing.lg }]}>
        <Wordmark />
      </View>

      <Pressable
        onPress={() => router.push({ pathname: '/library', params: { focus: 'search' } })}
        accessibilityRole="search"
        accessibilityLabel="Search documents"
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, gap: spacing.sm }]}
      >
        <Icon name="search" size={18} color={colors.textSubtle} />
        <AppText tone="subtle">Search documents</AppText>
      </Pressable>

      <View style={[styles.hero, { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.lg, gap: spacing.md }]}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="title" tone="onPrimary">
            Scan anything. Edit everything.
          </AppText>
          <AppText tone="onPrimary" style={styles.heroSub}>
            No subscription. No watermark. Your documents stay on this device.
          </AppText>
        </View>
        <Pressable
          onPress={() => scanner.startScan()}
          accessibilityRole="button"
          accessibilityLabel="Scan document"
          accessibilityHint="Opens the camera scanner with automatic edge detection"
          style={({ pressed }) => [
            styles.scanButton,
            { backgroundColor: pressed ? colors.primarySoft : colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
          ]}
        >
          <View style={[styles.scanIcon, { backgroundColor: colors.primary, borderRadius: radius.md }]}>
            <Icon name="scan" size={26} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="heading">Scan document</AppText>
            <AppText variant="caption" tone="muted">
              Auto edge detection · multi-page
            </AppText>
          </View>
          <Icon name="chevron-forward" color={colors.primary} />
        </Pressable>
        <View style={[styles.heroActions, { gap: spacing.sm }]}>
          <Button label="Import PDF" icon="document-attach-outline" variant="onPrimary" onPress={importer.importPdf} style={styles.heroButton} />
          <Button label="Images to PDF" icon="images-outline" variant="onPrimary" onPress={importer.importImages} style={styles.heroButton} />
        </View>
      </View>

      <SectionHeader title="Tools" actionLabel="See all" onAction={() => router.push('/tools')} />
      <View style={[styles.grid, { gap: spacing.md }]}>
        {HOME_TOOLS.map((id) => {
          const t = TOOLS.find((x) => x.id === id);
          if (!t) return null;
          return (
            <ToolTile key={t.id} icon={t.icon} label={t.label} description={t.description} comingSoon={!t.available} width={tileWidth} onPress={() => runTool(t.id)} />
          );
        })}
      </View>

      <SectionHeader title="Recent" actionLabel={recent.data && recent.data.length > 0 ? 'View all' : undefined} onAction={() => router.push('/library')} />
      {recent.error ? (
        <ErrorState message={recent.error} onRetry={recent.refresh} />
      ) : recent.data && recent.data.length === 0 ? (
        <EmptyState
          compact
          icon="documents-outline"
          title="Your library is empty"
          message="Imported and created PDFs appear here. Everything is stored privately on your device."
          actionLabel="Import your first PDF"
          onAction={importer.importPdf}
        />
      ) : recent.data ? (
        <HorizontalDocuments docs={recent.data} onMore={actions.show} />
      ) : null}

      {favourites.data && favourites.data.length > 0 ? (
        <>
          <SectionHeader title="Favourites" />
          <HorizontalDocuments docs={favourites.data} onMore={actions.show} />
        </>
      ) : null}

      {folders.data && folders.data.length > 0 ? (
        <>
          <SectionHeader title="Folders" actionLabel="Manage" onAction={() => router.push('/folders')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg }} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
            {folders.data.map((folder) => (
              <FolderTile key={folder.id} folder={folder} onPress={() => router.push({ pathname: '/folder/[id]', params: { id: folder.id } })} />
            ))}
          </ScrollView>
        </>
      ) : null}

      {actions.elements}
      {tools.overlays}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: { flexDirection: 'row', alignItems: 'center', minHeight: 46, borderWidth: StyleSheet.hairlineWidth },
  hero: {},
  heroSub: { opacity: 0.9 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap' },
  heroButton: { flexGrow: 1, borderWidth: 0 },
  scanButton: { flexDirection: 'row', alignItems: 'center' },
  scanIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
