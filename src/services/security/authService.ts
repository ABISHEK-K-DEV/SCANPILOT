import { authenticateAsync, getEnrolledLevelAsync, SecurityLevel } from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * Device authentication (fingerprint / face / device PIN). Nothing leaves the
 * phone: the OS verifies the user and only tells the app "success".
 */
export async function canAuthenticate(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await getEnrolledLevelAsync()) !== SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export async function authenticate(reason: string): Promise<boolean> {
  try {
    const result = await authenticateAsync({ promptMessage: reason, cancelLabel: 'Cancel', disableDeviceFallback: false });
    return result.success;
  } catch {
    return false;
  }
}
