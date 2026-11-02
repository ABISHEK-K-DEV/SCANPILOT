import { Tabs } from 'expo-router/js-tabs';

import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { useAppTheme } from '@/theme';

function tabIcon(name: IconName, focusedName: IconName) {
  // eslint-disable-next-line react/display-name
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Icon name={focused ? focusedName : name} color={typeof color === 'string' ? color : undefined} size={24} />
  );
}

export default function TabLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="library" options={{ title: 'Files', tabBarIcon: tabIcon('folder-outline', 'folder') }} />
      <Tabs.Screen name="tools" options={{ title: 'Tools', tabBarIcon: tabIcon('grid-outline', 'grid') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
