import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { Icon } from './Icon';

interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchField({ value, onChangeText, placeholder = 'Search documents', autoFocus }: SearchFieldProps) {
  const { colors, radius, spacing, typography } = useAppTheme();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md + 2, paddingHorizontal: spacing.md + 2, gap: spacing.sm + 2 },
      ]}
    >
      <Icon name="search" size={18} color={colors.textSubtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        accessibilityLabel={placeholder}
        style={[typography.body, styles.input, { color: colors.text }]}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
          <Icon name="close-circle" size={18} color={colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderWidth: 1 },
  input: { flex: 1, paddingVertical: 10 },
});
