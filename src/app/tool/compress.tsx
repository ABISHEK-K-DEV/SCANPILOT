import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { DocumentSelectModal } from '@/components/tools/DocumentSelectModal';
import { ChooseDocumentCard } from '@/components/tools/DocumentSources';
import { OptionCard } from '@/components/tools/OptionCard';
import { ResultList } from '@/components/tools/ResultList';
import { SelectedDocumentCard } from '@/components/tools/SelectedDocumentCard';
import { AppText, Button, Card, EmptyState, Icon, LoadingState, ProgressOverlay, Screen } from '@/components/ui';
import { useSelectedDocument } from '@/hooks/useSelectedDocument';
import {
  COMPRESSION_LEVELS,
  type CompressionLevel,
  type CompressionResult,
  compressDocument,
  type Estimate,
  estimateCompression,
  isCompressionSupported,
} from '@/services/tools/compressService';
import { useAppTheme } from '@/theme';
import { errorMessage, isCancelled } from '@/utils/errors';
import { formatBytes } from '@/utils/format';

const ICONS: Record<CompressionLevel, 'contract-outline' | 'remove-circle-outline' | 'arrow-down-circle-outline'> = {
  low: 'remove-circle-outline',
  medium: 'contract-outline',
  high: 'arrow-down-circle-outline',
};

export default function CompressScreen() {
  const { colors, spacing, radius } = useAppTheme();
  const { doc, loading, choose } = useSelectedDocument();
  const [picker, setPicker] = useState(false);
  const [level, setLevel] = useState<CompressionLevel>('medium');
  const [estimates, setEstimates] = useState<{ docId: string; list: Estimate[] } | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const token = useRef({ cancelled: false });
  const supported = isCompressionSupported();

  useEffect(() => {
    if (!doc || !supported) return;
    let active = true;
    estimateCompression(doc)
      .then((e) => active && setEstimates({ docId: doc.id, list: e.estimates }))
      .catch((error: unknown) => active && setEstimateError(errorMessage(error)));
    return () => {
      active = false;
    };
  }, [doc, supported]);

  const run = async () => {
    if (!doc) return;
    token.current = { cancelled: false };
    setProgress(0);
    try {
      setResult(await compressDocument(doc, level, { cancelToken: token.current, onProgress: (d, t) => setProgress(d / t) }));
    } catch (error) {
      if (!isCancelled(error)) Alert.alert('Could not compress', errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  const estimateFor = (l: CompressionLevel) => (estimates && doc && estimates.docId === doc.id ? estimates.list.find((e) => e.level === l)?.bytes : undefined);

  if (!supported) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Compress PDF' }} />
        <EmptyState icon="contract-outline" title="Not available on this device yet" message="PDF compression uses Android's built-in page renderer. iOS support is coming in a future update." />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['left', 'right', 'bottom']} contentStyle={{ paddingTop: spacing.lg, gap: spacing.lg }}>
      <Stack.Screen options={{ title: 'Compress PDF' }} />
      {loading ? (
        <LoadingState />
      ) : !doc ? (
        <ChooseDocumentCard icon="contract-outline" title="Make a PDF smaller" message="Best for scans and photos. A compressed copy is created; the original is kept." onChoose={() => setPicker(true)} onCreated={(d) => (choose(d))} />
      ) : (
        <>
          <SelectedDocumentCard doc={doc} onChange={() => setPicker(true)} />
          {result ? (
            result.document ? (
              <>
                <Card style={{ gap: spacing.xs }}>
                  <AppText variant="heading">
                    {formatBytes(result.originalBytes)} → {formatBytes(result.compressedBytes)}
                  </AppText>
                  <AppText tone="success" variant="bodyStrong">
                    {Math.round((1 - result.compressedBytes / result.originalBytes) * 100)}% smaller
                  </AppText>
                </Card>
                <ResultList title="Compressed copy created" docs={[result.document]} />
              </>
            ) : (
              <Card style={{ gap: spacing.xs }}>
                <AppText variant="heading">Already well optimised</AppText>
                <AppText tone="muted">
                  The compressed version would be {formatBytes(result.compressedBytes)} — not smaller than the original ({formatBytes(result.originalBytes)}), so nothing was saved. Try a higher compression level.
                </AppText>
              </Card>
            )
          ) : null}
          <View style={{ gap: spacing.sm }}>
            {(Object.keys(COMPRESSION_LEVELS) as CompressionLevel[]).map((l) => {
              const estimate = estimateFor(l);
              return (
                <OptionCard
                  key={l}
                  icon={ICONS[l]}
                  title={COMPRESSION_LEVELS[l].label}
                  description={COMPRESSION_LEVELS[l].description}
                  selected={level === l}
                  onPress={() => setLevel(l)}
                  trailing={
                    estimate !== undefined ? (
                      <AppText variant="caption" tone={estimate < doc.sizeBytes ? 'success' : 'muted'} accessibilityLabel={`Estimated ${formatBytes(estimate)}`}>
                        ≈ {formatBytes(estimate)}
                      </AppText>
                    ) : estimateError ? null : (
                      <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="Estimating size" />
                    )
                  }
                />
              );
            })}
            <AppText variant="caption" tone="muted">
              Current size {formatBytes(doc.sizeBytes)}.{' '}
              {estimateError ? `Could not estimate: ${estimateError}` : 'Estimates are measured from sample pages.'}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.md }}>
            <Icon name="information-circle-outline" color={colors.warning} />
            <AppText variant="caption" style={{ flex: 1 }} color={colors.text}>
              Pages are re-rendered as images to shrink them, so text in the compressed copy can’t be selected or searched. Your original stays unchanged.
            </AppText>
          </View>
          <Button label="Compress PDF" icon="contract-outline" fullWidth onPress={() => void run()} />
        </>
      )}
      <DocumentSelectModal
        visible={picker}
        title="Choose a PDF to compress"
        onClose={() => setPicker(false)}
        onSelect={([picked]) => {
          setPicker(false);
          setResult(null);
          setEstimates(null);
          setEstimateError(null);
          choose(picked);
        }}
      />
      <ProgressOverlay visible={progress !== null} title="Compressing PDF" progress={progress} onCancel={() => (token.current.cancelled = true)} />
    </Screen>
  );
}
