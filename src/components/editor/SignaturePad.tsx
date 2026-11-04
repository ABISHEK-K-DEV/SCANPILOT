import { useEffect, useRef, useState } from 'react';
import { BackHandler, type GestureResponderEvent, type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';

import { AppText, Button, IconButton } from '@/components/ui';
import type { Pt, RgbColor } from '@/services/pdf/pdfService';
import { useAppTheme } from '@/theme';

import { rgbCss, strokePath } from './svgPaths';

export const INK_COLORS: { label: string; color: RgbColor }[] = [
  { label: 'Black', color: { r: 0.05, g: 0.07, b: 0.12 } },
  { label: 'Blue', color: { r: 0.1, g: 0.25, b: 0.75 } },
  { label: 'Red', color: { r: 0.78, g: 0.12, b: 0.12 } },
];

interface SignaturePadProps {
  visible: boolean;
  title?: string;
  onCancel: () => void;
  /** Raw strokes in pad fractions plus the pad aspect (w/h). */
  onDone: (strokes: Pt[][], color: RgbColor, padAspect: number) => void;
}

/**
 * Full-screen drawing pad for signatures. Rendered as an overlay inside the
 * screen (not a Modal) so it shares the exact touch handling of the page canvas.
 */
export function SignaturePad({ visible, title = 'Draw your signature', onCancel, onDone }: SignaturePadProps) {
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [visible, onCancel]);
  if (!visible) return null;
  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <PadBody title={title} onCancel={onCancel} onDone={onDone} />
    </View>
  );
}

function PadBody({ title, onCancel, onDone }: Omit<SignaturePadProps, 'visible'> & { title: string }) {
  const { colors, spacing, radius } = useAppTheme();
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [strokes, setStrokes] = useState<Pt[][]>([]);
  const [current, setCurrent] = useState<Pt[] | null>(null);
  const [ink, setInk] = useState(INK_COLORS[0]);
  const live = useRef<Pt[]>([]);
  const windowPos = useRef({ x: 0, y: 0 });

  // Screen origin of the touch layer, captured at gesture start (see PageCanvas).
  const pt = (e: GestureResponderEvent): Pt => ({
    x: Math.min(1, Math.max(0, (e.nativeEvent.pageX - windowPos.current.x) / size.width)),
    y: Math.min(1, Math.max(0, (e.nativeEvent.pageY - windowPos.current.y) / size.height)),
  });

  const finishStroke = () => {
    // Capture before clearing: the state updater runs later, after `live.current` is reset.
    const stroke = live.current;
    live.current = [];
    setCurrent(null);
    if (stroke.length > 0) setStrokes((st) => [...st, stroke]);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingHorizontal: spacing.sm }]}>
        <IconButton icon="close" label="Cancel" onPress={onCancel} />
        <AppText variant="heading" style={styles.flex}>
          {title}
        </AppText>
        <IconButton icon="arrow-undo-outline" label="Undo stroke" disabled={strokes.length === 0} onPress={() => setStrokes((s) => s.slice(0, -1))} />
        <Button label="Clear" variant="ghost" compact disabled={strokes.length === 0} onPress={() => setStrokes([])} />
      </View>
      <View style={[styles.flex, { padding: spacing.lg }]}>
        <View
          style={[styles.pad, { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: radius.lg }]}
          onLayout={(e: LayoutChangeEvent) => {
            setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
          }}
        >
          <Svg width={size.width} height={size.height} pointerEvents="none">
            <Line x1={size.width * 0.08} y1={size.height * 0.75} x2={size.width * 0.92} y2={size.height * 0.75} stroke="#D5DCE8" strokeWidth={1.5} strokeDasharray="6 6" />
            {[...strokes, ...(current ? [current] : [])].map((s, i) => (
              <Path key={i} d={strokePath(s, size.width, size.height)} stroke={rgbCss(ink.color)} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ))}
          </Svg>
          {strokes.length === 0 && !current ? (
            <View style={styles.hint} pointerEvents="none">
              <AppText tone="subtle">Sign here with your finger</AppText>
            </View>
          ) : null}
          {/* Stable touch layer: keeps the gesture while strokes re-render underneath. */}
          <View
            style={StyleSheet.absoluteFill}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={(e) => {
              windowPos.current = { x: e.nativeEvent.pageX - e.nativeEvent.locationX, y: e.nativeEvent.pageY - e.nativeEvent.locationY };
              live.current = [pt(e)];
              setCurrent(live.current);
            }}
            onResponderMove={(e) => {
              live.current = [...live.current, pt(e)];
              setCurrent(live.current);
            }}
            onResponderRelease={finishStroke}
            onResponderTerminate={finishStroke}
            accessible
            accessibilityLabel="Signature drawing area"
          />
        </View>
      </View>
      <View style={[styles.footer, { padding: spacing.lg, gap: spacing.md }]}>
        <View style={[styles.row, { gap: spacing.md }]}>
          {INK_COLORS.map((c) => (
            <Pressable
              key={c.label}
              onPress={() => setInk(c)}
              accessibilityRole="radio"
              accessibilityLabel={`${c.label} ink`}
              accessibilityState={{ checked: ink.label === c.label }}
              style={[styles.swatch, { backgroundColor: rgbCss(c.color), borderColor: ink.label === c.label ? colors.primary : 'transparent' }]}
            />
          ))}
        </View>
        <Button label="Use signature" icon="checkmark" fullWidth disabled={strokes.length === 0} onPress={() => onDone(strokes, ink.color, size.width / size.height)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 50, elevation: 50 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 4 },
  pad: { flex: 1, borderWidth: 1, overflow: 'hidden' },
  hint: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  footer: {},
  row: { flexDirection: 'row', justifyContent: 'center' },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
});
