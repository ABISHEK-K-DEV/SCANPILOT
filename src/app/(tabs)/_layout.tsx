import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui';
import { useAppTheme } from '@/theme';

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.pill, { backgroundColor: focused ? colors.primarySoft : 'transparent' }]}>
      <Icon name={name} size={21} strokeWidth={focused ? 2.1 : 1.8} color={focused ? colors.primary : colors.textSubtle} />
    </View>
  );
}

function tabIcon(name: IconName) {
  // eslint-disable-next-line react/display-name
  return ({ focused }: { focused: boolean }) => <TabIcon name={name} focused={focused} />;
}

export default function TabLayout() {
  const { colors, typography } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, height: 76 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom + 10, elevation: 0 },
        tabBarLabelStyle: { fontFamily: typography.label.fontFamily, fontSize: 11.5, marginTop: 2 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="library" options={{ title: 'Files', tabBarIcon: tabIcon('folder') }} />
      <Tabs.Screen name="tools" options={{ title: 'Tools', tabBarIcon: tabIcon('grid') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
