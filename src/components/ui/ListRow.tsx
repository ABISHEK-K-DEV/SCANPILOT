import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH, useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface ListRowProps {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  showChevron?: boolean;
  destructive?: boolean;
}

export function ListRow({ icon, iconColor, title, subtitle, value, trailing, onPress, disabled, showChevron, destructive }: ListRowProps) {
  const { colors, spacing, radius } = useAppTheme();
  const titleColor = destructive ? colors.danger : colors.text;
  const content = (
    <>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: destructive ? colors.dangerSoft : colors.primarySoft, borderRadius: radius.sm }]}>
          <Icon name={icon} size={18} color={iconColor ?? (destructive ? colors.danger : colors.primary)} />
        </View>
      ) : null}
      <View style={styles.text}>
        <AppText color={titleColor}>{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="caption" tone="muted">
          {value}
        </AppText>
      ) : null}
      {trailing}
      {showChevron ?? !!onPress ? <Icon name="chevron-forward" size={18} color={colors.textSubtle} /> : null}
    </>
  );
  const style = [styles.row, { paddingHorizontal: spacing.lg, gap: spacing.md, minHeight: MIN_TOUCH + 8 }];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [...style, pressed && { backgroundColor: colors.surfacePressed }, disabled && { opacity: 0.5 }]}
    >
      {content}
    </Pressable>
  );
}

export function ListGroup({ children, title }: { children: ReactNode; title?: string }) {
  const { colors, radius, spacing } = useAppTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {title ? (
        <AppText variant="label" tone="subtle" style={{ paddingHorizontal: spacing.xs, textTransform: 'uppercase' }}>
          {title}
        </AppText>
      ) : null}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  iconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
