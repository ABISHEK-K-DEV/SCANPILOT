import { CameraView, type FlashMode, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, Icon, type IconName } from '@/components/ui';
import { processCameraPhoto } from '@/services/scan/scanService';
import type { ScanPage } from '@/services/scan/types';
import { useScanSession } from '@/stores/scanSessionStore';
import { errorMessage } from '@/utils/errors';

const FLASH_CYCLE: { mode: FlashMode; icon: IconName; label: string }[] = [
  { mode: 'off', icon: 'flash-off-outline', label: 'Flash off' },
  { mode: 'auto', icon: 'flash-outline', label: 'Flash auto' },
  { mode: 'on', icon: 'flash', label: 'Flash on' },
];

/**
 * ScanPilot's own document camera: live preview, flash, torch, multi-page.
 * Each photo is processed in the background (page detection + straightening).
 * `mode=retake&page=<id>` replaces one page; `mode=add` appends and returns.
 */
export default function ScanCameraScreen() {
  const { mode = 'new', page: retakeId } = useLocalSearchParams<{ mode?: 'new' | 'add' | 'retake'; page?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [flash, setFlash] = useState(0);
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [pending, setPending] = useState(0);
  const [shots, setShots] = useState<ScanPage[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const finish = async () => {
    await queue.current;
    if (mode === 'new') router.replace('/scan/review');
    else router.back();
  };

  const capture = async () => {
    if (!camera.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.92, exif: false });
      if (!photo?.uri) throw new Error('No photo was captured.');
      setPending((n) => n + 1);
      // Process sequentially in the background so the user can keep shooting.
      queue.current = queue.current.then(async () => {
        try {
          const page = await processCameraPhoto(photo.uri);
          const session = useScanSession.getState();
          if (mode === 'retake' && retakeId) {
            session.update(retakeId, { uri: page.uri, width: page.width, height: page.height, originalUri: page.originalUri, originalWidth: page.originalWidth, originalHeight: page.originalHeight, base: undefined, filter: undefined });
          } else {
            session.add([page]);
          }
          setShots((s) => [...s, page]);
        } catch (error) {
          Alert.alert('Could not process photo', errorMessage(error));
        } finally {
          setPending((n) => n - 1);
        }
      });
      if (mode === 'retake') await finish();
    } catch (error) {
      Alert.alert('Could not take photo', errorMessage(error));
    } finally {
      setCapturing(false);
    }
  };

  if (!permission) return <View style={styles.black} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.black, styles.center, { padding: 32, gap: 16 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Icon name="camera-outline" size={56} color="#FFFFFF" />
        <AppText variant="title" color="#FFFFFF" align="center">
          Allow camera access
        </AppText>
        <AppText color="#C9D2E3" align="center">
          ScanPilot uses the camera only while you scan. Photos stay on your phone.
        </AppText>
        {permission.canAskAgain ? (
          <Button label="Allow camera" icon="camera" onPress={() => void requestPermission()} />
        ) : (
          <Button label="Open settings" icon="settings-outline" onPress={() => void Linking.openSettings()} />
        )}
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const flashState = FLASH_CYCLE[flash];

  return (
    <View style={styles.black}>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flashState.mode}
        enableTorch={torch}
        animateShutter
        onCameraReady={() => setReady(true)}
        onMountError={(e) => setMountError(e.message)}
      />
      {/* Framing guide */}
      <View style={styles.guide} pointerEvents="none">
        <View style={styles.frame}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[styles.corner, styles[c]]} />
          ))}
        </View>
      </View>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close camera" style={styles.roundBtn}>
            <Icon name="close" color="#FFFFFF" />
          </Pressable>
          <AppText color="#FFFFFF" variant="bodyStrong">
            {mode === 'retake' ? 'Retake page' : 'Scan document'}
          </AppText>
          <View style={styles.row}>
            <Pressable onPress={() => setFlash((f) => (f + 1) % FLASH_CYCLE.length)} accessibilityRole="button" accessibilityLabel={flashState.label} style={styles.roundBtn}>
              <Icon name={flashState.icon} color={flashState.mode === 'off' ? '#FFFFFF' : '#FFD54A'} />
            </Pressable>
            <Pressable onPress={() => setTorch((t) => !t)} accessibilityRole="switch" accessibilityState={{ checked: torch }} accessibilityLabel="Torch" style={styles.roundBtn}>
              <Icon name={torch ? 'bulb' : 'bulb-outline'} color={torch ? '#FFD54A' : '#FFFFFF'} />
            </Pressable>
          </View>
        </View>

        <View style={styles.hintWrap} pointerEvents="none">
          <AppText color="#FFFFFF" align="center" style={styles.hint}>
            {mountError ? `Camera error: ${mountError}` : ready ? 'Fit the page inside the frame — edges are straightened automatically' : 'Starting camera…'}
          </AppText>
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.thumbSlot}>
            {shots.length > 0 ? (
              <View>
                <Image source={{ uri: shots[shots.length - 1].uri }} style={styles.thumb} contentFit="cover" />
                <View style={styles.badge}>
                  <AppText variant="label" color="#FFFFFF">
                    {shots.length}
                  </AppText>
                </View>
              </View>
            ) : null}
            {pending > 0 ? <ActivityIndicator color="#FFFFFF" style={styles.pending} accessibilityLabel="Processing photos" /> : null}
          </View>
          <Pressable
            onPress={() => void capture()}
            disabled={!ready || capturing}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={({ pressed }) => [styles.shutter, (pressed || capturing) && { transform: [{ scale: 0.92 }] }, !ready && { opacity: 0.4 }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={styles.thumbSlot}>
            {mode !== 'retake' && (shots.length > 0 || pending > 0) ? (
              <Pressable onPress={() => void finish()} accessibilityRole="button" accessibilityLabel={`Done, ${shots.length + pending} pages`} style={styles.doneBtn}>
                <AppText variant="bodyStrong" color="#0B1B3F">
                  Done
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const CORNER = 28;
const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  guide: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '82%', aspectRatio: 1 / 1.414 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#3DF5C8' },
  tl: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 8 },
  tr: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 8 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 8 },
  br: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 8 },
  hintWrap: { alignItems: 'center', paddingHorizontal: 24 },
  hint: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, overflow: 'hidden' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingBottom: 16 },
  thumbSlot: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 56, height: 72, borderRadius: 8, borderWidth: 2, borderColor: '#FFFFFF' },
  badge: { position: 'absolute', top: -8, right: -8, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#2D5BFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  pending: { position: 'absolute' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF' },
  doneBtn: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10 },
});
