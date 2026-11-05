import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { ScanPage } from '@/services/scan/types';
import { useAppTheme } from '@/theme';

interface PageThumbProps {
  page: ScanPage;
  index: number;
  selected: boolean;
  onPress: () => void;
  /** Thumbnail width; height follows a 3:4 page. */
  width?: number;
}

export function PageThumb({ page, index, selected, onPress, width = 64 }: PageThumbProps) {
  const { colors, radius } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Page ${index + 1}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.thumb,
        { width, height: Math.round(width * 1.34), transform: [{ scale: pressed ? 0.94 : selected ? 1.04 : 1 }] },
        { borderRadius: radius.sm + 2, borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.surface },
      ]}
    >
      <Image source={{ uri: page.uri }} style={styles.image} contentFit="cover" transition={160} recyclingKey={page.uri} />
      <View style={[styles.badge, { backgroundColor: selected ? colors.primary : 'rgba(15,23,42,0.7)', borderRadius: radius.pill }]}>
        <AppText variant="label" color="#FFFFFF">
          {index + 1}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumb: { borderWidth: 2, overflow: 'hidden' },
  image: { flex: 1 },
  badge: { position: 'absolute', bottom: 3, right: 3, minWidth: 20, paddingHorizontal: 4, alignItems: 'center' },
});
