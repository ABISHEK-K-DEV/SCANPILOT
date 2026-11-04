import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CornerEditor } from '@/components/scan/CornerEditor';
import { AppText, Button, EmptyState, ProgressOverlay } from '@/components/ui';
import { fullQuad, insetQuad, isConvexQuad, type Quad } from '@/services/scan/geometry';
import { cropImage } from '@/services/scan/pageProcessing';
import { useScanSession } from '@/stores/scanSessionStore';
import { useAppTheme } from '@/theme';
import { errorMessage } from '@/utils/errors';

export default function CropScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useAppTheme();
  const page = useScanSession((s) => s.pages.find((p) => p.id === id) ?? null);
  const update = useScanSession((s) => s.update);
  const [quad, setQuad] = useState<Quad | null>(() => (page ? fullQuad(page) : null));
  const [busy, setBusy] = useState(false);

  if (!page || !quad) {
    return <EmptyState icon="crop-outline" title="Page not found" actionLabel="Back" onAction={() => router.back()} />;
  }

  const apply = async () => {
    setBusy(true);
    try {
      const result = await cropImage(page, quad);
      update(page.id, { ...result, base: undefined, filter: undefined });
      router.back();
    } catch (error) {
      Alert.alert('Could not crop', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const restoreOriginal = () =>
    Alert.alert('Restore original?', 'Undo all rotation and cropping for this page.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: () => {
          update(page.id, { uri: page.originalUri, width: page.originalWidth, height: page.originalHeight, base: undefined, filter: undefined });
          router.back();
        },
      },
    ]);

  const valid = isConvexQuad(quad);

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.flex, { backgroundColor: '#0A1120' }]}>
      <Stack.Screen options={{ title: 'Adjust corners' }} />
      <View style={[styles.flex, { margin: spacing.lg }]}>
        <CornerEditor uri={page.uri} image={page} quad={quad} onChange={setQuad} />
      </View>
      <AppText variant="caption" align="center" color={valid ? '#A3B1CB' : colors.danger} style={{ paddingHorizontal: spacing.lg }}>
        {valid ? 'Drag the corners to the edges of the document. The page is straightened when you apply.' : 'Corners cross over — move them so they outline the page.'}
      </AppText>
      <View style={[styles.row, { padding: spacing.lg, gap: spacing.sm }]}>
        <Button label="Full page" variant="secondary" compact icon="expand-outline" onPress={() => setQuad(fullQuad(page))} style={styles.flex} />
        <Button label="Inset" variant="secondary" compact icon="contract-outline" onPress={() => setQuad(insetQuad(page, 0.06))} style={styles.flex} />
        <Button
          label="Original"
          variant="secondary"
          compact
          icon="refresh"
          disabled={page.uri === page.originalUri}
          onPress={restoreOriginal}
          style={styles.flex}
        />
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <Button label="Apply" icon="checkmark" fullWidth disabled={!valid} onPress={() => void apply()} />
      </View>
      <ProgressOverlay visible={busy} title="Straightening page" progress={null} detail="This can take a few seconds for large pages." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
});
