import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TOUCH, useAppTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only controls must have an accessible name. */
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  filled?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, label, onPress, color, size = 22, filled = false, disabled, style }: IconButtonProps) {
  const { colors, radius } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: MIN_TOUCH - 4,
          height: MIN_TOUCH - 4,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? colors.surfacePressed : filled ? colors.surfaceAlt : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}
