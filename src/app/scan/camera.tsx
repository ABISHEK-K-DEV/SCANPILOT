import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, LayoutAnimation, Linking, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';

import { AppText, Button, Icon, type IconName } from '@/components/ui';
import { CameraView, type FlashMode, useCameraPermissions } from '@/native/camera';
import { decodeBase64, type DocumentCameraHandle, type DocumentFrame, NativeDocumentCamera } from '@/native/camera/documentCamera';
import { detectDocumentQuad } from '@/services/scan/detect';
import { hasCameraRequest, resolveCameraRequest } from '@/services/scan/cameraBridge';
import { type ScanMode, SCAN_MODES, captureHint, scanMode } from '@/services/scan/modes';
import { choosePictureSize, LIVE_STEADY_FRAMES, nextSteady, photoToPreview, smoothQuad, STEADY_FRAMES } from '@/services/scan/autoCapture';
import type { Quad } from '@/services/scan/geometry';
import { autoCropPage, deleteFileQuietly, detectQuadInImage, filterImage, ingestImage, processCapturedPage, splitSpread } from '@/services/scan/pageProcessing';
import { pickPages } from '@/services/scan/scanService';
import type { ScanPage } from '@/services/scan/types';
import { useGuideStore } from '@/stores/guideStore';
import { useScanSession } from '@/stores/scanSessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { errorMessage } from '@/utils/errors';
import { appAlert } from '@/stores/dialogStore';

/**
 * ScanPilot's own document camera (replaces the system scanner UI):
 * frame guide, flash, gallery import, batch capture with a live page stack.
 * Each photo is auto-cropped (on-device edge detection), perspective-corrected
 * and auto-enhanced; Filter → Original in the review screen restores it.
 *
 * Modes: new (fresh session → review), append / replace (from review),
 * return (a tool awaiting pages via cameraBridge).
 */
type Mode = 'new' | 'append' | 'replace' | 'return';

const DEMO = process.env.EXPO_PUBLIC_SCANPILOT_DEMO === '1';
/** How long the live camera may take to start before falling back to expo-camera. */
const LIVE_START_TIMEOUT_MS = 8000;
const LiveCamera = NativeDocumentCamera;
const MODE_ICON: Record<ScanMode, IconName> = { document: 'scan', whiteboard: 'whiteboard', book: 'book', 'id-card': 'id-card', 'business-card': 'contact' };
const INK = '#0B0D12';
const FLASH_ORDER: FlashMode[] = ['off', 'auto', 'on'];
const FLASH_LABEL: Record<string, string> = { off: 'Flash off', auto: 'Flash auto', on: 'Flash on' };

async function enhance(page: ScanPage, mode: ScanMode): Promise<ScanPage> {
  const filter = scanMode(mode).filter;
  try {
    const out = await filterImage(page.uri, filter);
    return { ...page, ...out, base: { uri: page.uri, width: page.width, height: page.height }, filter };
  } catch {
    return page;
  }
}

/** Photo → page(s): edge detection + perspective fix, book split, mode filter. */
async function processPhoto(uri: string, mode: ScanMode, width?: number, height?: number): Promise<ScanPage[]> {
  const page = await ingestImage(uri, { deleteSource: true, width, height });
  if (mode !== 'book') {
    // One decode for detection, perspective fix and filter.
    try {
      return [await processCapturedPage(page, scanMode(mode).filter)];
    } catch {
      return [page];
    }
  }
  const cropped = await autoCropPage(page);
  const pages = cropped.width > cropped.height ? await splitSpread(cropped) : [cropped];
  const out: ScanPage[] = [];
  for (const p of pages) out.push(await enhance(p, mode));
  return out;
}

function RoundButton({ icon, label, onPress, active, size = 42 }: { icon: IconName; label: string; onPress: () => void; active?: boolean; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: active ? '#FFFFFF' : pressed ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.42)' }]}
    >
      <Icon name={icon} size={size < 42 ? 18 : 20} color={active ? INK : '#FFFFFF'} />
    </Pressable>
  );
}

