import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { ChoiceRow, Field } from '@/components/tools/FormBits';
import { SimpleDocTool } from '@/components/tools/SimpleDocTool';
import { ActivityIndicatorBox, AppText, Button } from '@/components/ui';
import { usePdfPages } from '@/hooks/usePdfPages';
import type { Margins } from '@/services/pdf/pageGeometry';
import { cropDocument } from '@/services/tools/basicTools';
import { useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';

const MAX = 0.45;
type Edge = keyof Margins;

function CropPreview({ doc, margins, onChange, page }: { doc: ScanDocument; margins: Margins; onChange: (m: Margins) => void; page: number }) {
  const { colors } = useAppTheme();
  const pages = usePdfPages(doc, 90);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const drag = useRef<{ edge: Edge; start: number; value: number } | null>(null);
  const aspect = pages.aspects[page] ?? 0.707;

  useEffect(() => {
    pages.ensure(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pages.pageCount]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    const w = Math.min(width, 320 * aspect);
    setBox({ width: w, height: w / aspect });
  };

  if (!pages.supported) return <AppText tone="muted">Preview unavailable on this device — margins are still applied.</AppText>;

  const W = box?.width ?? 0;
  const H = box?.height ?? 0;
  const grant = (edge: Edge) => (e: GestureResponderEvent) => {
    const horizontal = edge === 'left' || edge === 'right';
    drag.current = { edge, start: horizontal ? e.nativeEvent.pageX : e.nativeEvent.pageY, value: margins[edge] };
  };
  const moveEdge = (e: GestureResponderEvent) => {
    const d = drag.current;
    if (!d) return;
    const horizontal = d.edge === 'left' || d.edge === 'right';
    const delta = ((horizontal ? e.nativeEvent.pageX : e.nativeEvent.pageY) - d.start) / (horizontal ? W : H);
    const sign = d.edge === 'left' || d.edge === 'top' ? 1 : -1;
    const opposite: Edge = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[d.edge] as Edge;
    const limit = Math.min(MAX, 0.88 - margins[opposite]);
    onChange({ ...margins, [d.edge]: Math.min(limit, Math.max(0, d.value + sign * delta)) });
  };
  const handle = (edge: Edge) => {
    const m = margins;
    const left = m.left * W;
    const right = W - m.right * W;
    const top = m.top * H;
    const bottom = H - m.bottom * H;
    const pos =
      edge === 'top'
        ? { left: (left + right) / 2 - 24, top: top - 24 }
        : edge === 'bottom'
          ? { left: (left + right) / 2 - 24, top: bottom - 24 }
          : edge === 'left'
            ? { left: left - 24, top: (top + bottom) / 2 - 24 }
            : { left: right - 24, top: (top + bottom) / 2 - 24 };
    const bar = edge === 'top' || edge === 'bottom' ? { width: 30, height: 6 } : { width: 6, height: 30 };
    return (
      <View
        key={edge}
        style={[styles.handle, pos]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={grant(edge)}
        onResponderMove={moveEdge}
        onResponderRelease={() => (drag.current = null)}
        accessibilityRole="adjustable"
        accessibilityLabel={`${edge} crop edge, ${Math.round(margins[edge] * 100)} percent`}
      >
        <View style={[bar, { borderRadius: 3, backgroundColor: colors.primary }]} />
      </View>
    );
  };

  return (
    <View onLayout={onLayout} style={styles.previewWrap}>
      {box ? (
        <View style={{ width: W, height: H }}>
          {pages.images[page] ? <Image source={{ uri: pages.images[page] }} style={StyleSheet.absoluteFill} contentFit="fill" /> : <ActivityIndicatorBox />}
          {/* Dim the area that will be removed */}
          <View style={[styles.dim, { left: 0, top: 0, right: 0, height: margins.top * H }]} />
          <View style={[styles.dim, { left: 0, bottom: 0, right: 0, height: margins.bottom * H }]} />
          <View style={[styles.dim, { left: 0, top: margins.top * H, bottom: margins.bottom * H, width: margins.left * W }]} />
          <View style={[styles.dim, { right: 0, top: margins.top * H, bottom: margins.bottom * H, width: margins.right * W }]} />
          <View style={[styles.frame, { borderColor: colors.primary, left: margins.left * W, top: margins.top * H, right: margins.right * W, bottom: margins.bottom * H }]} pointerEvents="none" />
          {(['top', 'bottom', 'left', 'right'] as Edge[]).map(handle)}
        </View>
      ) : null}
    </View>
  );
}

export default function CropScreen() {
  const [margins, setMargins] = useState<Margins>({ top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 });
  const [scope, setScope] = useState<'all' | 'first'>('all');
  return (
    <SimpleDocTool
      title="Crop PDF"
      icon="crop-outline"
      intro="Trim margins or cut a region out of your pages. Drag the blue edges on the preview."
      actionLabel="Crop PDF"
      resultTitle="Cropped copy created"
      run={(doc) => cropDocument(doc, margins, scope === 'first' ? [0] : undefined)}
    >
      {(doc) => (
        <>
          <CropPreview doc={doc} margins={margins} onChange={setMargins} page={0} />
          <Field label="Apply to">
            <ChoiceRow options={[{ value: 'all', label: 'All pages' }, { value: 'first', label: 'First page only' }]} value={scope} onChange={setScope} />
          </Field>
          <Button label="Reset margins" variant="ghost" compact icon="refresh" onPress={() => setMargins({ top: 0, right: 0, bottom: 0, left: 0 })} />
        </>
      )}
    </SimpleDocTool>
  );
}

const styles = StyleSheet.create({
  previewWrap: { alignItems: 'center' },
  dim: { position: 'absolute', backgroundColor: 'rgba(11,27,63,0.45)' },
  frame: { position: 'absolute', borderWidth: 2 },
  handle: { position: 'absolute', width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
