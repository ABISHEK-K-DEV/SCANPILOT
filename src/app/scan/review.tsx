import { Image } from 'expo-image';
import { router, Stack, usePreventRemove } from 'expo-router';
import { useRef, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BusinessCardPanel } from '@/components/scan/BusinessCardPanel';
import { FilterStrip } from '@/components/scan/FilterStrip';
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
import type { FilterId } from '@/services/scan/filters';
import { filterImage, rotateImage } from '@/services/scan/pageProcessing';
import { savePagesAsPdf } from '@/services/scan/scanService';
import { PRESETS } from '@/services/scan/types';
import { isOcrSupported, recogniseImages } from '@/services/ocr/ocrService';
import { useScanSession } from '@/stores/scanSessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppTheme } from '@/theme';
import { errorMessage, isCancelled } from '@/utils/errors';
import { appAlert } from '@/stores/dialogStore';

type Sheet = 'add' | 'rename' | null;
type Panel = 'edit' | 'filters' | 'size' | 'contact';

const PANELS: { id: Panel; label: string; icon: 'crop-outline' | 'color-wand-outline' | 'document-text-outline' | 'contact' }[] = [
  { id: 'edit', label: 'Edit', icon: 'crop-outline' },
  { id: 'filters', label: 'Filter', icon: 'color-wand-outline' },
  { id: 'size', label: 'Options', icon: 'document-text-outline' },
];

