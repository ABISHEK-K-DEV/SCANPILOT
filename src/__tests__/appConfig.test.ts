/// <reference types="node" />
import { readFileSync } from 'fs';
import path from 'path';

type Plugin = string | [string, Record<string, unknown>];
const config = JSON.parse(readFileSync(path.join(__dirname, '../../app.json'), 'utf8')) as {
  expo: { plugins: Plugin[]; android: { blockedPermissions?: string[] } };
};
const plugins = config.expo.plugins;
const options = (name: string) => (plugins.find((p) => Array.isArray(p) && p[0] === name) as [string, Record<string, unknown>] | undefined)?.[1];
const index = (name: string) => plugins.findIndex((p) => (Array.isArray(p) ? p[0] : p) === name);

describe('app.json', () => {
  it('keeps the CAMERA permission for ScanPilot’s camera', () => {
    // expo-image-picker with cameraPermission: false *blocks* android.permission.CAMERA
    // (tools:node="remove"), which left the camera screen unable to get access.
    expect(options('expo-image-picker')?.cameraPermission).not.toBe(false);
    expect(options('expo-camera')).toBeDefined();
    expect(config.expo.android.blockedPermissions ?? []).not.toContain('android.permission.CAMERA');
  });

  it('never asks for the microphone', () => {
    expect(options('expo-camera')?.microphonePermission).toBe(false);
    expect(options('expo-camera')?.recordAudioAndroid).toBe(false);
    expect(config.expo.android.blockedPermissions).toContain('android.permission.RECORD_AUDIO');
  });

  it('orders camera plugins before expo-image-picker (iOS Info.plist mods run in reverse)', () => {
    expect(index('react-native-document-scanner-plugin')).toBeLessThan(index('expo-image-picker'));
    expect(index('expo-camera')).toBeLessThan(index('expo-image-picker'));
  });
});
