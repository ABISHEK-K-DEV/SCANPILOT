import { Image } from 'expo-image';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { PdfViewerProps } from '@/components/pdf/types';

/** Demo stand-in for the native viewer: renders pre-made page images. */
export function PdfViewer({ uri, onPageChanged }: PdfViewerProps) {
  const total = Number(/pages=(\d+)/.exec(uri)?.[1] ?? 1);
  const base = uri.split('?')[0];
  useEffect(() => onPageChanged?.(1, total), [onPageChanged, total]);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {Array.from({ length: Math.min(total, 3) }, (_, i) => (
        <View key={i} style={styles.page}>
          <Image source={{ uri: `${base}page-${Math.min(i + 1, 2)}.png` }} style={styles.image} contentFit="contain" />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 12 },
  page: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 2 },
  image: { width: '100%', aspectRatio: 1 / 1.414 },
});