export default function ScanReviewScreen() {
  const { colors, radius, spacing } = useAppTheme();
  // Small phones (or large system font): tighter spacing so the Save bar always fits.
  const { width: winW, height: winH } = useWindowDimensions();
  const compact = winH < 760;
  const narrow = winW < 380;
  const tight = winH < 620;
  const thumbW = tight ? 42 : compact ? 50 : 64;
  const { pages, selectedId, preset, name, folderId, mode, select, remove, move, update, setPreset, setName, clear } = useScanSession();
  const idSheet = mode === 'id-card' && pages.length <= 2;
  const panels = mode === 'business-card' ? [...PANELS, { id: 'contact' as const, label: 'Contact', icon: 'contact' as const }] : PANELS;
  const flow = useScanFlow();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [panel, setPanel] = useState<Panel>('edit');
  const ocrSupported = isOcrSupported();
  const ocrOn = useSettingsStore((st) => st.settings.scanOcr) && ocrSupported;
  const updateSetting = useSettingsStore((st) => st.update);
  const [savingTitle, setSavingTitle] = useState('Creating PDF');
  // Multi-page scans usually want one look for every page.
  const [filterScope, setFilterScope] = useState<'page' | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState<{ completed: number; total: number } | null>(null);
  const cancelToken = useRef({ cancelled: false });

  const index = Math.max(0, pages.findIndex((p) => p.id === selectedId));
  const page = pages[index] ?? null;

  const disablePrevention = usePreventRemove(pages.length > 0, ({ repeat }) => {
    appAlert('Discard this scan?', `${pages.length} ${pages.length === 1 ? 'page' : 'pages'} will be deleted.`, [
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
      appAlert('Something went wrong', errorMessage(error));
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
      const all = useScanSession.getState().pages;
      for (let i = 0; i < all.length; i += 1) {
        const p = all[i];
        if ((p.filter ?? 'original') === filter) continue; // already has this look
        setBusy(`Applying filter · page ${i + 1} of ${all.length}`);
        const base = p.base ?? { uri: p.uri, width: p.width, height: p.height };
        if (filter === 'original') update(p.id, { uri: base.uri, width: base.width, height: base.height, base: undefined, filter: undefined });
        else update(p.id, { ...(await filterImage(base.uri, filter)), base, filter });
      }
    });

  const confirmDelete = () => {
    if (!page) return;
    appAlert('Delete page?', `Page ${index + 1} will be removed from this scan.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(page.id) },
    ]);
  };

  const save = async () => {
    if (pages.length === 0) return;
    cancelToken.current = { cancelled: false };
    setSaving({ completed: 0, total: pages.length + 1 });
    try {
      // Searchable text: recognise each page on the phone before building the PDF.
      let textPages: Awaited<ReturnType<typeof recogniseImages>>['pages'] | undefined;
      if (ocrOn && !idSheet) {
        setSavingTitle('Reading text');
        try {
          textPages = (
            await recogniseImages(
              pages.map((p) => p.uri),
              'en',
              { cancelToken: cancelToken.current, onProgress: (completed, total) => setSaving({ completed, total }) },
            )
          ).pages;
        } catch (error) {
          if (isCancelled(error)) throw error;
          textPages = undefined; // Save without text rather than fail.
        }
      }
      setSavingTitle('Creating PDF');
      setSaving({ completed: 0, total: pages.length + 1 });
      const doc = await savePagesAsPdf(pages, {
        textPages,
        layout: idSheet ? 'id-card-sheet' : 'pages',
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
      if (!isCancelled(error)) appAlert('Could not save PDF', errorMessage(error));
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
            marginTop: compact ? spacing.xs : spacing.sm,
            marginBottom: compact ? spacing.sm : spacing.md,
            paddingHorizontal: spacing.md,
            minHeight: compact ? 40 : 48,
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

      {idSheet ? (
        <View style={[styles.notice, { marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radius.md, gap: spacing.sm }]}>
          <Icon name="id-card" size={16} color={colors.primary} />
          <AppText variant="caption" color={colors.primary} style={styles.flex}>
            {pages.length === 2 ? 'Front and back are saved together on one A4 page at real card size.' : 'Add the back of the card to save both sides on one page.'}
          </AppText>
        </View>
      ) : null}
      <View style={[styles.preview, { backgroundColor: colors.surfaceAlt, marginHorizontal: spacing.lg, borderRadius: radius.lg }]}>
        {page ? (
          <Image
            source={{ uri: page.uri }}
            style={styles.flex}
            contentFit="contain"
            transition={{ duration: 220, effect: 'cross-dissolve' }}
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

      <View style={[styles.stripHeader, { paddingHorizontal: spacing.lg, marginTop: compact ? 2 : spacing.sm }]}>
        <AppText variant="label" tone="subtle" style={styles.flex}>
          {pages.length} {pages.length === 1 ? 'PAGE' : 'PAGES'}
        </AppText>
        <IconButton style={tight ? { width: 36, height: 30 } : undefined} icon="chevron-back" label="Move page earlier" disabled={index === 0} onPress={() => page && move(page.id, -1)} />
        <IconButton style={tight ? { width: 36, height: 30 } : undefined} icon="chevron-forward" label="Move page later" disabled={index === pages.length - 1} onPress={() => page && move(page.id, 1)} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.noGrow}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 2 }}
      >
        {pages.map((p, i) => (
          <PageThumb key={p.id} page={p} index={i} width={thumbW} selected={p.id === page?.id} onPress={() => select(p.id)} />
        ))}
        <Pressable
          onPress={() => setSheet('add')}
          accessibilityRole="button"
          accessibilityLabel="Add pages"
          style={({ pressed }) => [
            styles.addTile,
            { width: thumbW, height: Math.round(thumbW * 1.34) },
            { borderColor: colors.primary, borderRadius: radius.sm + 2, backgroundColor: pressed ? colors.surfacePressed : colors.primarySoft },
          ]}
        >
          <Icon name="file-plus" size={22} color={colors.primary} />
          <AppText variant="label" tone="primary" align="center" style={styles.addLabel}>
            Add page
          </AppText>
        </Pressable>
      </ScrollView>

      <View style={[styles.segment, { marginHorizontal: spacing.lg, marginTop: compact ? spacing.sm : spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]} accessibilityRole="tablist">
        {panels.map((tab) => {
          const active = panel === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
                setPanel(tab.id);
              }}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              style={[styles.segmentItem, { minHeight: compact ? 34 : 38,  borderRadius: radius.md - 3, backgroundColor: active ? colors.surface : 'transparent' }, active && styles.segmentShadow]}
            >
              <Icon name={tab.icon} size={16} color={active ? colors.primary : colors.textMuted} />
              <AppText variant="caption" color={active ? colors.text : colors.textMuted} style={styles.segmentLabel}>
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.panel, { minHeight: compact ? 92 : 112 }]}>
        {panel === 'edit' ? (
          <View style={[styles.toolbar, { paddingHorizontal: spacing.sm }]}>
            <ToolbarButton icon="arrow-undo-outline" label="Left" onPress={() => void rotate(-90)} />
            <ToolbarButton icon="arrow-redo-outline" label="Right" onPress={() => void rotate(90)} />
            <ToolbarButton icon="crop-outline" label="Crop" onPress={() => page && router.push({ pathname: '/scan/crop', params: { id: page.id } })} />
            <ToolbarButton icon="camera-reverse-outline" label="Retake" onPress={() => page && void flow.capture({ replace: page.id })} />
            <ToolbarButton icon="trash-outline" label="Delete" destructive onPress={confirmDelete} />
          </View>
        ) : panel === 'contact' && pages[0] ? (
          <BusinessCardPanel imageUri={pages[0].uri} />
        ) : panel === 'filters' && page ? (
          <FilterStrip
            page={page}
            compact={compact}
            busy={busy !== null}
            pageCount={pages.length}
            scope={filterScope}
            onScopeChange={setFilterScope}
            onSelect={(f) => void (filterScope === 'all' && pages.length > 1 ? applyToAll(f) : setFilter(f))}
          />
        ) : (
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
        )}
        {panel === 'size' && ocrSupported && !idSheet ? (
          <View style={[styles.ocrRow, { marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderColor: colors.border, gap: spacing.sm }]}>
            <Icon name="scan-text" size={18} color={colors.primary} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                Searchable text (OCR)
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                Copy and search the words in your PDF
              </AppText>
            </View>
            <Switch value={ocrOn} onValueChange={(v) => void updateSetting('scanOcr', v)} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel="Searchable text (OCR)" />
          </View>
        ) : null}
      </View>

      <View style={[styles.saveBar, { paddingHorizontal: spacing.lg, paddingTop: compact ? spacing.sm : spacing.md, paddingBottom: compact ? spacing.sm : spacing.md, gap: spacing.sm, borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <Button label={narrow ? 'Scan' : 'Scan more'} icon="camera" variant="secondary" onPress={() => void flow.capture('append')} accessibilityHint="Opens the camera to add pages" />
        <Button
          label={narrow ? `Save PDF (${pages.length})` : `Save PDF · ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`}
          accessibilityHint={`Saves ${pages.length} ${pages.length === 1 ? 'page' : 'pages'} as a PDF`}
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
          { key: 'scan', label: 'Scan with camera', hint: 'Added after the last page', icon: 'camera', onPress: () => flow.capture('append') },
          { key: 'photos', label: 'Add from photos', hint: 'Pick images from your gallery', icon: 'image-plus', onPress: () => flow.addFromPhotos('append') },
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
        title={savingTitle}
        detail={savingTitle === 'Reading text' && saving ? `Page ${Math.min(saving.completed + 1, saving.total)} of ${saving.total} · on this phone` : undefined}
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
  preview: { flex: 1, overflow: 'hidden', minHeight: 64 },
  counter: { position: 'absolute', bottom: 12, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4 },
  counterText: { fontWeight: '600' },
  saveBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  addIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // Horizontal ScrollViews in a flex column otherwise grow to fill the free space.
  noGrow: { flexGrow: 0, flexShrink: 0 },
  chips: { alignItems: 'center' },
  toolbar: { flexDirection: 'row' },
  stripHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  addTile: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addLabel: { fontSize: 10.5, lineHeight: 13 },
  segment: { flexDirection: 'row', padding: 3 },
  ocrRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  notice: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9 },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segmentShadow: { shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentLabel: { fontWeight: '600' },
  panel: { justifyContent: 'center' },
});
