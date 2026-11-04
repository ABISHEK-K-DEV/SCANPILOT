import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Wordmark } from '@/components/brand/Logo';
import { DocumentGridItem } from '@/components/documents/DocumentItems';
import { FolderTile } from '@/components/documents/FolderTile';
import { ToolTile } from '@/components/documents/ToolTile';
import { AppText, Button, EmptyState, ErrorState, Icon, Screen, SectionHeader } from '@/components/ui';
import { POPULAR, tool, type ToolId } from '@/features/tools';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { useToolLauncher } from '@/hooks/useToolLauncher';
import { useDocuments, useFolders } from '@/hooks/useLibraryQueries';
import { useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';

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
  const theme = useAppTheme();
  const { colors, spacing, radius } = theme;
  const { width } = useWindowDimensions();
  const recent = useDocuments({ sort: { field: 'date', direction: 'desc' }, limit: 10 });
  const favourites = useDocuments({ favoritesOnly: true, sort: { field: 'opened', direction: 'desc' }, limit: 10 });
  const folders = useFolders();
  const actions = useDocumentActions();
  const tools = useToolLauncher();
  const { importer, scanner } = tools;

  const contentWidth = Math.min(width, MAX_WIDTH) - spacing.lg * 2;
  const columns = contentWidth >= 560 ? 4 : 3;
  const tileWidth = (contentWidth - spacing.sm * (columns - 1)) / columns;

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

      <LinearGradient
        colors={theme.dark ? ['#2A4BD6', '#5B2BC9'] : ['#2D5BFF', '#6A3CF5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.lg, gap: spacing.md }]}
      >
        <View style={[styles.heroGlow, { borderRadius: 120 }]} pointerEvents="none" />
        <View style={{ gap: spacing.xs }}>
          <AppText variant="title" color="#FFFFFF">
            Scan anything. Edit everything.
          </AppText>
          <AppText color="#FFFFFF" style={styles.heroSub}>
            Free forever · no watermark · files stay on your phone
          </AppText>
        </View>
        <Pressable
          onPress={() => scanner.startScan()}
          accessibilityRole="button"
          accessibilityLabel="Scan document"
          accessibilityHint="Opens the camera scanner with automatic edge detection"
          style={({ pressed }) => [styles.scanButton, { backgroundColor: pressed ? '#EEF2FF' : '#FFFFFF', borderRadius: radius.lg, padding: spacing.md, gap: spacing.md }]}
        >
          <LinearGradient colors={['#2D5BFF', '#6A3CF5']} style={[styles.scanIcon, { borderRadius: radius.md }]}>
            <Icon name="scan" size={26} color="#FFFFFF" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <AppText variant="heading" color="#0B1B3F">
              Scan document
            </AppText>
            <AppText variant="caption" color="#4F5E7B">
              Auto edge detection · multi-page
            </AppText>
          </View>
          <Icon name="chevron-forward" color="#2D5BFF" />
        </Pressable>
        <View style={[styles.heroActions, { gap: spacing.sm }]}>
          <Button label="Import PDF" icon="document-attach-outline" variant="onPrimary" onPress={importer.importPdf} style={styles.heroButton} compact />
          <Button label="JPG to PDF" icon="images-outline" variant="onPrimary" onPress={importer.importImages} style={styles.heroButton} compact />
        </View>
      </LinearGradient>

      <SectionHeader title="Popular tools" actionLabel="All tools" onAction={() => router.push('/tools')} />
      <View style={[styles.grid, { gap: spacing.sm }]}>
        {POPULAR.map((id) => {
          const t = tool(id);
          return <ToolTile key={t.id} compact icon={t.icon} label={t.label} description={t.description} category={t.category} comingSoon={!t.available} width={tileWidth} onPress={() => runTool(t.id)} />;
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
  hero: { overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 240, height: 240, right: -80, top: -90, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroSub: { opacity: 0.9 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap' },
  heroButton: { flexGrow: 1, borderWidth: 0 },
  scanButton: { flexDirection: 'row', alignItems: 'center' },
  scanIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
