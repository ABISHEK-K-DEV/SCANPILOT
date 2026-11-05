import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { router, Stack, usePreventRemove } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ToolbarButton } from '@/components/scan/ToolbarButton';
import { GuideButton } from '@/components/guide/ToolGuide';
import { DocumentSelectModal } from '@/components/tools/DocumentSelectModal';
import { ChooseDocumentCard } from '@/components/tools/DocumentSources';
import { AppText, Button, EmptyState, IconButton, type IconName, LoadingState, ProgressOverlay, Screen, TextPromptModal } from '@/components/ui';
import { usePdfPages } from '@/hooks/usePdfPages';
import { useSelectedDocument } from '@/hooks/useSelectedDocument';
import { type EditorItem, type EditorTool, newItemId, trimStrokes } from '@/services/editor/model';
import { addSignature, listSignatures, removeSignature, type SavedSignature } from '@/services/editor/signatures';
import { type Pt, type RgbColor, unsupportedCharacters } from '@/services/pdf/pdfService';
import { readBytes } from '@/services/storage/fileStore';
import { saveEdits, saveRedactions } from '@/services/tools/editService';
import { useAppTheme } from '@/theme';
import { errorMessage } from '@/utils/errors';

import { PageCanvas } from './PageCanvas';
import { INK_COLORS, SignaturePad } from './SignaturePad';
import { rgbCss, strokePath } from './svgPaths';
import { appAlert } from '@/stores/dialogStore';

export type EditorMode = 'sign' | 'edit' | 'redact';

const MODE: Record<EditorMode, { title: string; suffix: string; tools: { tool: EditorTool | 'signature' | 'date' | 'image'; icon: IconName; label: string }[] }> = {
  sign: {
    title: 'Sign PDF',
    suffix: 'signed',
    tools: [
      { tool: 'signature', icon: 'pencil', label: 'Signature' },
      { tool: 'text', icon: 'text', label: 'Text' },
      { tool: 'date', icon: 'calendar-outline', label: 'Date' },
      { tool: 'select', icon: 'hand-left-outline', label: 'Move' },
    ],
  },
  edit: {
    title: 'Edit PDF',
    suffix: 'edited',
    tools: [
      { tool: 'select', icon: 'hand-left-outline', label: 'Move' },
      { tool: 'pen', icon: 'brush-outline', label: 'Pen' },
      { tool: 'highlighter', icon: 'color-wand-outline', label: 'Highlight' },
      { tool: 'text', icon: 'text', label: 'Text' },
      { tool: 'rect', icon: 'square-outline', label: 'Box' },
      { tool: 'ellipse', icon: 'ellipse-outline', label: 'Circle' },
      { tool: 'arrow', icon: 'arrow-forward', label: 'Arrow' },
      { tool: 'line', icon: 'remove-outline', label: 'Line' },
      { tool: 'whiteout', icon: 'square', label: 'Whiteout' },
      { tool: 'image', icon: 'image-outline', label: 'Image' },
      { tool: 'signature', icon: 'pencil', label: 'Sign' },
      { tool: 'date', icon: 'calendar-outline', label: 'Date' },
    ],
  },
  redact: {
    title: 'Redact PDF',
    suffix: 'redacted',
    tools: [
      { tool: 'redact', icon: 'square', label: 'Redact' },
      { tool: 'select', icon: 'hand-left-outline', label: 'Move' },
    ],
  },
};

const PALETTE: RgbColor[] = [INK_COLORS[0].color, INK_COLORS[1].color, INK_COLORS[2].color, { r: 0.1, g: 0.55, b: 0.3 }, { r: 0.95, g: 0.55, b: 0.05 }];
const WIDTHS = [0.003, 0.006, 0.012];
const LINE_H = 0.035;

function SignaturePreview({ sig, width }: { sig: SavedSignature; width: number }) {
  const height = Math.min(56, width / sig.aspect);
  const w = height * sig.aspect;
  return (
    <Svg width={w} height={height}>
      {sig.strokes.map((s, i) => (
        <Path key={i} d={strokePath(s, w, height)} stroke={rgbCss(sig.color)} strokeWidth={2} strokeLinecap="round" fill="none" />
      ))}
    </Svg>
  );
}

