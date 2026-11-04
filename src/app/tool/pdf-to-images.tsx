import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { DocumentSelectModal } from '@/components/tools/DocumentSelectModal';
import { ChooseDocumentCard } from '@/components/tools/DocumentSources';
import { ChoiceRow, Field } from '@/components/tools/FormBits';
import { SelectedDocumentCard } from '@/components/tools/SelectedDocumentCard';
import { AppText, Button, EmptyState, LoadingState, ProgressOverlay, Screen } from '@/components/ui';
import { useSelectedDocument } from '@/hooks/useSelectedDocument';
import { getPdfRenderer } from '@/native/pdfRenderer';
import { buildZip } from '@/services/export/docx';
import { canSaveToDevice, saveManyToDevice, shareBytes } from '@/services/share/shareService';
import { type ExportedImage, exportPagesAsImages, type ImageQuality } from '@/services/tools/imageExport';
import { useAppTheme } from '@/theme';
import { errorMessage, isCancelled } from '@/utils/errors';
import { exportFileName } from '@/utils/filename';
import { formatBytes } from '@/utils/format';

export default function PdfToImagesScreen() {
  const { spacing, radius, colors } = useAppTheme();
  const { doc, loading, choose } = useSelectedDocument();
  const [picker, setPicker] = useState(false);
  const [quality, setQuality] = useState<ImageQuality>('high');
  const [progress, setProgress] = useState<number | null>(null);
  const [images, setImages] = useState<ExportedImage[] | null>(null);
  const token = useRef({ cancelled: false });

  if (!getPdfRenderer()) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'PDF to JPG' }} />
        <EmptyState icon="image-outline" title="Not available on this device yet" message="Page rendering uses Android's built-in PDF renderer. iOS support is coming." />
      </Screen>
    );
  }

  const run = async () => {
    if (!doc) return;
    token.current = { cancelled: false };
    setProgress(0);
    try {
      setImages(await exportPagesAsImages(doc, quality, { cancelToken: token.current, onProgress: (d, t) => setProgress(d / t) }));
    } catch (error) {
      if (!isCancelled(error)) Alert.alert('Could not convert', errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  const total = images?.reduce((s, i) => s + i.bytes.length, 0) ?? 0;

  return (
    <Screen scroll edges={['left', 'right', 'bottom']} contentStyle={{ paddingTop: spacing.lg, gap: spacing.lg }}>
      <Stack.Screen options={{ title: 'PDF to JPG' }} />
      {loading ? (
        <LoadingState />
      ) : !doc ? (
        <ChooseDocumentCard icon="image-outline" title="PDF to JPG" message="Turn every page into a high-quality JPG image." onChoose={() => setPicker(true)} onCreated={(d) => (setImages(null), choose(d))} />
      ) : (
        <>
          <SelectedDocumentCard doc={doc} onChange={() => setPicker(true)} />
          <Field label="Image quality">
            <ChoiceRow
              options={[
                { value: 'standard', label: 'Standard · 150 dpi' },
                { value: 'high', label: 'High · 220 dpi' },
                { value: 'max', label: 'Print · 300 dpi' },
              ]}
              value={quality}
              onChange={(q) => (setQuality(q), setImages(null))}
            />
          </Field>
          <Button label="Convert to JPG" icon="images-outline" fullWidth onPress={() => void run()} />
          {images ? (
            <View style={{ gap: spacing.md }}>
              <AppText variant="heading">
                {images.length} {images.length === 1 ? 'image' : 'images'} · {formatBytes(total)}
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} style={{ flexGrow: 0 }}>
                {images.slice(0, 12).map((img) => (
                  <Image key={img.uri} source={{ uri: img.uri }} style={{ width: 90, height: 120, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFF' }} contentFit="cover" accessibilityLabel={img.name} />
                ))}
              </ScrollView>
              {canSaveToDevice ? (
                <Button
                  label="Save images to a folder…"
                  icon="download-outline"
                  onPress={() =>
                    saveManyToDevice(images.map((i) => ({ name: i.name, bytes: i.bytes, mimeType: 'image/jpeg' })))
                      .then((n) => n !== null && Alert.alert('Saved', `${n} images were saved to the folder you chose.`))
                      .catch((e) => Alert.alert('Could not save', errorMessage(e)))
                  }
                />
              ) : null}
              <Button
                label={images.length === 1 ? 'Share image' : 'Share as ZIP'}
                icon="share-outline"
                variant="secondary"
                onPress={() =>
                  (images.length === 1
                    ? shareBytes(images[0].name, images[0].bytes, 'image/jpeg', 'public.jpeg')
                    : shareBytes(exportFileName(`${doc.name} images`, 'zip'), buildZip(images), 'application/zip', 'public.zip-archive')
                  ).catch((e) => Alert.alert('Could not share', errorMessage(e)))
                }
              />
            </View>
          ) : null}
        </>
      )}
      <DocumentSelectModal visible={picker} title="Choose a PDF" onClose={() => setPicker(false)} onSelect={([d]) => (setPicker(false), setImages(null), choose(d))} />
      <ProgressOverlay visible={progress !== null} title="Converting pages" progress={progress} onCancel={() => (token.current.cancelled = true)} />
    </Screen>
  );
}
