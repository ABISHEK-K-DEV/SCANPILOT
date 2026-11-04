import { Image } from 'expo-image';
import { router, Stack, usePreventRemove } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageThumb } from '@/components/scan/PageThumb';
import { ToolbarButton } from '@/components/scan/ToolbarButton';
import {
  ActionSheet,
  AppText,
  Button,
  Chip,
  EmptyState,
  Icon,
  IconButton,
  ProgressOverlay,
  TextPromptModal,
} from '@/components/ui';
import { useScanFlow } from '@/hooks/useScanFlow';
import { availableName } from '@/services/library/documentService';
import { FILTERS, type FilterId } from '@/services/scan/filters';
import { filterImage, rotateImage } from '@/services/scan/pageProcessing';
import { savePagesAsPdf } from '@/services/scan/scanService';
import { PRESETS } from '@/services/scan/types';
import { useScanSession } from '@/stores/scanSessionStore';
import { useAppTheme } from '@/theme';
import { errorMessage, isCancelled } from '@/utils/errors';

type Sheet = 'add' | 'rename' | 'filters' | null;

export default function ScanReviewScreen() {
  const { colors, radius, spacing } = useAppTheme();
  const { pages, selectedId, preset, name, folderId, select, remove, move, update, setPreset, setName, clear } = useScanSession();
  const flow = useScanFlow();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState<{ completed: number; total: number } | null>(null);
  const cancelToken = useRef({ cancelled: false });

  const index = Math.max(0, pages.findIndex((p) => p.id === selectedId));
  const page = pages[index] ?? null;

  const disablePrevention = usePreventRemove(pages.length > 0, ({ repeat }) => {
    Alert.alert('Discard this scan?', `${pages.length} ${pages.length === 1 ? 'page' : 'pages'} will be deleted.`, [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          clear();
          repeat();
        },
      },
    ]);
  });

  const withBusy = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    try {
      await task();
    } catch (error) {
      Alert.alert('Something went wrong', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const rotate = (degrees: 90 | -90) =>
    page &&
    withBusy('Rotating page', async () => {
      const result = await rotateImage(page, degrees);
      // Rotating bakes in the current filter; later filters start from the rotated image.
      update(page.id, { ...result, base: undefined, filter: undefined });
    });

  const setFilter = (filter: FilterId) =>
    page &&
    withBusy('Applying filter', async () => {
      const base = page.base ?? { uri: page.uri, width: page.width, height: page.height };
      if (filter === 'original') {
        update(page.id, { uri: base.uri, width: base.width, height: base.height, base: undefined, filter: undefined });
        return;
      }
      const result = await filterImage(base.uri, filter);
      update(page.id, { ...result, base, filter });
    });

  const applyToAll = (filter: FilterId) =>
    withBusy('Applying to all pages', async () => {
      for (const p of useScanSession.getState().pages) {
        const base = p.base ?? { uri: p.uri, width: p.width, height: p.height };
        if (filter === 'original') update(p.id, { uri: base.uri, width: base.width, height: base.height, base: undefined, filter: undefined });
        else update(p.id, { ...(await filterImage(base.uri, filter)), base, filter });
      }
    });

  const confirmDelete = () => {
    if (!page) return;
    Alert.alert('Delete page?', `Page ${index + 1} will be removed from this scan.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(page.id) },
    ]);
  };

  const save = async () => {
    if (pages.length === 0) return;
    cancelToken.current = { cancelled: false };
    setSaving({ completed: 0, total: pages.length + 1 });
    try {
      const doc = await savePagesAsPdf(pages, {
        name: await availableName(name || 'Scan'),
        preset,
        folderId,
        cancelToken: cancelToken.current,
        onProgress: (completed, total) => setSaving({ completed, total }),
      });
      disablePrevention();
      clear();
      setSaving(null);
      router.replace({ pathname: '/document/[id]', params: { id: doc.id } });
    } catch (error) {
      setSaving(null);
      if (!isCancelled(error)) Alert.alert('Could not save PDF', errorMessage(error));
    }
  };

  const header = (
    <Stack.Screen
      options={{
        title: 'Review scan',
      }}
    />
  );

  if (pages.length === 0) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {header}
        <EmptyState
          icon="scan-outline"
          title="No pages yet"
          message="Scan a document with the camera or add photos to build a PDF."
          actionLabel="Scan pages"
          onAction={() => void flow.capture('append')}
        />
        <Button label="Add from photos" variant="ghost" icon="images-outline" onPress={() => void flow.addFromPhotos('append')} style={styles.center} />
        {flow.overlay}
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      {header}
      <Pressable
        onPress={() => setSheet('rename')}
        accessibilityRole="button"
        accessibilityLabel={`Document name: ${name}. Tap to rename.`}
        style={({ pressed }) => [
          styles.nameRow,
          {
            marginHorizontal: spacing.lg,
            marginTop: spacing.sm,
            marginBottom: spacing.md,
            paddingHorizontal: spacing.md,
            minHeight: 48,
            gap: spacing.sm,
            borderRadius: radius.md + 2,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surfacePressed : colors.surface,
          },
        ]}
      >
        <Icon name="document-text-outline" size={18} color={colors.textMuted} />
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
          {name}
        </AppText>
        <Icon name="create-outline" size={17} color={colors.textSubtle} />
      </Pressable>

      <View style={[styles.preview, { backgroundColor: colors.surfaceAlt, marginHorizontal: spacing.lg, borderRadius: radius.lg }]}>
        {page ? (
          <Image
            source={{ uri: page.uri }}
            style={styles.flex}
            contentFit="contain"
            recyclingKey={page.uri}
            accessible
            accessibilityLabel={`Page ${index + 1} of ${pages.length}`}
          />
        ) : null}
        <View style={[styles.counter, { backgroundColor: 'rgba(15,23,42,0.72)', borderRadius: radius.pill }]}>
          <AppText variant="caption" color="#FFFFFF" style={styles.counterText}>
            {index + 1} / {pages.length}
          </AppText>
        </View>
      </View>

      <View style={[styles.toolbar, { paddingHorizontal: spacing.sm, marginTop: spacing.sm }]}>
        <ToolbarButton icon="arrow-undo-outline" label="Left" onPress={() => void rotate(-90)} />
        <ToolbarButton icon="arrow-redo-outline" label="Right" onPress={() => void rotate(90)} />
        <ToolbarButton icon="crop-outline" label="Crop" onPress={() => page && router.push({ pathname: '/scan/crop', params: { id: page.id } })} />
        <ToolbarButton icon="color-filter-outline" label="Filter" onPress={() => setSheet('filters')} />
        <ToolbarButton icon="camera-reverse-outline" label="Retake" onPress={() => page && void flow.capture({ replace: page.id })} />
        <ToolbarButton icon="trash-outline" label="Delete" destructive onPress={confirmDelete} />
      </View>

      <View style={[styles.stripHeader, { paddingHorizontal: spacing.lg }]}>
        <AppText variant="label" tone="subtle" style={styles.flex}>
          {pages.length} {pages.length === 1 ? 'PAGE' : 'PAGES'}
        </AppText>
        <IconButton icon="chevron-back" label="Move page earlier" disabled={index === 0} onPress={() => page && move(page.id, -1)} />
        <IconButton icon="chevron-forward" label="Move page later" disabled={index === pages.length - 1} onPress={() => page && move(page.id, 1)} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.noGrow}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 2 }}
      >
        {pages.map((p, i) => (
          <PageThumb key={p.id} page={p} index={i} selected={p.id === page?.id} onPress={() => select(p.id)} />
        ))}
        <Pressable
          onPress={() => setSheet('add')}
          accessibilityRole="button"
          accessibilityLabel="Add pages"
          style={({ pressed }) => [
            styles.addTile,
            { borderColor: colors.borderStrong, borderRadius: radius.sm + 2, backgroundColor: pressed ? colors.surfacePressed : colors.surface },
          ]}
        >
          <View style={[styles.addIcon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="add" size={18} color={colors.primary} strokeWidth={2.2} />
          </View>
          <AppText variant="label" tone="muted">
            Add
          </AppText>
        </Pressable>
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.noGrow}
        contentContainerStyle={[styles.chips, { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}
      >
        {PRESETS.map((p) => (
          <Chip key={p.id} label={p.label} selected={preset === p.id} onPress={() => setPreset(p.id)} accessibilityLabel={`${p.label}, ${p.hint}`} />
        ))}
      </ScrollView>

      <View style={[styles.saveBar, { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.sm, borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <Button label="Add" icon="add" variant="secondary" onPress={() => setSheet('add')} accessibilityHint="Scan more pages or add photos" />
        <Button
          label={`Save PDF · ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`}
          icon="checkmark"
          onPress={() => void save()}
          style={styles.flex}
        />
      </View>

      <ActionSheet
        visible={sheet === 'add'}
        title="Add pages"
        onClose={() => setSheet(null)}
        actions={[
          { key: 'scan', label: 'Scan more pages', icon: 'scan-outline', onPress: () => flow.capture('append') },
          { key: 'photos', label: 'Add from photos', icon: 'images-outline', onPress: () => flow.addFromPhotos('append') },
        ]}
      />
      <ActionSheet
        visible={sheet === 'filters'}
        title="Filter"
        subtitle={`Page ${index + 1} · current: ${FILTERS.find((f) => f.id === (page?.filter ?? 'original'))?.label}`}
        onClose={() => setSheet(null)}
        actions={[
          ...FILTERS.map((f) => ({
            key: f.id,
            label: f.label,
            icon: (f.id === 'original' ? 'image-outline' : f.id === 'bw' ? 'contrast-outline' : f.id === 'clarity' ? 'document-text-outline' : 'color-filter-outline') as 'image-outline',
            selected: (page?.filter ?? 'original') === f.id,
            onPress: () => setFilter(f.id),
          })),
          {
            key: 'all',
            label: `Apply “${FILTERS.find((f) => f.id === (page?.filter ?? 'original'))?.label}” to all pages`,
            icon: 'copy-outline',
            onPress: () => applyToAll(page?.filter ?? 'original'),
          },
        ]}
      />
      <TextPromptModal
        visible={sheet === 'rename'}
        title="Document name"
        initialValue={name}
        onCancel={() => setSheet(null)}
        onSubmit={(value) => {
          setName(value);
          setSheet(null);
        }}
      />
      <ProgressOverlay visible={busy !== null} title={busy ?? ''} progress={null} />
      <ProgressOverlay
        visible={saving !== null}
        title="Creating PDF"
        progress={saving ? saving.completed / saving.total : null}
        onCancel={() => {
          cancelToken.current.cancelled = true;
        }}
      />
      {flow.overlay}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignSelf: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  preview: { flex: 1, overflow: 'hidden', minHeight: 200 },
  counter: { position: 'absolute', bottom: 12, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4 },
  counterText: { fontWeight: '600' },
  saveBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  addIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // Horizontal ScrollViews in a flex column otherwise grow to fill the free space.
  noGrow: { flexGrow: 0, flexShrink: 0 },
  chips: { alignItems: 'center' },
  toolbar: { flexDirection: 'row' },
  stripHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  addTile: { width: 64, height: 86, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
});
