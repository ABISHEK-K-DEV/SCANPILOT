import { Image } from 'expo-image';
import { useLayoutEffect, useRef, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { clampPoint, isConvexQuad, type Point, type Quad, type Size } from '@/services/scan/geometry';
import { useAppTheme } from '@/theme';

interface CornerEditorProps {
  uri: string;
  image: Size;
  quad: Quad;
  onChange: (quad: Quad) => void;
}

const HANDLE = 28;
const TOUCH = 56;
const CORNER_NAMES = ['top left', 'top right', 'bottom right', 'bottom left'] as const;

interface Frame {
  x: number;
  y: number;
  scale: number;
}

/** Fits the image inside the container ("contain") and returns its on-screen frame. */
function fitFrame(container: Size, image: Size): Frame {
  const scale = Math.min(container.width / image.width, container.height / image.height);
  return { scale, x: (container.width - image.width * scale) / 2, y: (container.height - image.height * scale) / 2 };
}

function Edge({ from, to, color }: { from: Point; to: Point; color: string }) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (from.x + to.x) / 2 - length / 2,
        top: (from.y + to.y) / 2 - 1,
        width: length,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

/**
 * Manual corner adjustment. Corners are kept in image-pixel coordinates;
 * dragging converts screen deltas through the current fit scale.
 */
export function CornerEditor({ uri, image, quad, onChange }: CornerEditorProps) {
  const { colors } = useAppTheme();
  const [container, setContainer] = useState<Size | null>(null);
  const quadRef = useRef(quad);
  const frameRef = useRef<Frame | null>(null);
  const dragStart = useRef<{ corner: number; touch: Point; point: Point } | null>(null);

  const frame = container ? fitFrame(container, image) : null;

  const beginDrag = (corner: number, event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    dragStart.current = { corner, touch: { x: pageX, y: pageY }, point: quadRef.current[corner] };
  };

  const drag = (event: GestureResponderEvent) => {
    const start = dragStart.current;
    const f = frameRef.current;
    if (!start || !f) return;
    const { pageX, pageY } = event.nativeEvent;
    const next = [...quadRef.current] as Quad;
    next[start.corner] = clampPoint(
      { x: start.point.x + (pageX - start.touch.x) / f.scale, y: start.point.y + (pageY - start.touch.y) / f.scale },
      image,
    );
    quadRef.current = next;
    onChange(next);
  };

  const endDrag = () => {
    dragStart.current = null;
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainer({ width, height });
    frameRef.current = fitFrame({ width, height }, image);
  };

  // Keep refs in sync with props for the gesture handlers (read only at event time).
  useLayoutEffect(() => {
    quadRef.current = quad;
    if (frame) frameRef.current = frame;
  });

  const toScreen = (p: Point): Point => (frame ? { x: frame.x + p.x * frame.scale, y: frame.y + p.y * frame.scale } : p);
  const points = quad.map(toScreen) as Quad;
  const valid = isConvexQuad(quad);
  const lineColor = valid ? colors.primary : colors.danger;

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {frame ? (
        <>
          <Image
            source={{ uri }}
            contentFit="fill"
            style={{ position: 'absolute', left: frame.x, top: frame.y, width: image.width * frame.scale, height: image.height * frame.scale }}
            accessibilityIgnoresInvertColors
          />
          {points.map((p, i) => (
            <Edge key={`edge-${i}`} from={p} to={points[(i + 1) % 4]} color={lineColor} />
          ))}
          {points.map((p, i) => (
            <View
              key={`handle-${i}`}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
              onResponderGrant={(event) => beginDrag(i, event)}
              onResponderMove={drag}
              onResponderRelease={endDrag}
              onResponderTerminate={endDrag}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={`${CORNER_NAMES[i]} corner`}
              hitSlop={8}
              style={[styles.touch, { left: p.x - TOUCH / 2, top: p.y - TOUCH / 2 }]}
            >
              <View style={[styles.handle, { borderColor: lineColor, backgroundColor: colors.surface }]} />
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  touch: { position: 'absolute', width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  handle: { width: HANDLE, height: HANDLE, borderRadius: HANDLE / 2, borderWidth: 3 },
});
