import type { ReactNode } from 'react';
import { ScrollView, Switch, TextInput, type TextInputProps, View } from 'react-native';

import { AppText, Chip } from '@/components/ui';
import { useAppTheme } from '@/theme';

export function FieldLabel({ children }: { children: string }) {
  return (
    <AppText variant="label" tone="subtle">
      {children.toUpperCase()}
    </AppText>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const { spacing } = useAppTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps & { invalid?: boolean }) {
  const { colors, spacing, radius, typography } = useAppTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textSubtle}
      {...props}
      style={[
        typography.body,
        { minHeight: 48, borderWidth: 1, color: colors.text, backgroundColor: colors.surface, borderColor: props.invalid ? colors.danger : colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
        props.style,
      ]}
    />
  );
}

export function ChoiceRow<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { spacing } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} style={{ flexGrow: 0 }}>
      {options.map((o) => (
        <Chip key={String(o.value)} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}

export function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors, spacing } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <AppText>{label}</AppText>
        {hint ? (
          <AppText variant="caption" tone="muted">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={label} />
    </View>
  );
}
