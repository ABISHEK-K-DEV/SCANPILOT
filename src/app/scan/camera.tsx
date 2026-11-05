import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Linking, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Icon, type IconName } from '@/components/ui';
import { CameraView, type FlashMode, useCameraPermissions } from '@/native/camera';
import { hasCameraRequest, resolveCameraRequest } from '@/services/scan/cameraBridge';
import { type ScanMode, SCAN_MODES, captureHint, scanMode } from '@/services/scan/modes';
import { autoCropPage, filterImage, ingestImage, splitSpread } from '@/services/scan/pageProcessing';
import { pickPages } from '@/services/scan/scanService';
import type { ScanPage } from '@/services/scan/types';
import { useScanSession } from '@/stores/scanSessionStore';
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
  const cropped = await autoCropPage(page);
  const pages = mode === 'book' && cropped.width > cropped.height ? await splitSpread(cropped) : [cropped];
  const out: ScanPage[] = [];
  for (const p of pages) out.push(await enhance(p, mode));
  return out;
}

function RoundButton({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.round, { backgroundColor: active ? '#FFFFFF' : pressed ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.12)' }]}
    >
      <Icon name={icon} size={20} color={active ? INK : '#FFFFFF'} />
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
  const modeBar = useRef<ScrollViewInstance>(null);
  const modeX = useRef<Record<string, { x: number; width: number }>>({});
  const [barWidth, setBarWidth] = useState(0);
  // Keep the selected mode centred in the mode bar.
  useEffect(() => {
    const m = modeX.current[captureMode];
    if (m && barWidth) modeBar.current?.scrollTo({ x: Math.max(0, m.x + m.width / 2 - barWidth / 2), animated: true });
  }, [captureMode, barWidth]);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  // Coming back from system Settings: re-read the permission so the camera opens straight away.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(DEMO);
  const [flash, setFlash] = useState<FlashMode>('off');
  const [grid, setGrid] = useState(false);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [processing, setProcessing] = useState(0);
  const [shooting, setShooting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [flashOverlay] = useState(() => new Animated.Value(0));
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

  const shoot = async () => {
    if (shooting || finishing) return;
    setShooting(true);
    flashOverlay.setValue(1);
    Animated.timing(flashOverlay, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    try {
      if (DEMO) {
        await enqueue(() => processPhoto('/demo-assets/scan/page-2.jpg', captureMode));
      } else {
        const photo = await camera.current?.takePictureAsync({ quality: 0.92, exif: false });
        if (!photo) return;
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

  const top = (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <RoundButton icon="close" label="Close camera" onPress={close} />
      <View style={styles.titlePill}>
        <Icon name={MODE_ICON[captureMode]} size={15} color="#FFFFFF" />
        <AppText variant="caption" color="#FFFFFF" style={styles.bold}>
          {single ? 'Retake page' : def.label}
        </AppText>
      </View>
      <View style={styles.topRight}>
        <RoundButton icon="grid-3x3" label={grid ? 'Hide grid' : 'Show grid'} active={grid} onPress={() => setGrid((g) => !g)} />
        <RoundButton
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
      <View style={styles.fill}>
        {DEMO ? (
          <Image source={{ uri: '/demo-assets/scan/photo-3.jpg' }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" flash={flash} onCameraReady={() => setReady(true)} animateShutter={false} />
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
        <View style={[StyleSheet.absoluteFill, styles.guideWrap]} pointerEvents="none">
          <View style={[styles.guide, def.aspect >= 1 ? { width: '88%', aspectRatio: def.aspect } : { width: '80%', aspectRatio: def.aspect }]}>
            {captureMode === 'book' ? <View style={styles.spine} /> : null}
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <View style={styles.hint}>
            <AppText variant="caption" color="#FFFFFF" style={styles.bold}>
              {ready ? captureHint(captureMode, pages.length) : 'Starting camera…'}
            </AppText>
          </View>
        </View>

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flashOverlay }]} />
        {top}
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
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
                  onPress={() => setCaptureMode(m.id)}
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
        <View style={styles.controls}>
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
            style={({ pressed }) => [styles.shutterRing, { opacity: ready ? 1 : 0.5, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <View style={styles.shutter}>{shooting ? <ActivityIndicator color={INK} /> : null}</View>
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
                <View style={styles.count}>
                  <AppText variant="label" color="#FFFFFF">
                    {pages.length}
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="label" color={pages.length > 0 ? '#FFFFFF' : '#A7AFBE'}>
              DONE
            </AppText>
          </Pressable>
        </View>
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
  spine: { position: 'absolute', top: '6%', bottom: '6%', left: '50%', width: 2, marginLeft: -1, backgroundColor: 'rgba(94,234,212,0.7)' },
  modesWrap: { flexGrow: 0, marginBottom: 16 },
  modes: { paddingHorizontal: 16, gap: 6, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  modeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  modeChipActive: { backgroundColor: '#FFFFFF' },
  modeText: { fontWeight: '600', fontSize: 13 },
  hint: { marginTop: 18, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  flash: { backgroundColor: '#FFFFFF' },
  bottom: { backgroundColor: INK, paddingTop: 18 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28 },
  side: { width: 72, alignItems: 'center', gap: 6 },
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
