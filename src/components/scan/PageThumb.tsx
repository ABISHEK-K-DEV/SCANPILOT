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
}

export function PageThumb({ page, index, selected, onPress }: PageThumbProps) {
  const { colors, radius } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Page ${index + 1}`}
      accessibilityState={{ selected }}
      style={[
        styles.thumb,
        { borderRadius: radius.sm, borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.surface },
      ]}
    >
      <Image source={{ uri: page.uri }} style={styles.image} contentFit="cover" recyclingKey={page.uri} />
      <View style={[styles.badge, { backgroundColor: selected ? colors.primary : colors.overlay, borderRadius: radius.sm }]}>
        <AppText variant="label" color="#FFFFFF">
          {index + 1}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 64, height: 86, borderWidth: 2, overflow: 'hidden' },
  image: { flex: 1 },
  badge: { position: 'absolute', bottom: 3, right: 3, minWidth: 20, paddingHorizontal: 4, alignItems: 'center' },
});
