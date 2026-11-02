import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui';
import { ensureThumbnail } from '@/services/library/documentService';
import { useAppTheme } from '@/theme';
import type { ScanDocument } from '@/types/document';

interface DocumentThumbnailProps {
  doc: ScanDocument;
  width: number;
  height: number;
}

export function DocumentThumbnail({ doc, width, height }: DocumentThumbnailProps) {
  const { colors, radius } = useAppTheme();

  useEffect(() => {
    // Backfill thumbnails that failed earlier (e.g. created while the app was killed).
    if (!doc.thumbnailUri) void ensureThumbnail(doc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.thumbnailUri]);

  return (
    <View
      style={[
        styles.frame,
        { width, height, backgroundColor: colors.thumbnailBackground, borderRadius: radius.md, borderColor: colors.border },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {doc.thumbnailUri ? (
        <Image source={{ uri: doc.thumbnailUri }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={120} recyclingKey={doc.thumbnailUri} />
      ) : (
        <Icon name="document-text-outline" size={Math.min(width, height) * 0.36} color={colors.textSubtle} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
