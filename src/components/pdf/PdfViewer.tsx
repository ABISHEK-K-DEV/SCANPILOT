import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Pdf from 'react-native-pdf';

import { useAppTheme } from '@/theme';

import { isPasswordError, type PdfViewerProps } from './types';

/**
 * Native PDF renderer (AndroidPdfViewer / PDFium on Android, PDFKit on iOS)
 * via react-native-pdf. Pages are rendered lazily as they scroll into view,
 * so large documents are not decoded into memory all at once.
 * Requires a development build — it is not available in Expo Go.
 */
export function PdfViewer({ uri, password, onLoadComplete, onPageChanged, onPasswordRequired, onError }: PdfViewerProps) {
  const { colors } = useAppTheme();
  return (
    <Pdf
      source={{ uri, cache: false }}
      password={password}
      trustAllCerts={false}
      enableAntialiasing
      enableDoubleTapZoom
      enableAnnotationRendering
      spacing={12}
      fitPolicy={0}
      minScale={1}
      maxScale={5}
      style={[styles.pdf, { backgroundColor: colors.surfaceAlt }]}
      renderActivityIndicator={() => (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      onLoadComplete={(pageCount) => onLoadComplete?.(pageCount)}
      onPageChanged={(page, pageCount) => onPageChanged?.(page, pageCount)}
      onError={(error) => {
        const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
        if (isPasswordError(message)) onPasswordRequired?.(!!password);
        else onError?.(message);
      }}
      onPressLink={() => {
        // Links are intentionally not opened automatically: opening a URL could
        // leak that a document was viewed. A confirm-and-open flow can come later.
      }}
    />
  );
}

const styles = StyleSheet.create({
  pdf: { flex: 1, width: '100%' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
