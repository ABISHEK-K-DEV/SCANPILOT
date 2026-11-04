/**
 * Camera adapter (expo-camera, MIT). Screens import the camera only from here,
 * so the implementation can change without touching UI code.
 * Photos are taken on-device and never leave it.
 */
export { CameraView, useCameraPermissions } from 'expo-camera';
export type { CameraCapturedPicture, FlashMode } from 'expo-camera';