export function PdfEditor({ mode }: { mode: EditorMode }) {
  const { colors, spacing, radius } = useAppTheme();
  const config = MODE[mode];
  const { doc, loading, choose } = useSelectedDocument();
  const pages = usePdfPages(doc);
  const [picker, setPicker] = useState(false);
  const [page, setPage] = useState(0);
  const [history, setHistory] = useState<EditorItem[][]>([[]]);
  const [cursor, setCursor] = useState(0);
  const [tool, setTool] = useState<EditorTool>(mode === 'redact' ? 'redact' : mode === 'edit' ? 'pen' : 'select');
  const [color, setColor] = useState<RgbColor>(PALETTE[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textAt, setTextAt] = useState<Pt | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'signatures' | null>(null);
  const [pad, setPad] = useState(false);
  const [saved, setSaved] = useState<SavedSignature[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const items = history[cursor];
  const aspect = pages.aspects[page] ?? 0.707;
  const dirty = items.length > 0;

  useEffect(() => {
    void listSignatures().then(setSaved);
  }, []);

  useEffect(() => {
    pages.ensure(page);
    pages.ensure(page + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pages.pageCount]);

  const disablePrevention = usePreventRemove(dirty && busy === null, ({ repeat }) => {
    appAlert('Discard changes?', 'Your edits have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: repeat },
    ]);
  });

  const commit = (next: EditorItem[]) => {
    setHistory((h) => [...h.slice(0, cursor + 1), next]);
    setCursor((c) => c + 1);
  };

  const add = (item: EditorItem) => {
    commit([...items, item]);
    setSelectedId(item.id);
    setTool('select');
  };

  const placeSignature = (sig: { strokes: Pt[][]; aspect: number; color: RgbColor }) => {
    const w = 0.36;
    const h = Math.min(0.3, (w * aspect) / sig.aspect);
    add({ id: newItemId(), page, kind: 'signature', box: { x: 0.5 - w / 2, y: 0.72 - h / 2, w, h }, strokes: sig.strokes, color: sig.color });
  };

  const addText = (text: string, at: Pt) => {
    const lines = text.split('\n');
    const longest = Math.max(...lines.map((l) => l.length));
    const h = LINE_H * lines.length;
    const w = Math.min(1 - at.x, Math.max(0.08, (longest * LINE_H * 0.55) / aspect));
    add({ id: newItemId(), page, kind: 'text', box: { x: Math.min(at.x, 0.95 - w), y: Math.min(at.y, 1 - h), w, h }, text, color });
  };

  const addImage = async () => {
    const result = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > 1600) ctx.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
    const savedImg = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.88 });
    const bytes = await readBytes(savedImg.uri);
    const imgAspect = savedImg.width / savedImg.height;
    const w = 0.4;
    const h = Math.min(0.5, (w * aspect) / imgAspect);
    add({ id: newItemId(), page, kind: 'image', box: { x: 0.3, y: 0.3, w, h }, uri: new File(savedImg.uri).uri, bytes, mimeType: 'image/jpeg', aspect: imgAspect });
  };

  const pickTool = (t: (typeof config.tools)[number]['tool']) => {
    setSelectedId(null);
    if (t === 'signature') {
      if (saved.length > 0) setSheet('signatures');
      else setPad(true);
      return;
    }
    if (t === 'date') {
      addText(new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }), { x: 0.1, y: 0.85 });
      return;
    }
    if (t === 'image') {
      void addImage().catch((e: unknown) => appAlert('Could not add image', errorMessage(e)));
      return;
    }
    setTool(t);
  };

  const selected = items.find((it) => it.id === selectedId) ?? null;

  const save = async () => {
    if (!doc) return;
    setBusy(0);
    try {
      const created = mode === 'redact' ? await saveRedactions(doc, items, (d, t) => setBusy(d / t)) : await saveEdits(doc, items, pages.aspects, config.suffix);
      disablePrevention();
      router.replace({ pathname: '/document/[id]', params: { id: created.id } });
    } catch (error) {
      appAlert('Could not save', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <Stack.Screen
      options={{
        title: config.title,
        headerRight: doc
          ? () => (
              <View style={styles.row}>
                <IconButton icon="arrow-undo-outline" label="Undo" disabled={cursor === 0} onPress={() => (setCursor((c) => c - 1), setSelectedId(null))} />
                <IconButton icon="arrow-redo-outline" label="Redo" disabled={cursor >= history.length - 1} onPress={() => setCursor((c) => c + 1)} />
                <Button label="Save" compact disabled={!dirty} onPress={() => void save()} />
              </View>
            )
          : () => <GuideButton />,
      }}
    />
  );

  if (loading) return <LoadingState />;
  if (!doc) {
    return (
      <Screen edges={['left', 'right', 'bottom']} contentStyle={{ paddingTop: spacing.lg }}>
        {header}
        <ChooseDocumentCard
          icon={mode === 'sign' ? 'pencil' : mode === 'redact' ? 'eye-off-outline' : 'create-outline'}
          title={config.title}
          message={
            mode === 'sign'
              ? 'Draw your signature once, then place it on any page. Add text and dates too.'
              : mode === 'redact'
                ? 'Black out sensitive information. Redacted pages are flattened, so the hidden content is truly removed.'
                : 'Add text, highlights, drawings, shapes, images and whiteout. A new copy is saved.'
          }
          onChoose={() => setPicker(true)}
          onCreated={(d) => choose(d)}
        />
        <DocumentSelectModal visible={picker} title="Choose a PDF" onClose={() => setPicker(false)} onSelect={([d]) => (setPicker(false), choose(d))} />
      </Screen>
    );
  }
  if (!pages.supported) return <EmptyState icon="phone-portrait-outline" title="Not available on this device yet" message="Page editing uses Android's built-in PDF renderer. iOS support is coming." />;
  if (pages.error && pages.pageCount === null) return <EmptyState icon="alert-circle-outline" title="Could not open this PDF" message={pages.error} actionLabel="Back" onAction={() => router.back()} />;
  if (pages.pageCount === null) return <LoadingState label="Opening pages…" />;

  const showStyle = mode === 'edit' && (tool === 'pen' || tool === 'text' || tool === 'rect' || tool === 'ellipse' || tool === 'arrow' || tool === 'line');

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.surfaceAlt }]}>
      {header}
      {mode === 'redact' ? (
        <View style={[styles.banner, { backgroundColor: colors.warningSoft, padding: spacing.sm }]}>
          <AppText variant="caption" align="center" color={colors.text}>
            Draw boxes over what to hide. Pages with boxes are flattened to images when saved.
          </AppText>
        </View>
      ) : null}
      <View style={[styles.pager, { paddingHorizontal: spacing.lg }]}>
        <IconButton icon="chevron-back" label="Previous page" disabled={page === 0} onPress={() => (setPage((p) => p - 1), setSelectedId(null))} />
        <AppText variant="bodyStrong">
          Page {page + 1} of {pages.pageCount}
        </AppText>
        <IconButton icon="chevron-forward" label="Next page" disabled={page >= pages.pageCount - 1} onPress={() => (setPage((p) => p + 1), setSelectedId(null))} />
      </View>
      <View style={[styles.flex, { padding: spacing.md }]}>
        <PageCanvas
          page={page}
          imageUri={pages.images[page]}
          aspect={aspect}
          items={items}
          tool={tool}
          color={color}
          strokeWidth={width}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCommit={commit}
          onTextRequest={setTextAt}
        />
      </View>
      {selected ? (
        <View style={[styles.contextBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingHorizontal: spacing.lg, gap: spacing.sm }]}>
          <AppText variant="caption" tone="muted" style={styles.flex}>
            Drag to move{'box' in selected ? ' · drag the dot to resize' : ''}
          </AppText>
          {selected.kind === 'text' ? <Button label="Edit" variant="ghost" compact onPress={() => setEditingText(selected.text)} /> : null}
          <Button
            label="Delete"
            variant="danger"
            compact
            icon="trash-outline"
            onPress={() => {
              commit(items.filter((it) => it.id !== selected.id));
              setSelectedId(null);
            }}
          />
        </View>
      ) : showStyle ? (
        <View style={[styles.contextBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingHorizontal: spacing.lg, gap: spacing.md }]}>
          {PALETTE.map((c, i) => (
            <Pressable
              key={i}
              onPress={() => setColor(c)}
              accessibilityRole="radio"
              accessibilityLabel={`Colour ${i + 1}`}
              accessibilityState={{ checked: c === color }}
              style={[styles.swatch, { backgroundColor: rgbCss(c), borderColor: c === color ? colors.primary : colors.surface }]}
            />
          ))}
          <View style={styles.flex} />
          {WIDTHS.map((w, i) => (
            <Pressable
              key={w}
              onPress={() => setWidth(w)}
              accessibilityRole="radio"
              accessibilityLabel={['Thin', 'Medium', 'Thick'][i]}
              accessibilityState={{ checked: w === width }}
              style={[styles.widthBtn, { borderColor: w === width ? colors.primary : colors.border, borderRadius: radius.sm }]}
            >
              <View style={{ width: 16, height: 2 + i * 3, borderRadius: 3, backgroundColor: colors.text }} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.noGrow, { backgroundColor: colors.surface }]} contentContainerStyle={{ paddingHorizontal: spacing.sm }}>
        {config.tools.map((t) => {
          const active = t.tool === tool;
          return (
            <View key={t.label} style={[styles.toolWrap, active && { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
              <ToolbarButton icon={t.icon} label={t.label} onPress={() => pickTool(t.tool)} />
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={sheet === 'signatures'} transparent animationType="slide" onRequestClose={() => setSheet(null)} statusBarTranslucent>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => setSheet(null)} accessibilityLabel="Close" />
        <View style={[styles.sigSheet, { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.md }]}>
          <AppText variant="heading">Your signatures</AppText>
          <View style={[styles.sigGrid, { gap: spacing.md }]}>
            {saved.map((sig, i) => (
              <Pressable
                key={sig.id}
                onPress={() => {
                  setSheet(null);
                  placeSignature(sig);
                }}
                onLongPress={() =>
                  appAlert('Delete this signature?', 'It is stored only on this device.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => void removeSignature(sig.id).then(setSaved) },
                  ])
                }
                accessibilityRole="button"
                accessibilityLabel={`Place signature ${i + 1}`}
                accessibilityHint="Long press to delete"
                style={({ pressed }) => [styles.sigCard, { borderColor: colors.border, borderRadius: radius.md, backgroundColor: pressed ? colors.surfacePressed : '#FFFFFF' }]}
              >
                <SignaturePreview sig={sig} width={140} />
              </Pressable>
            ))}
          </View>
          <AppText variant="caption" tone="subtle">
            Tap to place · long-press to delete
          </AppText>
          <Button label="Draw a new signature" icon="add" variant="secondary" onPress={() => (setSheet(null), setPad(true))} />
        </View>
      </Modal>
      <SignaturePad
        visible={pad}
        onCancel={() => setPad(false)}
        onDone={(strokes, inkColor, padAspect) => {
          setPad(false);
          const trimmed = trimStrokes(strokes);
          if (!trimmed) return;
          const sig: SavedSignature = { id: newItemId(), strokes: trimmed.strokes, aspect: trimmed.aspect * padAspect, color: inkColor, createdAt: Date.now() };
          void addSignature(sig).then(setSaved);
          placeSignature(sig);
        }}
      />
      <TextPromptModal
        visible={textAt !== null || editingText !== null}
        title={editingText !== null ? 'Edit text' : 'Add text'}
        initialValue={editingText ?? ''}
        placeholder="Type here"
        confirmLabel={editingText !== null ? 'Update' : 'Add'}
        validate={(v) => {
          if (!v.trim()) return 'Enter some text.';
          const bad = unsupportedCharacters(v);
          return bad.length ? `Not supported yet: ${bad.slice(0, 6).join(' ')} — use Latin letters and numbers.` : null;
        }}
        onCancel={() => (setTextAt(null), setEditingText(null))}
        onSubmit={(value) => {
          if (editingText !== null && selected?.kind === 'text') {
            commit(items.map((it) => (it.id === selected.id && it.kind === 'text' ? { ...it, text: value, box: { ...it.box, h: LINE_H * value.split('\n').length } } : it)));
          } else if (textAt) addText(value, textAt);
          setTextAt(null);
          setEditingText(null);
        }}
      />
      <ProgressOverlay visible={busy !== null} title={mode === 'redact' ? 'Redacting pages' : 'Saving PDF'} progress={mode === 'redact' ? busy : null} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  banner: {},
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  contextBar: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 3 },
  widthBtn: { width: 36, height: 32, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  toolWrap: { width: 72, marginVertical: 4 },
  noGrow: { flexGrow: 0 },
  backdrop: { ...StyleSheet.absoluteFill },
  sigSheet: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sigGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  sigCard: { width: 156, height: 72, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
