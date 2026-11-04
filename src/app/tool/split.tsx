import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';

import { DocumentSelectModal } from '@/components/tools/DocumentSelectModal';
import { OptionCard } from '@/components/tools/OptionCard';
import { ResultList } from '@/components/tools/ResultList';
import { SelectedDocumentCard } from '@/components/tools/SelectedDocumentCard';
import { AppText, Button, Card, EmptyState, LoadingState, ProgressOverlay, Screen } from '@/components/ui';
import { useSelectedDocument } from '@/hooks/useSelectedDocument';
import { describePages } from '@/services/pdf/pageRanges';
import { loadPageCount } from '@/services/tools/organizeService';
import { planSplit, splitDocument, type SplitMode } from '@/services/tools/splitService';
import { useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';
import { errorMessage, isCancelled } from '@/utils/errors';

type Kind = SplitMode['kind'];

export default function SplitScreen() {
  const { colors, spacing, radius, typography } = useAppTheme();
  const { doc, loading, choose } = useSelectedDocument();
  const [picker, setPicker] = useState(false);
  const [kind, setKind] = useState<Kind>('ranges');
  const [expression, setExpression] = useState('');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [results, setResults] = useState<ScanDocument[] | null>(null);
  const token = useRef({ cancelled: false });

  useEffect(() => {
    if (!doc) return;
    let active = true;
    loadPageCount(doc)
      .then((count) => active && setPageCount(count))
      .catch((error: unknown) => active && Alert.alert('Could not read this PDF', errorMessage(error)));
    return () => {
      active = false;
    };
  }, [doc]);

  const mode: SplitMode = kind === 'each' ? { kind } : { kind, expression };
  let plan: number[][] | null = null;
  let planError: string | null = null;
  if (pageCount !== null && (kind === 'each' || expression.trim())) {
    try {
      plan = planSplit(mode, pageCount);
    } catch (error) {
      planError = errorMessage(error);
    }
  }

  const run = async () => {
    if (!doc || !plan) return;
    token.current = { cancelled: false };
    setProgress(0);
    try {
      setResults(await splitDocument(doc, mode, { cancelToken: token.current, onProgress: (d, t) => setProgress(d / t) }));
    } catch (error) {
      if (!isCancelled(error)) Alert.alert('Could not split', errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  const summary = plan
    ? plan.length === 1
      ? `Creates 1 PDF with ${describePages(plan[0])}.`
      : `Creates ${plan.length} PDFs: ${plan
          .slice(0, 4)
          .map((g) => describePages(g))
          .join('; ')}${plan.length > 4 ? '; …' : ''}`
    : null;

  return (
    <Screen scroll edges={['left', 'right', 'bottom']} contentStyle={{ paddingTop: spacing.lg, gap: spacing.lg }}>
      <Stack.Screen options={{ title: 'Split PDF' }} />
      {loading ? (
        <LoadingState />
      ) : !doc ? (
        <Card>
          <EmptyState compact icon="cut-outline" title="Split a PDF" message="Pick the document to split. New PDFs are created; the original is kept." actionLabel="Choose PDF" onAction={() => setPicker(true)} />
        </Card>
      ) : (
        <>
          <SelectedDocumentCard doc={doc} onChange={() => setPicker(true)} />
          {results ? <ResultList title={`${results.length} ${results.length === 1 ? 'PDF' : 'PDFs'} created`} docs={results} /> : null}
          <View style={{ gap: spacing.sm }}>
            <OptionCard icon="albums-outline" title="Split by ranges" description="Each range becomes its own PDF, e.g. 1-3, 4-6, 7-" selected={kind === 'ranges'} onPress={() => setKind('ranges')} />
            <OptionCard icon="copy-outline" title="Extract pages" description="Selected pages go into one new PDF, e.g. 2, 5-7" selected={kind === 'extract'} onPress={() => setKind('extract')} />
            <OptionCard icon="documents-outline" title="Every page separately" description={pageCount ? `Creates ${pageCount} single-page PDFs` : 'One PDF per page'} selected={kind === 'each'} onPress={() => setKind('each')} />
          </View>
          {kind !== 'each' ? (
            <View style={{ gap: spacing.xs }}>
              <AppText variant="label" tone="subtle">
                {kind === 'ranges' ? 'RANGES' : 'PAGES'} {pageCount ? `(1–${pageCount})` : ''}
              </AppText>
              <TextInput
                value={expression}
                onChangeText={setExpression}
                placeholder={kind === 'ranges' ? '1-3, 4-6, 7-' : '2, 5-7'}
                placeholderTextColor={colors.textSubtle}
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
                accessibilityLabel={kind === 'ranges' ? 'Page ranges' : 'Pages to extract'}
                style={[
                  typography.body,
                  { minHeight: 48, borderWidth: 1, color: colors.text, backgroundColor: colors.surface, borderColor: planError ? colors.danger : colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
                ]}
              />
            </View>
          ) : null}
          {planError ? (
            <AppText tone="danger" variant="caption" accessibilityRole="alert">
              {planError}
            </AppText>
          ) : summary ? (
            <AppText tone="muted" variant="caption">
              {summary}
            </AppText>
          ) : null}
          <Button label="Split PDF" icon="cut-outline" fullWidth disabled={!plan || pageCount === null} onPress={() => void run()} />
        </>
      )}
      <DocumentSelectModal
        visible={picker}
        title="Choose a PDF to split"
        onClose={() => setPicker(false)}
        onSelect={([picked]) => {
          setPicker(false);
          setResults(null);
          setPageCount(null);
          choose(picked);
        }}
      />
      <ProgressOverlay visible={progress !== null} title="Splitting PDF" progress={progress} onCancel={() => (token.current.cancelled = true)} />
    </Screen>
  );
}
