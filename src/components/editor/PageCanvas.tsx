import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { ActivityIndicator, type GestureResponderEvent, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Ellipse, G, Image as SvgImage, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { type Box, type EditorItem, type EditorTool, hitTest, moveItem, resizeBoxed, type ShapeTool } from '@/services/editor/model';
import type { Pt, RgbColor } from '@/services/pdf/pdfService';
import { useAppTheme } from '@/theme';

import { arrowHead, rgbCss, strokePath } from './svgPaths';

interface PageCanvasProps {
  page: number;
  imageUri?: string;
  /** Displayed page width / height. */
  aspect: number;
  items: EditorItem[];
  tool: EditorTool;
  color: RgbColor;
  /** Stroke width as a fraction of page width. */
  strokeWidth: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Called with the new item list after a gesture ends (one undo step per call). */
  onCommit: (items: EditorItem[]) => void;
  onTextRequest: (at: Pt) => void;
}

const HANDLE = 28;

type Gesture =
  | { kind: 'draw'; points: Pt[] }
  | { kind: 'shape'; from: Pt; to: Pt }
  | { kind: 'move'; id: string; start: Pt; original: EditorItem }
  | { kind: 'resize'; id: string; start: Pt; original: EditorItem }
  | null;

/** Interactive page: draws, places, moves and resizes editor items. */
export function PageCanvas({ page, imageUri, aspect, items, tool, color, strokeWidth, selectedId, onSelect, onCommit, onTextRequest }: PageCanvasProps) {
  const { colors } = useAppTheme();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [preview, setPreviewState] = useState<EditorItem[] | null>(null);
  // The latest draft lives in a ref: the release handler may run before React re-renders.
  const previewRef = useRef<EditorItem[] | null>(null);
  const setPreview = (next: EditorItem[] | null) => {
    previewRef.current = next;
    setPreviewState(next);
  };
  const gesture = useRef<Gesture>(null);
  // Screen origin of the touch layer, captured when a gesture starts (pageX − locationX on a
  // child-less layer). Robust while the page scrolls or a modal is still animating in.
  const windowPos = useRef({ x: 0, y: 0 });
  const shown = preview ?? items;
  const pageItems = shown.filter((it) => it.page === page);
  const selected = pageItems.find((it) => it.id === selectedId) ?? null;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    // Fit the page inside the available area.
    const w = Math.min(width, height * aspect);
    setSize({ width: w, height: w / aspect });
  };

  const toPt = (e: GestureResponderEvent): Pt => {
    if (!size) return { x: 0, y: 0 };
    const { pageX, pageY } = e.nativeEvent;
    const lx = pageX - windowPos.current.x;
    const ly = pageY - windowPos.current.y;
    return { x: Math.min(1, Math.max(0, lx / size.width)), y: Math.min(1, Math.max(0, ly / size.height)) };
  };

  const inHandle = (p: Pt, b: Box) => {
    if (!size) return false;
    const hx = (b.x + b.w) * size.width;
    const hy = (b.y + b.h) * size.height;
    return Math.abs(p.x * size.width - hx) < HANDLE && Math.abs(p.y * size.height - hy) < HANDLE;
  };

  const begin = (e: GestureResponderEvent) => {
    const p = toPt(e);
    if (tool === 'select') {
      if (selected && 'box' in selected && inHandle(p, selected.box)) {
        gesture.current = { kind: 'resize', id: selected.id, start: p, original: selected };
        return;
      }
      const hit = hitTest(items, page, p);
      onSelect(hit?.id ?? null);
      gesture.current = hit ? { kind: 'move', id: hit.id, start: p, original: hit } : null;
      return;
    }
    if (tool === 'text') {
      gesture.current = null;
      onTextRequest(p);
      return;
    }
    if (tool === 'pen' || tool === 'highlighter') gesture.current = { kind: 'draw', points: [p] };
    else gesture.current = { kind: 'shape', from: p, to: p };
  };

  const draft = (g: NonNullable<Gesture>): EditorItem[] => {
    if (g.kind === 'draw') {
      const highlighter = tool === 'highlighter';
      return [
        ...items,
        {
          id: 'draft',
          page,
          kind: 'ink',
          strokes: [g.points],
          color: highlighter ? { r: 1, g: 0.86, b: 0.1 } : color,
          width: highlighter ? strokeWidth * 4 : strokeWidth,
          opacity: highlighter ? 0.38 : 1,
        },
      ];
    }
    if (g.kind === 'shape') return [...items, { id: 'draft', page, kind: 'shape', shape: tool as ShapeTool, from: g.from, to: g.to, color, width: strokeWidth }];
    return items;
  };

  const move = (e: GestureResponderEvent) => {
    const g = gesture.current;
    if (!g) return;
    const p = toPt(e);
    if (g.kind === 'draw') {
      const last = g.points[g.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 0.003) g.points.push(p);
      setPreview(draft(g));
    } else if (g.kind === 'shape') {
      g.to = p;
      setPreview(draft(g));
    } else if (g.kind === 'move') {
      const moved = moveItem(g.original, p.x - g.start.x, p.y - g.start.y);
      setPreview(items.map((it) => (it.id === g.id ? moved : it)));
    } else if (g.kind === 'resize' && 'box' in g.original) {
      const o = g.original;
      const resized = resizeBoxed(o, o.box.w + (p.x - g.start.x), o.box.h + (p.y - g.start.y), aspect);
      setPreview(items.map((it) => (it.id === g.id ? resized : it)));
    }
  };

  const end = () => {
    const g = gesture.current;
    gesture.current = null;
    const next = previewRef.current;
    setPreview(null);
    if (!g || !next) return;
    if (g.kind === 'shape' && Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y) < 0.01) return; // a tap, not a shape
    onCommit(next.map((it) => (it.id === 'draft' ? { ...it, id: `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` } : it)));
  };

  const W = size?.width ?? 0;
  const H = size?.height ?? 0;

  const renderItem = (it: EditorItem) => {
    switch (it.kind) {
      case 'ink':
        return it.strokes.map((s, i) => (
          <Path key={`${it.id}-${i}`} d={strokePath(s, W, H)} stroke={rgbCss(it.color)} strokeOpacity={it.opacity} strokeWidth={Math.max(1, it.width * W)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ));
      case 'signature':
        return it.strokes.map((s, i) => (
          <Path
            key={`${it.id}-${i}`}
            d={strokePath(s.map((p) => ({ x: it.box.x + p.x * it.box.w, y: it.box.y + p.y * it.box.h })), W, H)}
            stroke={rgbCss(it.color)}
            strokeWidth={Math.max(1, it.box.w * 0.025 * W)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ));
      case 'shape': {
        const x = Math.min(it.from.x, it.to.x) * W;
        const y = Math.min(it.from.y, it.to.y) * H;
        const w = Math.abs(it.to.x - it.from.x) * W;
        const h = Math.abs(it.to.y - it.from.y) * H;
        const sw = Math.max(1, it.width * W);
        const stroke = rgbCss(it.color);
        if (it.shape === 'whiteout') return <Rect key={it.id} x={x} y={y} width={w} height={h} fill="#FFFFFF" stroke="#C9D2E3" strokeDasharray="4 3" strokeWidth={1} />;
        if (it.shape === 'redact') return <Rect key={it.id} x={x} y={y} width={w} height={h} fill="#000000" />;
        if (it.shape === 'rect') return <Rect key={it.id} x={x} y={y} width={w} height={h} fill="none" stroke={stroke} strokeWidth={sw} />;
        if (it.shape === 'ellipse') return <Ellipse key={it.id} cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill="none" stroke={stroke} strokeWidth={sw} />;
        return (
          <G key={it.id}>
            <Line x1={it.from.x * W} y1={it.from.y * H} x2={it.to.x * W} y2={it.to.y * H} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
            {it.shape === 'arrow' ? <Path d={arrowHead(it.from, it.to, W, H, W * 0.04)} stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" /> : null}
          </G>
        );
      }
      case 'text': {
        const lines = it.text.split('\n');
        const lineH = (it.box.h * H) / lines.length;
        return (
          <G key={it.id}>
            {lines.map((line, i) => (
              <SvgText key={i} x={it.box.x * W} y={it.box.y * H + lineH * (i + 0.8)} fontSize={lineH * 0.8} fill={rgbCss(it.color)} fontFamily="Helvetica">
                {line}
              </SvgText>
            ))}
          </G>
        );
      }
      case 'image':
        return <SvgImage key={it.id} x={it.box.x * W} y={it.box.y * H} width={it.box.w * W} height={it.box.h * H} href={{ uri: it.uri }} preserveAspectRatio="none" />;
    }
  };

  const selectedBox = selected
    ? 'box' in selected
      ? selected.box
      : (() => {
          const xs = selected.kind === 'ink' ? selected.strokes.flat().map((p) => p.x) : [selected.from.x, selected.to.x];
          const ys = selected.kind === 'ink' ? selected.strokes.flat().map((p) => p.y) : [selected.from.y, selected.to.y];
          return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
        })()
    : null;

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {size ? (
        <View style={[styles.page, { width: W, height: H, backgroundColor: '#FFFFFF' }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="fill" pointerEvents="none" />
          ) : (
            <ActivityIndicator style={styles.loading} color={colors.primary} />
          )}
          <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
            {pageItems.map(renderItem)}
            {selectedBox ? (
              <G>
                <Rect x={selectedBox.x * W - 4} y={selectedBox.y * H - 4} width={selectedBox.w * W + 8} height={selectedBox.h * H + 8} fill="none" stroke={colors.primary} strokeWidth={1.5} strokeDasharray="6 4" />
                {selected && 'box' in selected ? (
                  <Rect x={(selectedBox.x + selectedBox.w) * W - 9} y={(selectedBox.y + selectedBox.h) * H - 9} width={18} height={18} rx={9} fill={colors.primary} stroke="#FFFFFF" strokeWidth={2} />
                ) : null}
              </G>
            ) : null}
          </Svg>
          {/* Stable touch layer on top: owns the whole gesture even while the drawing re-renders. */}
          <View
            style={StyleSheet.absoluteFill}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={(e) => {
              windowPos.current = { x: e.nativeEvent.pageX - e.nativeEvent.locationX, y: e.nativeEvent.pageY - e.nativeEvent.locationY };
              begin(e);
            }}
            onResponderMove={move}
            onResponderRelease={end}
            onResponderTerminate={end}
            accessible
            accessibilityLabel={`Page ${page + 1} editing area`}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  loading: { flex: 1 },
});
