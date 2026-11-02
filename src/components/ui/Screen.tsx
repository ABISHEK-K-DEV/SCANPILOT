import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** Max width keeps layouts readable on tablets and foldables. */
const MAX_CONTENT_WIDTH = 820;

export function Screen({ children, scroll = false, edges = ['top', 'left', 'right'], contentStyle, refreshing, onRefresh }: ScreenProps) {
  const { colors, spacing } = useAppTheme();
  const inner = [styles.inner, { paddingHorizontal: spacing.lg }, contentStyle];
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ paddingBottom: spacing.xxl }, styles.scrollContent]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
          }
        >
          <View style={inner}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { alignItems: 'center' },
  inner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
});
