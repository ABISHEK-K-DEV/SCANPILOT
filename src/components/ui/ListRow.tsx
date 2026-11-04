import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH, useAppTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface ListRowProps {
  icon?: IconName;
  iconColor?: string;
  /** Tile behind the icon; defaults to a neutral tint. */
  iconBackground?: string;
  title: string;
  subtitle?: string;
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  showChevron?: boolean;
  destructive?: boolean;
}

export function ListRow({ icon, iconColor, iconBackground, title, subtitle, value, trailing, onPress, disabled, showChevron, destructive }: ListRowProps) {
  const { colors, spacing, radius } = useAppTheme();
  const titleColor = destructive ? colors.danger : colors.text;
  const content = (
    <>
      {icon ? (
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: iconBackground ?? (destructive ? colors.dangerSoft : colors.surfaceAlt), borderRadius: radius.sm + 2 },
          ]}
        >
          <Icon name={icon} size={18} color={iconColor ?? (destructive ? colors.danger : colors.textMuted)} />
        </View>
      ) : null}
      <View style={styles.text}>
        <AppText variant="body" color={titleColor} style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {trailing}
      {showChevron ?? !!onPress ? <Icon name="chevron-forward" size={17} color={colors.textSubtle} /> : null}
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

/** Rounded group of rows with inset hairline separators. */
export function ListGroup({ children, title, footer }: { children: ReactNode; title?: string; footer?: string }) {
  const { colors, radius, spacing } = useAppTheme();
  const rows = Children.toArray(children).filter(isValidElement);
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
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: spacing.lg }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <AppText variant="caption" tone="subtle" style={{ paddingHorizontal: spacing.xs }}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  iconWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  title: { fontSize: 15 },
  value: { maxWidth: '45%' },
  separator: { height: StyleSheet.hairlineWidth },
});
