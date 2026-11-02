import { useLocalSearchParams } from 'expo-router';

import { LibraryBrowser } from '@/components/documents/LibraryBrowser';
import { Screen } from '@/components/ui';

export default function LibraryScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  return (
    <Screen contentStyle={{ paddingHorizontal: 0 }}>
      <LibraryBrowser title="Files" autoFocusSearch={focus === 'search'} />
    </Screen>
  );
}