export default function CameraScreen() {
  const params = useLocalSearchParams<{ mode?: Mode; replace?: string; scanMode?: ScanMode }>();
  const mode: Mode = params.mode ?? 'new';
  const single = mode === 'replace';
  const [captureMode, setCaptureMode] = useState<ScanMode>(
    () => params.scanMode ?? (mode === 'append' || mode === 'replace' ? useScanSession.getState().mode : 'document'),
  );
  const def = scanMode(captureMode);
  const openGuide = useGuideStore((st) => st.open);
  const guideId = captureMode === 'document' ? 'camera' : `scan-${captureMode}`;
  const modeBar = useRef<ScrollViewInstance>(null);
  const modeX = useRef<Record<string, { x: number; width: number }>>({});
  const [barWidth, setBarWidth] = useState(0);
  // Keep the selected mode centred in the mode bar.
  useEffect(() => {
    const m = modeX.current[captureMode];
    if (m && barWidth) modeBar.current?.scrollTo({ x: Math.max(0, m.x + m.width / 2 - barWidth / 2), animated: true });
  }, [captureMode, barWidth]);
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const narrow = winW < 380;
  const tiny = winW < 350;
  const btn = narrow ? 38 : 42;
  const shutter = narrow ? 70 : 80;
  const autoCapture = useSettingsStore((st) => st.settings.autoCapture);
  const updateSetting = useSettingsStore((st) => st.update);
  // One capture at a time: auto snapshots and the shutter share the camera.
  const cameraLock = useRef<Promise<unknown>>(Promise.resolve());
  const withCamera = <T,>(task: () => Promise<T>): Promise<T> => {
    const run = cameraLock.current.then(task, task);
    cameraLock.current = run.catch(() => undefined);
    return run;
  };
  const [liveState, setLive] = useState<{ quad: Quad; width: number; height: number } | null>(null);
  const [steadyState, setSteady] = useState(0);
  const busyRef = useRef(false);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  // Coming back from system Settings: re-read the permission so the camera opens straight away.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);
  const camera = useRef<CameraView>(null);
  // Live CameraX camera with continuous frame analysis (Android); expo-camera elsewhere.
  const liveCam = useRef<DocumentCameraHandle>(null);
  // If the live camera cannot start on this device, quietly use expo-camera instead.
  const [liveFailed, setLiveFailed] = useState(false);
  const liveCamera = NativeDocumentCamera !== null && !DEMO && !liveFailed;
  const [ready, setReady] = useState(DEMO);
  useEffect(() => {
    if (!liveCamera || ready) return;
    const timer = setTimeout(() => setLiveFailed(true), LIVE_START_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [liveCamera, ready]);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const [flash, setFlash] = useState<FlashMode>('off');
  const [grid, setGrid] = useState(false);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [processing, setProcessing] = useState(0);
  const [shooting, setShooting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [flashOverlay] = useState(() => new Animated.Value(0));
  // Motion: scan line in the frame, breathing corners, captured photo flying to the stack, count pop.
  const [sweep] = useState(() => new Animated.Value(0));
  const [breathe] = useState(() => new Animated.Value(0));
  const [fly] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(1));
  const [flyUri, setFlyUri] = useState<string | null>(null);
  const [guideHeight, setGuideHeight] = useState(0);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const a = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [sweep, breathe]);
  const done = useRef(false);
  const [finished, setFinished] = useState(false);

  // Leaving without "Done" (back gesture, X) hands nothing to a waiting tool.
  useEffect(
    () => () => {
      if (!done.current && hasCameraRequest()) resolveCameraRequest(null);
    },
    [],
  );

  const allowLeave = usePreventRemove(pages.length > 0 && !finished, ({ repeat }) => {
    appAlert('Discard scanned pages?', `${pages.length} ${pages.length === 1 ? 'page' : 'pages'} will be lost.`, [
      { text: 'Keep scanning', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: repeat },
    ]);
  });

  const finish = async (captured: ScanPage[]) => {
    setFinishing(true);
    await queue.current;
    const result = captured.length > 0 ? captured : pages;
    done.current = true;
    setFinished(true);
    allowLeave();
    const session = useScanSession.getState();
    if (mode === 'return') {
      resolveCameraRequest(result);
      router.back();
      return;
    }
    if (mode === 'replace' && params.replace && result[0]) {
      const first = result[0];
      session.update(params.replace, {
        uri: first.uri,
        width: first.width,
        height: first.height,
        originalUri: first.originalUri,
        originalWidth: first.originalWidth,
        originalHeight: first.originalHeight,
        base: first.base,
        filter: first.filter,
      });
      session.select(params.replace);
      router.back();
      return;
    }
    if (mode === 'new') session.setMode(captureMode, def.preset, def.namePrefix);
    session.add(result);
    if (mode === 'append') router.back();
    else router.replace('/scan/review');
  };

  const enqueue = (task: () => Promise<ScanPage | ScanPage[] | null>) => {
    setProcessing((n) => n + 1);
    queue.current = queue.current.then(async () => {
      try {
        const out = await task();
        if (out) setPages((prev) => [...prev, ...(Array.isArray(out) ? out : [out])]);
      } catch (error) {
        appAlert('Could not process the photo', errorMessage(error));
      } finally {
        setProcessing((n) => n - 1);
      }
    });
    return queue.current;
  };

  const flyAway = (uri: string) => {
    setFlyUri(uri);
    fly.setValue(0);
    Animated.timing(fly, { toValue: 1, duration: 520, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setFlyUri(null));
  };

  const shoot = async () => {
    if (shooting || finishing) return;
    setShooting(true);
    flashOverlay.setValue(1);
    Animated.timing(flashOverlay, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    try {
      if (DEMO) {
        flyAway('/demo-assets/scan/page-2.jpg');
        await enqueue(() => processPhoto('/demo-assets/scan/page-2.jpg', captureMode));
      } else {
        const photo = await withCamera(() =>
          liveCamera ? (liveCam.current?.takePicture() ?? Promise.resolve(undefined)) : (camera.current?.takePictureAsync({ quality: 0.92, exif: false }) ?? Promise.resolve(undefined)),
        );
        if (!photo) return;
        flyAway(photo.uri);
        const task = enqueue(() => processPhoto(photo.uri, captureMode, photo.width, photo.height));
        if (single) {
          await task;
        }
      }
    } catch (error) {
      appAlert('Could not take the photo', errorMessage(error));
    } finally {
      setShooting(false);
    }
  };

  useEffect(() => {
    busyRef.current = shooting || finishing;
  }, [shooting, finishing]);
  const autoActive = autoCapture && !DEMO && ready && !!permission?.granted && !finished;
  // Outline and steadiness only mean something while auto-capture runs.
  const live = autoActive ? liveState : null;
  const steady = autoActive ? steadyState : 0;

  /**
   * Auto-capture: about once a second take a silent snapshot, find the page,
   * draw its outline, and keep the snapshot as the page once the outline has
   * held still for STEADY_FRAMES snapshots. Then pause briefly for the next page.
   */
  useEffect(() => {
    if (!autoActive || liveCamera) return;
    let cancelled = false;
    // Waits end immediately when the screen closes, so no timers outlive it.
    const pending = new Set<{ timer: ReturnType<typeof setTimeout>; resolve: () => void }>();
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const entry = { timer: setTimeout(() => (pending.delete(entry), resolve()), ms), resolve };
        pending.add(entry);
      });
    void (async () => {
      let last: Quad | null = null;
      let count = 0;
      while (!cancelled) {
        if (busyRef.current) {
          await sleep(400);
          continue;
        }
        let snapUri: string | null = null;
        try {
          const snap = await withCamera(() => camera.current?.takePictureAsync({ quality: 0.88, exif: false, shutterSound: false }) ?? Promise.resolve(undefined));
          if (!snap || cancelled) {
            if (snap) deleteFileQuietly(snap.uri);
            break;
          }
          snapUri = snap.uri;
          const quad = await detectQuadInImage(snap.uri, snap.width, snap.height);
          if (cancelled) break;
          count = nextSteady(last, quad, count, Math.max(snap.width, snap.height));
          last = quad;
          setLive(quad ? { quad, width: snap.width, height: snap.height } : null);
          setSteady(Math.min(1, count / STEADY_FRAMES));
          if (quad && count >= STEADY_FRAMES && !busyRef.current) {
            count = 0;
            last = null;
            const uri = snap.uri;
            snapUri = null; // kept: it becomes the page
            flashOverlay.setValue(1);
            Animated.timing(flashOverlay, { toValue: 0, duration: 260, useNativeDriver: true }).start();
            flyAway(uri);
            void enqueue(() => processPhoto(uri, captureMode, snap.width, snap.height));
            setLive(null);
            setSteady(0);
            await sleep(1600); // time to move to the next page
          }
        } catch {
          await sleep(700);
        } finally {
          if (snapUri) deleteFileQuietly(snapUri);
        }
        await sleep(60);
      }
    })();
    return () => {
      cancelled = true;
      pending.forEach((entry) => {
        clearTimeout(entry.timer);
        entry.resolve();
      });
      pending.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoActive, captureMode]);

  // Live frames (native camera): detect on every frame, glide the outline, capture when steady.
  const liveTrack = useRef<{ last: Quad | null; count: number; smooth: Quad | null; coolUntil: number }>({ last: null, count: 0, smooth: null, coolUntil: 0 });
  const onLiveFrame = (frame: DocumentFrame) => {
    if (!autoActive || busyRef.current) return;
    const t = liveTrack.current;
    if (Date.now() < t.coolUntil) return;
    let quad: Quad | null = null;
    try {
      quad = detectDocumentQuad(decodeBase64(frame.gray), frame.width, frame.height)?.quad ?? null;
    } catch {
      quad = null;
    }
    t.count = nextSteady(t.last, quad, t.count, Math.max(frame.width, frame.height));
    t.last = quad;
    t.smooth = quad ? smoothQuad(t.smooth, quad) : null;
    setLive(t.smooth ? { quad: t.smooth, width: frame.width, height: frame.height } : null);
    setSteady(Math.min(1, t.count / LIVE_STEADY_FRAMES));
    if (!quad || t.count < LIVE_STEADY_FRAMES) return;
    // Steady: take one full-resolution photo, then give the user time to change page.
    t.count = 0;
    t.last = null;
    t.smooth = null;
    t.coolUntil = Date.now() + 1800;
    setLive(null);
    setSteady(0);
    busyRef.current = true;
    void (async () => {
      try {
        const photo = await withCamera(() => liveCam.current?.takePicture() ?? Promise.resolve(undefined));
        if (!photo) return;
        flashOverlay.setValue(1);
        Animated.timing(flashOverlay, { toValue: 0, duration: 260, useNativeDriver: true }).start();
        flyAway(photo.uri);
        void enqueue(() => processPhoto(photo.uri, captureMode, photo.width, photo.height));
      } catch {
        // Missed this one; detection continues.
      } finally {
        busyRef.current = false;
      }
    })();
  };

  useEffect(() => {
    if (pages.length === 0) return;
    pop.setValue(1.45);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [pages.length, pop]);

  const switchMode = (id: ScanMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(240, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.scaleXY));
    setCaptureMode(id);
  };

  // Retake finishes after one page; ID cards after front + back.
  const finishAfter = single ? 1 : mode === 'return' || mode === 'new' ? def.autoFinishAfter : 0;
  useEffect(() => {
    if (finishAfter > 0 && pages.length >= finishAfter && !done.current) void finish(pages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length]);

  const fromGallery = async () => {
    await enqueue(async () => pickPages({ single }));
  };

  const close = () => router.back();

  // Frame guide sized to fit between the top bar and the hint on any screen.
  const availW = stageSize.width * (def.aspect >= 1 ? 0.9 : 0.82);
  const availH = Math.max(120, stageSize.height - (insets.top + 60) - 70);
  const guideW = stageSize.width > 0 ? Math.min(availW, availH * def.aspect) : 0;
  const guideSize = guideW > 0 ? { width: guideW, height: guideW / def.aspect } : { width: '80%' as const, aspectRatio: def.aspect };
  const outline = live && stageSize.width > 0 ? photoToPreview(live.quad, live, stageSize) : null;
  const hint = !ready
    ? 'Starting camera…'
    : autoActive
      ? live
        ? steady >= 0.5
          ? 'Hold still…'
          : 'Page found — hold steady'
        : captureMode === 'id-card' ? captureHint(captureMode, pages.length) : 'Looking for the page…'
      : captureHint(captureMode, pages.length);

  const top = (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <RoundButton icon="close" label="Close camera" onPress={close} size={btn} />
      <View style={[styles.titlePill, { paddingHorizontal: narrow ? 10 : 12 }]}>
        <Icon name={MODE_ICON[captureMode]} size={15} color="#FFFFFF" />
        {!tiny ? (
          <AppText variant="caption" color="#FFFFFF" numberOfLines={1} maxFontSizeMultiplier={1.15} style={styles.bold}>
            {single ? 'Retake' : def.label}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.topRight, { gap: narrow ? 6 : 10 }]}>
        <RoundButton icon="help-circle-outline" label="How scanning works" onPress={() => openGuide(guideId)} size={btn} />
        <RoundButton icon="grid-3x3" label={grid ? 'Hide grid' : 'Show grid'} active={grid} onPress={() => setGrid((g) => !g)} size={btn} />
        <RoundButton
          size={btn}
          icon={flash === 'off' ? 'flash-off' : 'flash'}
          label={FLASH_LABEL[flash]}
          active={flash !== 'off'}
          onPress={() => setFlash((f) => FLASH_ORDER[(FLASH_ORDER.indexOf(f) + 1) % FLASH_ORDER.length])}
        />
      </View>
    </View>
  );

  // Permission states ------------------------------------------------------
  if (!DEMO && (!permission || !permission.granted)) {
    const blocked = permission && !permission.canAskAgain;
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: INK, paddingHorizontal: 32, gap: 16 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <View style={styles.permissionIcon}>
          <Icon name="camera" size={34} color="#FFFFFF" />
        </View>
        <AppText variant="title" color="#FFFFFF" align="center">
          {permission ? 'Allow the camera' : 'Starting camera…'}
        </AppText>
        {permission ? (
          <>
            <AppText color="#A7AFBE" align="center">
              ScanPilot uses the camera only while you scan. Photos are processed on this phone and are never uploaded.
            </AppText>
            <Button
              label={blocked ? 'Open settings' : 'Allow camera'}
              icon={blocked ? 'settings' : 'camera'}
              fullWidth
              onPress={() => (blocked ? void Linking.openSettings() : void requestPermission())}
            />
            <Button label="Choose photos instead" variant="onPrimary" icon="images" fullWidth onPress={() => void fromGallery().then(() => undefined)} />
            <Button label="Cancel" variant="ghost" onPress={close} />
          </>
        ) : (
          <ActivityIndicator color="#FFFFFF" />
        )}
        {pages.length > 0 ? <Button label={`Use ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`} fullWidth onPress={() => void finish([])} /> : null}
      </View>
    );
  }

  const last = pages[pages.length - 1];
  return (
    <View style={[styles.fill, { backgroundColor: INK }]}>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <StatusBar style="light" />
      <View style={styles.fill} onLayout={(e) => setStageSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {DEMO ? (
          <Image source={{ uri: '/demo-assets/scan/photo-3.jpg' }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : liveCamera && LiveCamera ? (
          <LiveCamera
            ref={liveCam}
            style={StyleSheet.absoluteFill}
            flash={flash === 'on' || flash === 'auto' ? flash : 'off'}
            analysis={autoActive}
            onCameraReady={() => setReady(true)}
            onFrame={(e) => onLiveFrame(e.nativeEvent)}
            onCameraError={() => {
              setReady(false);
              setLiveFailed(true);
            }}
          />
        ) : (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            flash={flash}
            pictureSize={pictureSize}
            animateShutter={false}
            onCameraReady={() => {
              setReady(true);
              // Capture at the size pages are stored at: faster snapshots, same page quality.
              if (!pictureSize) {
                // Not every device / platform implements it: fall back to the default size.
                void Promise.resolve()
                  .then(() => camera.current?.getAvailablePictureSizesAsync?.() ?? [])
                  .then((sizes) => setPictureSize(choosePictureSize(sizes)))
                  .catch(() => undefined);
              }
            }}
          />
        )}

        {/* Rule-of-thirds grid */}
        {grid ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {[1, 2].map((i) => (
              <View key={`v${i}`} style={[styles.gridV, { left: `${(i * 100) / 3}%` }]} />
            ))}
            {[1, 2].map((i) => (
              <View key={`h${i}`} style={[styles.gridH, { top: `${(i * 100) / 3}%` }]} />
            ))}
          </View>
        ) : null}

        {/* Page frame guide */}
        <View style={[StyleSheet.absoluteFill, styles.guideWrap, { paddingTop: insets.top + 60, paddingBottom: 16 }]} pointerEvents="none">
          <Animated.View
            onLayout={(e) => setGuideHeight(e.nativeEvent.layout.height)}
            style={[
              styles.guide,
              guideSize,
              { opacity: live ? 0.35 : 1 },
              { transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) }] },
            ]}
          >
            {captureMode === 'book' ? <View style={styles.spine} /> : null}
            {guideHeight > 0 && ready ? (
              <Animated.View
                style={[
                  styles.sweep,
                  {
                    opacity: sweep.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.9, 0.9, 0] }),
                    transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [8, guideHeight - 8] }) }],
                  },
                ]}
              />
            ) : null}
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </Animated.View>
          <View style={styles.hint}>
            <AppText variant="caption" color="#FFFFFF" style={styles.bold}>
              {hint}
            </AppText>
          </View>
        </View>

        {outline ? (
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width={stageSize.width} height={stageSize.height}>
            <Polygon
              points={outline.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(94,234,212,0.16)"
              stroke="#5EEAD4"
              strokeWidth={steady >= 0.5 ? 4 : 2.5}
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flashOverlay }]} />
        {flyUri && stageSize.width > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.flyer,
              {
                width: stageSize.width * 0.6,
                height: stageSize.width * 0.8,
                left: stageSize.width * 0.2,
                top: stageSize.height * 0.5 - stageSize.width * 0.4,
                opacity: fly.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, stageSize.width * 0.33] }) },
                  { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, stageSize.height * 0.5 + 40] }) },
                  { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.12] }) },
                  { rotate: fly.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-8deg'] }) },
                ],
              },
            ]}
          >
            <Image source={{ uri: flyUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        ) : null}
        {top}
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + (narrow ? 10 : 16), paddingTop: narrow ? 12 : 16 }]}>
        {!single ? (
          <ScrollView
            ref={modeBar}
            horizontal
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.modes}
            style={styles.modesWrap}
            accessibilityRole="tablist"
          >
            {SCAN_MODES.map((m) => {
              const active = m.id === captureMode;
              const locked = pages.length > 0 && !active;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => switchMode(m.id)}
                  onLayout={(e) => {
                    modeX.current[m.id] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
                    if (m.id === captureMode && barWidth) modeBar.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x + e.nativeEvent.layout.width / 2 - barWidth / 2), animated: false });
                  }}
                  disabled={locked}
                  accessibilityRole="tab"
                  accessibilityLabel={`${m.label} mode`}
                  accessibilityState={{ selected: active, disabled: locked }}
                  style={[styles.modeChip, active && styles.modeChipActive, { opacity: locked ? 0.35 : 1 }]}
                >
                  <AppText variant="caption" color={active ? INK : '#E5E7EB'} style={styles.modeText}>
                    {m.label}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        <View style={[styles.controls, { paddingHorizontal: narrow ? 18 : 28 }]}>
          <Pressable onPress={() => void fromGallery()} accessibilityRole="button" accessibilityLabel="Add from photos" style={styles.side}>
            <View style={styles.sideIcon}>
              <Icon name="image-plus" size={22} color="#FFFFFF" />
            </View>
            <AppText variant="label" color="#A7AFBE">
              PHOTOS
            </AppText>
          </Pressable>

          <Pressable
            onPress={() => void shoot()}
            disabled={!ready || shooting || finishing}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={({ pressed }) => [
              styles.shutterRing,
              {
                width: shutter,
                height: shutter,
                borderRadius: shutter / 2,
                borderColor: autoActive && steady > 0 ? '#5EEAD4' : '#FFFFFF',
                opacity: ready ? 1 : 0.5,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
          >
            <View style={[styles.shutter, { width: shutter - 18, height: shutter - 18, borderRadius: (shutter - 18) / 2 }]}>
              {shooting ? <ActivityIndicator color={INK} /> : autoActive ? <AppText variant="label" color={INK}>AUTO</AppText> : null}
            </View>
          </Pressable>

          <Pressable
            onPress={() => void finish([])}
            disabled={(pages.length === 0 && processing === 0) || finishing}
            accessibilityRole="button"
            accessibilityLabel={pages.length > 0 ? `Done, ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}` : 'Done'}
            style={[styles.side, { opacity: pages.length > 0 || processing > 0 ? 1 : 0.35 }]}
          >
            <View style={styles.stack}>
              {pages.length > 1 ? <View style={[styles.stackBack]} /> : null}
              <View style={styles.thumb}>
                {last ? <Image source={{ uri: last.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="file-plus" size={20} color="#6F7889" />}
                {processing > 0 || finishing ? (
                  <View style={[StyleSheet.absoluteFill, styles.center, styles.thumbBusy]}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  </View>
                ) : null}
              </View>
              {pages.length > 0 ? (
                <Animated.View style={[styles.count, { transform: [{ scale: pop }] }]}>
                  <AppText variant="label" color="#FFFFFF">
                    {pages.length}
                  </AppText>
                </Animated.View>
              ) : null}
            </View>
            <AppText variant="label" color={pages.length > 0 ? '#FFFFFF' : '#A7AFBE'}>
              DONE
            </AppText>
          </Pressable>
        </View>
        {!single ? (
          <View style={[styles.autoRow, { marginTop: narrow ? 10 : 14 }]} accessibilityRole="radiogroup">
            {([false, true] as const).map((value) => {
              const on = autoCapture === value;
              return (
                <Pressable
                  key={String(value)}
                  onPress={() => void updateSetting('autoCapture', value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={value ? 'Auto capture' : 'Manual capture'}
                  style={[styles.autoChip, on && styles.autoChipOn]}
                >
                  <AppText variant="caption" maxFontSizeMultiplier={1.15} color={on ? INK : '#E5E7EB'} style={styles.modeText}>
                    {value ? 'Auto capture' : 'Manual'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const C = 30;
const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '600' },
  topBar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  topRight: { flexDirection: 'row', gap: 10 },
  titlePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.45)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.45)' },
  guideWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 70 },
  guide: {},
  corner: { position: 'absolute', width: C, height: C, borderColor: '#5EEAD4' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  sweep: { position: 'absolute', left: 10, right: 10, top: 0, height: 2.5, borderRadius: 2, backgroundColor: '#5EEAD4', shadowColor: '#5EEAD4', shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  flyer: { position: 'absolute', borderRadius: 10, overflow: 'hidden', borderWidth: 3, borderColor: '#FFFFFF' },
  spine: { position: 'absolute', top: '6%', bottom: '6%', left: '50%', width: 2, marginLeft: -1, backgroundColor: 'rgba(94,234,212,0.7)' },
  modesWrap: { flexGrow: 0, marginBottom: 12 },
  autoRow: { flexDirection: 'row', alignSelf: 'center', padding: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  autoChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  autoChipOn: { backgroundColor: '#FFFFFF' },
  modes: { paddingHorizontal: 16, gap: 6, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  modeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  modeChipActive: { backgroundColor: '#FFFFFF' },
  modeText: { fontWeight: '600', fontSize: 13 },
  hint: { marginTop: 18, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  flash: { backgroundColor: '#FFFFFF' },
  bottom: { backgroundColor: INK },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28 },
  side: { minWidth: 64, alignItems: 'center', gap: 6 },
  sideIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  shutterRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  stack: { width: 52, height: 52 },
  stackBack: { position: 'absolute', left: 5, top: -5, width: 44, height: 52, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)' },
  thumb: { width: 44, height: 52, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1B1F28', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  thumbBusy: { backgroundColor: 'rgba(0,0,0,0.45)' },
  count: { position: 'absolute', right: -2, top: -8, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: INK },
  permissionIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
