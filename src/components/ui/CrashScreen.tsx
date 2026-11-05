import { router, type ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';
import { errorMessage } from '@/utils/errors';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

/**
 * Shown when a screen throws while rendering (expo-router error boundary).
 * The rest of the app and the library are unaffected; the user can retry or go home.
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const { colors, radius, spacing } = useAppTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.background }]}>
      <View style={[styles.center, { padding: spacing.xxl, gap: spacing.md }]} accessibilityRole="alert">
        <View style={[styles.halo, { backgroundColor: colors.dangerSoft }]}>
          <Icon name="alert-circle-outline" size={30} color={colors.danger} />
        </View>
        <AppText variant="title" align="center">
          This screen ran into a problem
        </AppText>
        <AppText tone="muted" align="center" style={styles.text}>
          Your documents are safe. Try again, or go back to Home.
        </AppText>
        <View style={[styles.details, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }]}>
          <AppText variant="caption" tone="subtle" numberOfLines={4} selectable>
            {errorMessage(error, 'Unknown error')}
          </AppText>
        </View>
        <View style={[styles.buttons, { gap: spacing.sm, marginTop: spacing.sm }]}>
          <Button label="Try again" icon="refresh" fullWidth onPress={() => void retry()} />
          <Button label="Go to Home" icon="home" variant="secondary" fullWidth onPress={() => router.replace('/')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  halo: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  text: { maxWidth: 340 },
  details: { alignSelf: 'stretch', maxWidth: 420 },
  buttons: { alignSelf: 'stretch', maxWidth: 420 },
});
