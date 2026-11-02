import { View } from 'react-native';

import { useAppTheme } from '@/theme';

import { AppText } from './AppText';

type Tone = 'neutral' | 'primary' | 'success' | 'warning';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { colors, radius } = useAppTheme();
  const map: Record<Tone, [string, string]> = {
    neutral: [colors.surfaceAlt, colors.textMuted],
    primary: [colors.primarySoft, colors.primary],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </View>
  );
}
