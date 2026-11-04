import { router } from 'expo-router';
import type { ReactElement } from 'react';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions } from 'react-native';

import { useAppTheme } from '@/theme';
import type { ScanDocument, ViewMode } from '@/types/document';

import { DocumentGridItem, DocumentListItem } from './DocumentItems';

interface DocumentCollectionProps {
  documents: ScanDocument[];
  viewMode: ViewMode;
  onMore: (doc: ScanDocument) => void;
  header?: ReactElement;
  empty?: ReactElement;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const MAX_WIDTH = 820;

export function columnsForWidth(width: number): number {
  if (width >= 900) return 4;
  if (width >= 600) return 3;
  return 2;
}

/** Virtualised grid/list of documents; only visible rows are rendered. */
export function DocumentCollection({ documents, viewMode, onMore, header, empty, refreshing, onRefresh }: DocumentCollectionProps) {
  const { spacing, colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, MAX_WIDTH) - spacing.lg * 2;
  const columns = viewMode === 'grid' ? columnsForWidth(windowWidth) : 1;
  const gap = spacing.md;
  const itemWidth = (contentWidth - gap * (columns - 1)) / columns;
  const open = (doc: ScanDocument) => router.push({ pathname: '/document/[id]', params: { id: doc.id } });

  return (
    <FlatList
      key={`${viewMode}-${columns}`}
      data={documents}
      keyExtractor={(doc) => doc.id}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? { gap } : undefined}
      contentContainerStyle={[styles.content, { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl * 2, gap }]}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item }) =>
        viewMode === 'grid' ? (
          <DocumentGridItem doc={item} onPress={open} onMore={onMore} width={itemWidth} />
        ) : (
          <DocumentListItem doc={item} onPress={open} onMore={onMore} />
        )
      }
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', flexGrow: 1 },
});
