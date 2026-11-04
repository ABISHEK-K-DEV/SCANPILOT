import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Wordmark } from '@/components/brand/Logo';
import { DocumentGridItem } from '@/components/documents/DocumentItems';
import { FolderTile } from '@/components/documents/FolderTile';
import { ToolTile } from '@/components/documents/ToolTile';
import { AppText, EmptyState, ErrorState, Icon, type IconName, Screen, SectionHeader } from '@/components/ui';
import { POPULAR, tool, type ToolId } from '@/features/tools';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { useToolLauncher } from '@/hooks/useToolLauncher';
import { useDocuments, useFolders } from '@/hooks/useLibraryQueries';
import { elevation, useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';

const MAX_WIDTH = 820;

/** Decorative stacked pages inside scan-frame corners, top-right of the hero card. */
function HeroArt() {
  return (
    <View style={styles.heroArt} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={132} height={132} viewBox="0 0 132 132">
        <Rect x="44" y="20" width="58" height="76" rx="7" fill="#FFFFFF" opacity={0.06} transform="rotate(8 73 58)" />
        <Rect x="36" y="26" width="58" height="76" rx="7" fill="#FFFFFF" opacity={0.1} />
        <Rect x="46" y="40" width="26" height="4" rx="2" fill="#FFFFFF" opacity={0.28} />
        <Rect x="46" y="50" width="36" height="4" rx="2" fill="#FFFFFF" opacity={0.18} />
        <Rect x="46" y="60" width="30" height="4" rx="2" fill="#FFFFFF" opacity={0.18} />
        <Rect x="30" y="66" width="70" height="3" rx="1.5" fill="#5EEAD4" opacity={0.85} />
        <Path d="M24 34 V24 a6 6 0 0 1 6 -6 h10" stroke="#8B8DFF" strokeWidth={4} strokeLinecap="round" fill="none" />
        <Path d="M96 18 h10 a6 6 0 0 1 6 6 v10" stroke="#8B8DFF" strokeWidth={4} strokeLinecap="round" fill="none" />
        <Path d="M112 98 v10 a6 6 0 0 1 -6 6 h-10" stroke="#8B8DFF" strokeWidth={4} strokeLinecap="round" fill="none" />
        <Path d="M40 114 H30 a6 6 0 0 1 -6 -6 V98" stroke="#8B8DFF" strokeWidth={4} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
}

function QuickAction({ icon, label, hint, onPress }: { icon: IconName; label: string; hint: string; onPress: () => void }) {
  const { colors, radius, spacing, dark } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.quick,
        {
          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md + 2,
          gap: spacing.md,
        },
        !dark && elevation.card,
      ]}
    >
      <View style={styles.quickTop}>
        <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
          <Icon name={icon} size={20} color={colors.primary} />
        </View>
        <Icon name="arrow-forward" size={17} color={colors.textSubtle} />
      </View>
      <View>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {label}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {hint}
        </AppText>
      </View>
    </Pressable>
  );
}

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
  const columns = contentWidth >= 560 ? 8 : 4;
  const tileWidth = Math.floor((contentWidth - spacing.sm * (columns - 1)) / columns);

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
        <View style={[styles.privacyPill, { backgroundColor: colors.successSoft, borderRadius: radius.pill, gap: 5 }]}>
          <Icon name="shield-checkmark-outline" size={14} color={colors.success} />
          <AppText variant="label" color={colors.success} style={styles.pillText}>
            On-device
          </AppText>
        </View>
      </View>

      <Pressable
        onPress={() => router.push({ pathname: '/library', params: { focus: 'search' } })}
        accessibilityRole="search"
        accessibilityLabel="Search documents"
        style={({ pressed }) => [
          styles.search,
          { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border, borderRadius: radius.md + 2, paddingHorizontal: spacing.md + 2, gap: spacing.sm + 2 },
        ]}
      >
        <Icon name="search" size={18} color={colors.textSubtle} />
        <AppText tone="subtle">Search documents and text</AppText>
      </Pressable>

      <View style={[styles.hero, { backgroundColor: colors.ink, borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.lg }]}>
        <HeroArt />
        <View style={[styles.heroText, { gap: spacing.xs }]}>
          <AppText variant="label" color={colors.onInkMuted} style={styles.eyebrow}>
            DOCUMENT SCANNER
          </AppText>
          <AppText variant="title" color={colors.onInk}>
            Scan a document
          </AppText>
          <AppText variant="caption" color={colors.onInkMuted}>
            Edges are found automatically. Crop, enhance and save as a PDF.
          </AppText>
        </View>
        <Pressable
          onPress={() => scanner.startScan()}
          accessibilityRole="button"
          accessibilityLabel="Scan document"
          accessibilityHint="Opens the camera scanner with automatic edge detection"
          style={({ pressed }) => [styles.scanButton, { backgroundColor: pressed ? '#E8EAF0' : '#FFFFFF', borderRadius: radius.md + 2, marginTop: spacing.lg, gap: spacing.sm }]}
        >
          <Icon name="scan" size={20} color="#111827" />
          <AppText variant="bodyStrong" color="#111827">
            Start scanning
          </AppText>
        </Pressable>
      </View>

      <View style={[styles.row, { gap: spacing.md, marginTop: spacing.md }]}>
        <QuickAction icon="document-attach" label="Import PDF" hint="From Files or Drive" onPress={importer.importPdf} />
        <QuickAction icon="file-image" label="JPG to PDF" hint="Photos from your gallery" onPress={importer.importImages} />
      </View>

      <SectionHeader title="Quick tools" actionLabel="All tools" onAction={() => router.push('/tools')} />
      <View style={[styles.grid, { rowGap: spacing.md, columnGap: spacing.sm }]}>
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
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  privacyPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { letterSpacing: 0.2 },
  search: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderWidth: 1 },
  hero: { overflow: 'hidden' },
  heroArt: { position: 'absolute', right: -10, top: -6 },
  heroText: { maxWidth: '68%' },
  eyebrow: { letterSpacing: 1.2, fontSize: 10.5 },
  scanButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 50, alignSelf: 'stretch' },
  row: { flexDirection: 'row' },
  quick: { flex: 1, borderWidth: StyleSheet.hairlineWidth },
  quickTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  quickIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
