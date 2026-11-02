import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PdfViewerProps } from './types';

/** Web fallback: the browser's built-in PDF viewer. Keeps the route usable for future web support. */
export function PdfViewer({ uri }: PdfViewerProps) {
  return <View style={styles.fill}>{createElement('iframe', { src: uri, title: 'PDF document', style: { border: 0, width: '100%', height: '100%' } })}</View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
