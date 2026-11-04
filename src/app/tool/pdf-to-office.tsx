import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DocumentSelectModal } from '@/components/tools/DocumentSelectModal';
import { ChooseDocumentCard } from '@/components/tools/DocumentSources';
import { ChoiceRow, Field } from '@/components/tools/FormBits';
import { SelectedDocumentCard } from '@/components/tools/SelectedDocumentCard';
import { AppText, Button, Card, EmptyState, Icon, LoadingState, ProgressOverlay, Screen } from '@/components/ui';
import { useSelectedDocument } from '@/hooks/useSelectedDocument';
import { OCR_LANGUAGES, type OcrLanguage } from '@/native/ocr';
import { getPdfRenderer } from '@/native/pdfRenderer';
import { isOcrSupported } from '@/services/ocr/ocrService';
import { canSaveToDevice, saveBytesToDevice, shareBytes } from '@/services/share/shareService';
import { pdfToExcel, pdfToPowerPoint, PPTX_MIME, XLSX_MIME } from '@/services/tools/officeExport';
import { appAlert, toast } from '@/stores/dialogStore';
import { useAppTheme } from '@/theme';
import { errorMessage, isCancelled } from '@/utils/errors';
import { exportFileName } from '@/utils/filename';
import { formatBytes } from '@/utils/format';

type Format = 'pptx' | 'xlsx';

const COPY: Record<Format, { title: string; intro: string; action: string; icon: 'presentation-outline' | 'sheet'; uti: string; mime: string }> = {
  pptx: {
    title: 'PDF to PowerPoint',
    intro: 'Every page becomes a slide that looks exactly like the PDF. Converted on this phone.',
    action: 'Convert to PowerPoint',
    icon: 'presentation-outline',
    uti: 'org.openxmlformats.presentationml.presentation',
    mime: PPTX_MIME,
  },
  xlsx: {
    title: 'PDF to Excel',
    intro: 'Text and tables are read on this phone and laid out in rows and columns — one sheet per page.',
    action: 'Convert to Excel',
    icon: 'sheet',
    uti: 'org.openxmlformats.spreadsheetml.sheet',
    mime: XLSX_MIME,
  },
};

export default function PdfToOfficeScreen() {
  const { colors, spacing, radius } = useAppTheme();
  const { format: raw } = useLocalSearchParams<{ format?: string }>();
  const format: Format = raw === 'xlsx' ? 'xlsx' : 'pptx';
  const copy = COPY[format];
  const { doc, loading, choose } = useSelectedDocument();
  const [picker, setPicker] = useState(false);
  const [language, setLanguage] = useState<OcrLanguage>('en');
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; summary: string } | null>(null);
  const token = useRef({ cancelled: false });

  const supported = format === 'pptx' ? getPdfRenderer() !== null : isOcrSupported();
  if (!supported) {
    return (
      <Screen>
        <Stack.Screen options={{ title: copy.title }} />
        <EmptyState icon="phone-portrait-outline" title="Not available on this device yet" message="This conversion uses Android's on-device page renderer and text recognition." />
      </Screen>
    );
  }

  const fileName = doc ? exportFileName(doc.name, format) : `Converted.${format}`;

  const run = async () => {
    if (!doc) return;
    token.current = { cancelled: false };
    setProgress(0);
    setResult(null);
    try {
      const opts = { cancelToken: token.current, onProgress: (d: number, t: number) => setProgress(t > 0 ? d / t : null) };
      if (format === 'pptx') {
        const out = await pdfToPowerPoint(doc, opts);
        setResult({ bytes: out.bytes, summary: `${out.slides} ${out.slides === 1 ? 'slide' : 'slides'} · ${formatBytes(out.bytes.length)}` });
      } else {
        const out = await pdfToExcel(doc, language, opts);
        setResult({ bytes: out.bytes, summary: `${out.rows} ${out.rows === 1 ? 'row' : 'rows'} · ${formatBytes(out.bytes.length)}` });
      }
    } catch (error) {
      if (!isCancelled(error)) appAlert('Could not convert', errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Screen scroll edges={['left', 'right', 'bottom']} contentStyle={{ paddingTop: spacing.lg, gap: spacing.lg }}>
      <Stack.Screen options={{ title: copy.title }} />
      {loading ? (
        <LoadingState />
      ) : !doc ? (
        <ChooseDocumentCard icon={copy.icon} title={copy.title} message={copy.intro} onChoose={() => setPicker(true)} onCreated={(d) => (setResult(null), choose(d))} />
      ) : (
        <>
          <SelectedDocumentCard doc={doc} onChange={() => setPicker(true)} />
          {format === 'xlsx' ? (
            <Field label="Text language">
              <ChoiceRow options={OCR_LANGUAGES.map((l) => ({ value: l.id, label: l.label }))} value={language} onChange={setLanguage} />
            </Field>
          ) : null}
          <AppText variant="caption" tone="muted">
            {copy.intro}
          </AppText>
          {result ? (
            <Card style={{ gap: spacing.md }}>
              <View style={[styles.row, { gap: spacing.md }]}>
                <View style={[styles.badge, { backgroundColor: colors.successSoft, borderRadius: radius.md }]}>
                  <Icon name="checkmark-circle-outline" size={22} color={colors.success} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {fileName}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {result.summary}
                  </AppText>
                </View>
              </View>
              <View style={[styles.row, { gap: spacing.sm }]}>
                <Button
                  label="Share"
                  icon="share-outline"
                  style={styles.flex}
                  onPress={() => void shareBytes(fileName, result.bytes, copy.mime, copy.uti).catch((e) => appAlert('Could not share', errorMessage(e)))}
                />
                {canSaveToDevice ? (
                  <Button
                    label="Save"
                    icon="download-outline"
                    variant="secondary"
                    style={styles.flex}
                    onPress={() =>
                      void saveBytesToDevice(fileName, result.bytes, copy.mime)
                        .then((ok) => ok && toast(`Saved ${fileName}`))
                        .catch((e) => appAlert('Could not save', errorMessage(e)))
                    }
                  />
                ) : null}
              </View>
            </Card>
          ) : (
            <Button label={copy.action} icon={copy.icon} fullWidth onPress={() => void run()} />
          )}
        </>
      )}
      <DocumentSelectModal visible={picker} title="Choose a PDF" onClose={() => setPicker(false)} onSelect={([d]) => (setPicker(false), setResult(null), choose(d))} />
      <ProgressOverlay visible={progress !== null} title={format === 'pptx' ? 'Creating slides' : 'Reading tables'} progress={progress} onCancel={() => (token.current.cancelled = true)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
