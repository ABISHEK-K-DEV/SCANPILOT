import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { DocumentSelectModal } from '@/components/tools/DocumentSelectModal';
import { ChooseDocumentCard } from '@/components/tools/DocumentSources';
import { ChoiceRow, Field } from '@/components/tools/FormBits';
import { OptionCard } from '@/components/tools/OptionCard';
import { SelectedDocumentCard } from '@/components/tools/SelectedDocumentCard';
import { AppText, Button, Card, EmptyState, LoadingState, ProgressOverlay, Screen, SearchField } from '@/components/ui';
import { useSelectedDocument } from '@/hooks/useSelectedDocument';
import { waitForCameraPages } from '@/services/scan/cameraBridge';
import { OCR_LANGUAGES, type OcrLanguage } from '@/native/ocr';
import { buildDocx } from '@/services/export/docx';
import { findMatches, isOcrSupported, joinPages, makeSearchablePdf, type OcrRun, recogniseDocument, recogniseImages } from '@/services/ocr/ocrService';
import { canSaveToDevice, saveBytesToDevice, shareBytes } from '@/services/share/shareService';
import { useAppTheme } from '@/theme';
import { errorMessage, isCancelled } from '@/utils/errors';
import { exportFileName } from '@/utils/filename';
import { appAlert, toast } from '@/stores/dialogStore';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const encoder = new TextEncoder();

