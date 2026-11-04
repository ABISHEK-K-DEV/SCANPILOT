import { Stack } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { View } from 'react-native';

import { DocumentSelectModal } from '@/components/tools/DocumentSelectModal';
import { ChooseDocumentCard } from '@/components/tools/DocumentSources';
import { ResultList } from '@/components/tools/ResultList';
import { SelectedDocumentCard } from '@/components/tools/SelectedDocumentCard';
import { Button, type IconName, LoadingState, ProgressOverlay, Screen } from '@/components/ui';
import { useSelectedDocument } from '@/hooks/useSelectedDocument';
import type { CancelToken, Progress } from '@/services/pdf/types';
import { useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';
import { errorMessage, isCancelled } from '@/utils/errors';
import { appAlert } from '@/stores/dialogStore';

interface SimpleDocToolProps {
  title: string;
  icon: IconName;
  intro: string;
  actionLabel: string;
  resultTitle: string;
  /** Options UI for the chosen document. */
  children?: (doc: ScanDocument) => ReactNode;
  /** Return an error string to disable the action. */
  validate?: (doc: ScanDocument) => string | null;
  run: (doc: ScanDocument, onProgress: Progress, cancelToken: CancelToken) => Promise<ScanDocument | ScanDocument[]>;
  renderResult?: (docs: ScanDocument[]) => ReactNode;
}

/** Scaffold for single-document tools: pick → options → run (progress, cancel) → result. */
export function SimpleDocTool({ title, icon, intro, actionLabel, resultTitle, children, validate, run, renderResult }: SimpleDocToolProps) {
  const { spacing } = useAppTheme();
  const { doc, loading, choose } = useSelectedDocument();
  const [picker, setPicker] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [results, setResults] = useState<ScanDocument[] | null>(null);
  const token = useRef({ cancelled: false });

  const start = async () => {
    if (!doc) return;
    token.current = { cancelled: false };
    setProgress(0);
    try {
      const out = await run(doc, (d, t) => setProgress(t > 0 ? d / t : null), token.current);
      setResults(Array.isArray(out) ? out : [out]);
    } catch (error) {
      if (!isCancelled(error)) appAlert(`Could not ${actionLabel.toLowerCase()}`, errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  const problem = doc && validate ? validate(doc) : null;

  return (
    <Screen scroll edges={['left', 'right', 'bottom']} contentStyle={{ paddingTop: spacing.lg, gap: spacing.lg }}>
      <Stack.Screen options={{ title }} />
      {loading ? (
        <LoadingState />
      ) : !doc ? (
        <ChooseDocumentCard icon={icon} title={title} message={intro} onChoose={() => setPicker(true)} onCreated={(d) => (setResults(null), choose(d))} />
      ) : (
        <>
          <SelectedDocumentCard doc={doc} onChange={() => setPicker(true)} />
          {results ? (renderResult ? renderResult(results) : <ResultList title={resultTitle} docs={results} />) : null}
          {children ? <View style={{ gap: spacing.md }}>{children(doc)}</View> : null}
          <Button label={problem ?? actionLabel} icon={icon} fullWidth disabled={!!problem} onPress={() => void start()} />
        </>
      )}
      <DocumentSelectModal
        visible={picker}
        title="Choose a PDF"
        onClose={() => setPicker(false)}
        onSelect={([picked]) => {
          setPicker(false);
          setResults(null);
          choose(picked);
        }}
      />
      <ProgressOverlay visible={progress !== null} title={`${actionLabel}…`} progress={progress} onCancel={() => (token.current.cancelled = true)} />
    </Screen>
  );
}
