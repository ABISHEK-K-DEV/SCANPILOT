import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { DocumentSelectModal } from '@/components/tools/DocumentSelectModal';
import { ChoiceRow, Field } from '@/components/tools/FormBits';
import { OptionCard } from '@/components/tools/OptionCard';
import { SelectedDocumentCard } from '@/components/tools/SelectedDocumentCard';
import { AppText, Button, Card, EmptyState, LoadingState, ProgressOverlay, Screen, SearchField } from '@/components/ui';
import { useSelectedDocument } from '@/hooks/useSelectedDocument';
import { OCR_LANGUAGES, type OcrLanguage } from '@/native/ocr';
import { buildDocx } from '@/services/export/docx';
import { findMatches, isOcrSupported, joinPages, makeSearchablePdf, type OcrRun, recogniseDocument, recogniseImages } from '@/services/ocr/ocrService';
import { canSaveToDevice, saveBytesToDevice, shareBytes } from '@/services/share/shareService';
import { useAppTheme } from '@/theme';
import { errorMessage, isCancelled } from '@/utils/errors';
import { exportFileName } from '@/utils/filename';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const encoder = new TextEncoder();

export default function OcrScreen() {
  const { colors, spacing, radius, typography } = useAppTheme();
  const { output } = useLocalSearchParams<{ output?: string }>();
  const wantWord = output === 'word';
  const { doc, loading, choose } = useSelectedDocument();
  const [picker, setPicker] = useState(false);
  const [source, setSource] = useState<'pdf' | 'photos'>('pdf');
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
      if (source === 'photos') {
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
      if (wantWord) await exportWord(result, source === 'pdf' && doc ? doc.name : 'Extracted text');
    } catch (error) {
      if (!isCancelled(error)) Alert.alert('Text recognition failed', errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  const text = run ? joinPages(run.pages) : '';
  const matches = run ? findMatches(run.pages, query) : [];
  const totalMatches = matches.reduce((a, b) => a + b, 0);
  const empty = run !== null && run.pages.every((p) => !p.text.trim());

  async function exportWord(r: OcrRun, name: string) {
    const bytes = buildDocx(r.pages.map((p) => p.text), name);
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
          onPress={() => void Clipboard.setStringAsync(text).then(() => Alert.alert('Copied', 'The text is on your clipboard.'))}
        />
        <Button
          label="Share .txt"
          icon="share-outline"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => shareBytes(exportFileName(title, 'txt'), encoder.encode(text), 'text/plain', 'public.plain-text').catch((e) => Alert.alert('Could not share', errorMessage(e)))}
        />
      </View>
      <Button label="Export as Word (.docx)" icon="document-text-outline" variant="secondary" onPress={() => void exportWord(run, title).catch((e) => Alert.alert('Could not export', errorMessage(e)))} />
      {canSaveToDevice ? (
        <Button
          label="Save .txt to device…"
          icon="download-outline"
          variant="ghost"
          onPress={() =>
            saveBytesToDevice(exportFileName(title, 'txt'), encoder.encode(text), 'text/plain')
              .then((ok) => ok && Alert.alert('Saved', 'The text file was saved to the folder you chose.'))
              .catch((e) => Alert.alert('Could not save', errorMessage(e)))
          }
        />
      ) : null}
      {source === 'pdf' && doc ? (
        <Button
          label="Make a searchable PDF"
          icon="search-outline"
          onPress={() =>
            makeSearchablePdf(doc, run)
              .then((created) => router.push({ pathname: '/document/[id]', params: { id: created.id } }))
              .catch((e) => Alert.alert('Could not create PDF', errorMessage(e)))
          }
        />
      ) : null}
    </View>
  );

  return (
    <Screen scroll edges={['left', 'right', 'bottom']} contentStyle={{ paddingTop: spacing.lg, gap: spacing.lg }}>
      <Stack.Screen options={{ title: wantWord ? 'PDF to Word' : 'Extract text (OCR)' }} />
      <View style={{ gap: spacing.sm }}>
        <OptionCard icon="document-text-outline" title="From a PDF" description="Read every page of a document in your library" selected={source === 'pdf'} onPress={() => setSource('pdf')} />
        <OptionCard icon="images-outline" title="From photos" description="Pick pictures of documents, signs or notes" selected={source === 'photos'} onPress={() => setSource('photos')} />
      </View>
      {source === 'pdf' ? (
        loading ? (
          <LoadingState />
        ) : doc ? (
          <SelectedDocumentCard doc={doc} onChange={() => setPicker(true)} />
        ) : (
          <Button label="Choose PDF" icon="document-outline" variant="secondary" onPress={() => setPicker(true)} />
        )
      ) : null}
      <Field label="Language">
        <ChoiceRow options={OCR_LANGUAGES.map((l) => ({ value: l.id, label: l.label }))} value={language} onChange={setLanguage} />
      </Field>
      <Button
        label={wantWord ? 'Convert to Word' : 'Extract text'}
        icon={wantWord ? 'document-text-outline' : 'scan-outline'}
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
                {run.pages.length > 1 ? (
                  <AppText variant="label" tone="subtle">
                    PAGE {i + 1}
                  </AppText>
                ) : null}
                <TextInput
                  value={p.text || '—'}
                  editable={false}
                  multiline
                  scrollEnabled={false}
                  accessibilityLabel={`Recognised text, page ${i + 1}`}
                  style={[typography.body, { color: colors.text, padding: 0, borderRadius: radius.sm }]}
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