export default function OcrScreen() {
  const { colors, spacing, radius, typography } = useAppTheme();
  const params = useLocalSearchParams<{ output?: string; id?: string }>();
  const { output } = params;
  const wantWord = output === 'word';
  const { doc, loading, choose } = useSelectedDocument();
  const [picker, setPicker] = useState(false);
  const [source, setSource] = useState<'camera' | 'photos' | 'pdf'>(doc || params.id ? 'pdf' : 'camera');
  const [edited, setEdited] = useState<string[] | null>(null);
  const [language, setLanguage] = useState<OcrLanguage>('en');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [run, setRun] = useState<OcrRun | null>(null);
  const [title, setTitle] = useState('Extracted text');
  const [query, setQuery] = useState('');
  const token = useRef({ cancelled: false });

  if (!isOcrSupported()) {
    return (
      <Screen>
        <Stack.Screen options={{ title: wantWord ? 'PDF to Word' : 'Extract text (OCR)' }} />
        <EmptyState icon="text-outline" title="Not available on this device yet" message="Offline text recognition uses Google ML Kit on Android. iOS support is coming." />
      </Screen>
    );
  }

  const start = async () => {
    token.current = { cancelled: false };
    try {
      let result: OcrRun;
      if (source === 'camera') {
        const waiting = waitForCameraPages();
        router.push({ pathname: '/scan/camera', params: { mode: 'return' } });
        const shot = await waiting;
        if (!shot || shot.length === 0) return;
        setProgress({ done: 0, total: shot.length });
        // Use the untouched (cropped) photo, not the enhanced one: filters can hide faint text.
        result = await recogniseImages(shot.map((p) => p.base?.uri ?? p.uri), language, { cancelToken: token.current, onProgress: (d, t) => setProgress({ done: d, total: t }) });
        setTitle('Scanned text');
      } else if (source === 'photos') {
        const picked = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, orderedSelection: true, quality: 1 });
        if (picked.canceled || picked.assets.length === 0) return;
        setProgress({ done: 0, total: picked.assets.length });
        result = await recogniseImages(picked.assets.map((a) => a.uri), language, { cancelToken: token.current, onProgress: (d, t) => setProgress({ done: d, total: t }) });
        setTitle('Text from photos');
      } else {
        if (!doc) return;
        setProgress({ done: 0, total: doc.pageCount ?? 1 });
        result = await recogniseDocument(doc, language, { cancelToken: token.current, onProgress: (d, t) => setProgress({ done: d, total: t }) });
        setTitle(doc.name);
      }
      setRun(result);
      setEdited(result.pages.map((p) => p.text));
      if (wantWord) await exportWord(result, source === 'pdf' && doc ? doc.name : 'Extracted text');
    } catch (error) {
      if (!isCancelled(error)) appAlert('Text recognition failed', errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  // Copy / share / export use the text as corrected by the user.
  const pagesText = run ? run.pages.map((p, i) => ({ ...p, text: edited?.[i] ?? p.text })) : [];
  const text = run ? joinPages(pagesText) : '';
  const matches = run ? findMatches(pagesText, query) : [];
  const totalMatches = matches.reduce((a, b) => a + b, 0);
  const empty = run !== null && run.pages.every((p) => !p.text.trim());

  async function exportWord(r: OcrRun, name: string) {
    const bytes = buildDocx(r.pages.map((p, i) => edited?.[i] ?? p.text), name);
    await shareBytes(exportFileName(name, 'docx'), bytes, DOCX_MIME, 'org.openxmlformats.wordprocessingml.document');
  }

  const actions = run && !empty && (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          label="Copy all"
          icon="copy-outline"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => void Clipboard.setStringAsync(text).then(() => toast('Text copied to the clipboard'))}
        />
        <Button
          label="Share .txt"
          icon="share-outline"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => shareBytes(exportFileName(title, 'txt'), encoder.encode(text), 'text/plain', 'public.plain-text').catch((e) => appAlert('Could not share', errorMessage(e)))}
        />
      </View>
      <Button label="Export as Word (.docx)" icon="document-text-outline" variant="secondary" onPress={() => void exportWord(run, title).catch((e) => appAlert('Could not export', errorMessage(e)))} />
      {canSaveToDevice ? (
        <Button
          label="Save .txt to device…"
          icon="download-outline"
          variant="ghost"
          onPress={() =>
            saveBytesToDevice(exportFileName(title, 'txt'), encoder.encode(text), 'text/plain')
              .then((ok) => ok && toast('Text file saved'))
              .catch((e) => appAlert('Could not save', errorMessage(e)))
          }
        />
      ) : null}
      {source === 'pdf' && doc ? (
        <Button
          label="Make a searchable PDF"
          icon="search-outline"
          variant="tonal"
          onPress={() =>
            makeSearchablePdf(doc, run)
              .then((created) => router.push({ pathname: '/document/[id]', params: { id: created.id } }))
              .catch((e) => appAlert('Could not create PDF', errorMessage(e)))
          }
        />
      ) : null}
    </View>
  );

  return (
    <Screen scroll edges={['left', 'right', 'bottom']} contentStyle={{ paddingTop: spacing.lg, gap: spacing.lg }}>
      <Stack.Screen options={{ title: wantWord ? 'PDF to Word' : 'Extract text (OCR)' }} />
      <View style={{ gap: spacing.sm }}>
        <OptionCard icon="camera" title="Scan with camera" description="Photograph a page, sign, label or notes" selected={source === 'camera'} onPress={() => setSource('camera')} />
        <OptionCard icon="images-outline" title="From photos" description="Pick pictures from your gallery" selected={source === 'photos'} onPress={() => setSource('photos')} />
        <OptionCard icon="document-text-outline" title="From a PDF" description="Read every page of a document in your library" selected={source === 'pdf'} onPress={() => setSource('pdf')} />
      </View>
      {source === 'pdf' ? (
        loading ? (
          <LoadingState />
        ) : doc ? (
          <SelectedDocumentCard doc={doc} onChange={() => setPicker(true)} />
        ) : (
          <ChooseDocumentCard
            icon="scan-text"
            title="Choose a PDF to read"
            message="Text is recognised on your device. Nothing is uploaded."
            onChoose={() => setPicker(true)}
            onCreated={(d) => (setRun(null), choose(d))}
          />
        )
      ) : null}
      <Field label="Language">
        <ChoiceRow options={OCR_LANGUAGES.map((l) => ({ value: l.id, label: l.label }))} value={language} onChange={setLanguage} />
      </Field>
      <Button
        label={wantWord ? 'Convert to Word' : source === 'camera' ? 'Open camera' : source === 'photos' ? 'Choose photos' : 'Extract text'}
        icon={wantWord ? 'document-text-outline' : source === 'camera' ? 'camera' : source === 'photos' ? 'images-outline' : 'scan-text'}
        fullWidth
        disabled={source === 'pdf' && !doc}
        onPress={() => void start()}
      />
      <AppText variant="caption" tone="subtle">
        Recognition runs entirely on this phone — nothing is uploaded. {wantWord ? 'Word files contain the recognised text (layout and images are not reproduced).' : ''}
      </AppText>

      {run ? (
        empty ? (
          <Card>
            <EmptyState compact icon="eye-off-outline" title="No text found" message="Try a sharper scan or the other language option." />
          </Card>
        ) : (
          <>
            {actions}
            <SearchField value={query} onChangeText={setQuery} placeholder="Search in the text" />
            {query.trim() ? (
              <AppText variant="caption" tone={totalMatches ? 'primary' : 'muted'}>
                {totalMatches} {totalMatches === 1 ? 'match' : 'matches'}
                {totalMatches ? ` · on page ${matches.map((m, i) => (m ? i + 1 : null)).filter(Boolean).join(', ')}` : ''}
              </AppText>
            ) : null}
            {run.pages.map((p, i) => (
              <Card key={i} style={{ gap: spacing.xs }}>
                <AppText variant="label" tone="subtle">
                  {run.pages.length > 1 ? `PAGE ${i + 1} · ` : ''}TAP TO EDIT
                </AppText>
                <TextInput
                  value={edited?.[i] ?? p.text}
                  onChangeText={(value) => setEdited((prev) => (prev ?? run.pages.map((x) => x.text)).map((t, k) => (k === i ? value : t)))}
                  placeholder="No text on this page"
                  placeholderTextColor={colors.textSubtle}
                  multiline
                  scrollEnabled={false}
                  textAlignVertical="top"
                  accessibilityLabel={`Recognised text, page ${i + 1}. You can edit it.`}
                  style={[typography.body, { color: colors.text, padding: 0, borderRadius: radius.sm, minHeight: 60 }]}
                />
              </Card>
            ))}
          </>
        )
      ) : null}
      <DocumentSelectModal visible={picker} title="Choose a PDF" onClose={() => setPicker(false)} onSelect={([d]) => (setPicker(false), setRun(null), choose(d))} />
      <ProgressOverlay
        visible={progress !== null}
        title="Recognising text"
        progress={progress && progress.total > 0 ? progress.done / progress.total : null}
        detail={progress ? `Page ${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : undefined}
        onCancel={() => (token.current.cancelled = true)}
      />
    </Screen>
  );
}
