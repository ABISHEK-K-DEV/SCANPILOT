import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useAppTheme } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

/** Decorative by default; give the parent control an accessibilityLabel. */
export function Icon({ name, size = 22, color }: IconProps) {
  const theme = useAppTheme();
  return (
    <Ionicons
      name={name}
      size={size}
      color={color ?? theme.colors.text}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
