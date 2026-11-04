import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { useAppTheme } from '@/theme';

interface PageTileProps {
  number: number;
  uri?: string;
  rotate: number;
  selected: boolean;
  width: number;
  onPress: () => void;
}

export function PageTile({ number, uri, rotate, selected, width, onPress }: PageTileProps) {
  const { colors, radius } = useAppTheme();
  const height = width * 1.35;
  const sideways = rotate % 180 !== 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`Page ${number}${rotate ? `, rotated ${rotate} degrees` : ''}`}
      style={[styles.tile, { width, height: height + 22, borderRadius: radius.md }]}
    >
      <View
        style={[
          styles.frame,
          { height, borderRadius: radius.md, borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.thumbnailBackground },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            contentFit="contain"
            style={{
              width: sideways ? height - 8 : width - 8,
              height: sideways ? width - 8 : height - 8,
              transform: [{ rotate: `${rotate}deg` }],
            }}
            recyclingKey={uri}
          />
        ) : (
          <AppText variant="title" tone="subtle" style={{ transform: [{ rotate: `${rotate}deg` }] }}>
            {number}
          </AppText>
        )}
        {selected ? (
          <View style={[styles.check, { backgroundColor: colors.primary }]}>
            <Icon name="checkmark" size={14} color={colors.onPrimary} />
          </View>
        ) : null}
      </View>
      <AppText variant="caption" tone={selected ? 'primary' : 'muted'} align="center">
        {number}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { gap: 4 },
  frame: { borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  check: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
