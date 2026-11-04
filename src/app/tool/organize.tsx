import { router, Stack, usePreventRemove } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ToolbarButton } from '@/components/scan/ToolbarButton';
import { DocumentSelectModal } from '@/components/tools/DocumentSelectModal';
import { ChooseDocumentCard } from '@/components/tools/DocumentSources';
import { PageTile } from '@/components/tools/PageTile';
import { ActionSheet, AppText, Button, EmptyState, LoadingState, ProgressOverlay, Screen } from '@/components/ui';
import { useSelectedDocument } from '@/hooks/useSelectedDocument';
import {
  deleteSelected,
  duplicateSelected,
  initialPlan,
  isUnchanged,
  moveSelected,
  type PlanPage,
  rotateSelected,
} from '@/services/pdf/pagePlan';
import { extractToNewDocument, loadPageCount, renderPageThumbnails, saveOrganised } from '@/services/tools/organizeService';
import { useAppTheme } from '@/theme';
import { errorMessage } from '@/utils/errors';

export default function OrganizeScreen() {
  const { colors, spacing } = useAppTheme();
  const { width } = useWindowDimensions();
  const { doc, loading, choose } = useSelectedDocument();
  const [picker, setPicker] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanPage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [saveSheet, setSaveSheet] = useState(false);

  const dirty = pageCount !== null && !isUnchanged(plan, pageCount);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let cleanup = () => undefined as void;
    loadPageCount(doc)
      .then((count) => {
        if (cancelled) return;
        setPageCount(count);
        setPlan(initialPlan(count));
        setSelected(new Set());
        setThumbs({});
        const job = renderPageThumbnails(doc, count, (index, uri) => setThumbs((t) => ({ ...t, [index]: uri })), () => cancelled);
        cleanup = job.cleanup;
      })
      .catch((error: unknown) => !cancelled && setLoadError(errorMessage(error)));
    return () => {
      cancelled = true;
      // Give an in-flight render a moment to finish before removing its folder.
      setTimeout(() => cleanup(), 1500);
    };
  }, [doc]);

  const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
    Alert.alert('Discard changes?', 'Your page changes have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: repeat },
    ]);
  });

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const confirmDelete = () => {
    if (selected.size === plan.length) {
      Alert.alert('Keep at least one page', 'A PDF needs at least one page. To remove the whole document, delete it from your library.');
      return;
    }
    Alert.alert(`Delete ${selected.size} ${selected.size === 1 ? 'page' : 'pages'}?`, 'They are removed when you save.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setPlan((p) => deleteSelected(p, selected));
          setSelected(new Set());
        },
      },
    ]);
  };

  const duplicate = () => {
    const result = duplicateSelected(plan, selected);
    setPlan(result.plan);
    setSelected(new Set(result.added));
  };

  const extract = async () => {
    if (!doc) return;
    setBusy('Extracting pages');
    try {
      const created = await extractToNewDocument(doc, plan.filter((p) => selected.has(p.key)));
      Alert.alert('Pages extracted', `"${created.name}" was added to your library.`, [
        { text: 'Stay here', style: 'cancel' },
        { text: 'Open', onPress: () => router.push({ pathname: '/document/[id]', params: { id: created.id } }) },
      ]);
    } catch (error) {
      Alert.alert('Could not extract pages', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const save = async (mode: 'copy' | 'replace') => {
    if (!doc) return;
    setBusy(mode === 'replace' ? 'Saving changes' : 'Saving copy');
    try {
      const saved = await saveOrganised(doc, plan, mode);
      disablePrevention();
      router.replace({ pathname: '/document/[id]', params: { id: saved.id } });
    } catch (error) {
      Alert.alert('Could not save', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const confirmReplace = () =>
    Alert.alert('Replace the original?', `"${doc?.name}" will be updated with your changes. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: () => void save('replace') },
    ]);

  const header = <Stack.Screen options={{ title: doc ? 'Organise pages' : 'Organise pages', headerRight: undefined }} />;

  if (loading) return <LoadingState />;
  if (!doc) {
    return (
      <Screen edges={['left', 'right', 'bottom']} contentStyle={{ paddingTop: spacing.lg }}>
        {header}
        <ChooseDocumentCard icon="albums-outline" title="Organise pages" message="Reorder, rotate, duplicate, delete or extract pages of a PDF." onChoose={() => setPicker(true)} onCreated={(d) => (choose(d))} />
        <DocumentSelectModal visible={picker} title="Choose a PDF" onClose={() => setPicker(false)} onSelect={([d]) => (setPicker(false), choose(d))} />
      </Screen>
    );
  }
  if (loadError) return <EmptyState icon="alert-circle-outline" title="Could not open this PDF" message={loadError} actionLabel="Back" onAction={() => router.back()} />;
  if (pageCount === null) return <LoadingState label="Reading pages…" />;

  const columns = width >= 700 ? 5 : width >= 480 ? 4 : 3;
  const tileWidth = (Math.min(width, 820) - spacing.lg * 2 - spacing.md * (columns - 1)) / columns;
  const hasSelection = selected.size > 0;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      {header}
      <View style={[styles.bar, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }]}>
        <AppText variant="caption" tone="muted" style={styles.flex} numberOfLines={1}>
          {hasSelection ? `${selected.size} selected` : `${plan.length} pages · tap pages to select`}
        </AppText>
        <Button
          label={selected.size === plan.length ? 'Clear' : 'Select all'}
          variant="ghost"
          compact
          onPress={() => setSelected(selected.size === plan.length ? new Set() : new Set(plan.map((p) => p.key)))}
        />
      </View>
      <FlatList
        key={columns}
        data={plan}
        numColumns={columns}
        keyExtractor={(p) => p.key}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
        initialNumToRender={18}
        windowSize={5}
        renderItem={({ item, index }) => (
          <PageTile number={index + 1} uri={thumbs[item.sourceIndex]} rotate={item.rotate} selected={selected.has(item.key)} width={tileWidth} onPress={() => toggle(item.key)} />
        )}
      />
      <View style={[styles.toolbar, { borderTopColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.xs }]}>
        <ToolbarButton icon="arrow-undo-outline" label="Left" disabled={!hasSelection} onPress={() => setPlan((p) => rotateSelected(p, selected, -90))} />
        <ToolbarButton icon="arrow-redo-outline" label="Right" disabled={!hasSelection} onPress={() => setPlan((p) => rotateSelected(p, selected, 90))} />
        <ToolbarButton icon="chevron-back" label="Earlier" disabled={!hasSelection} onPress={() => setPlan((p) => moveSelected(p, selected, -1))} />
        <ToolbarButton icon="chevron-forward" label="Later" disabled={!hasSelection} onPress={() => setPlan((p) => moveSelected(p, selected, 1))} />
        <ToolbarButton icon="copy-outline" label="Copy" disabled={!hasSelection} onPress={duplicate} />
        <ToolbarButton icon="exit-outline" label="Extract" disabled={!hasSelection} onPress={() => void extract()} />
        <ToolbarButton icon="trash-outline" label="Delete" destructive disabled={!hasSelection} onPress={confirmDelete} />
      </View>
      <View style={{ padding: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.surface }}>
        <Button label={dirty ? 'Save changes' : 'No changes yet'} icon="checkmark-circle-outline" fullWidth disabled={!dirty} onPress={() => setSaveSheet(true)} />
      </View>
      <ActionSheet
        visible={saveSheet}
        title="Save changes"
        onClose={() => setSaveSheet(false)}
        actions={[
          { key: 'copy', label: 'Save as a new copy', icon: 'copy-outline', hint: 'Keeps the original unchanged', onPress: () => save('copy') },
          { key: 'replace', label: 'Replace the original', icon: 'save-outline', destructive: true, onPress: confirmReplace },
        ]}
      />
      <ProgressOverlay visible={busy !== null} title={busy ?? ''} progress={null} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center' },
  toolbar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
});
