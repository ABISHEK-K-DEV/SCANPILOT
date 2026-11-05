/// <reference types="node" />
import { readFileSync } from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applySigning } = require('../../plugins/withReleaseSigning') as { applySigning: (g: string) => string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyAbiSplits } = require('../../plugins/withAbiSplits') as { applyAbiSplits: (g: string) => string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../../app.config') as (ctx: { config: Record<string, unknown> }) => {
  android: { blockedPermissions: string[]; versionCode?: number };
  plugins: unknown[];
};

const TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}`;

describe('release signing plugin', () => {
  it('adds an env-driven release key and uses it only when configured', () => {
    const out = applySigning(TEMPLATE);
    expect(out).toContain("storeFile file(System.getenv('SCANPILOT_UPLOAD_STORE_FILE'))");
    expect(out).toContain("signingConfig System.getenv('SCANPILOT_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug");
    // Debug builds keep the debug key.
    expect(out.match(/signingConfig signingConfigs\.debug/g)).toHaveLength(1);
  });

  it('is idempotent and fails loudly on an unexpected template', () => {
    expect(applySigning(applySigning(TEMPLATE))).toBe(applySigning(TEMPLATE));
    expect(() => applySigning('android {}')).toThrow(/signingConfigs/);
  });
});

describe('ABI splits plugin', () => {
  it('adds per-ABI APKs once, including x86_64 for the emulator', () => {
    const gradle = `apply plugin: "com.android.application"\nandroid {\n    namespace "app.scanpilot"\n}`;
    const out = applyAbiSplits(gradle);
    expect(out).toContain('include "arm64-v8a", "armeabi-v7a", "x86_64"');
    expect(applyAbiSplits(out)).toBe(out);
    expect(() => applyAbiSplits('nothing')).toThrow(/android/);
  });
});

describe('app.config.js', () => {
  const base = JSON.parse(readFileSync(path.join(__dirname, '../../app.json'), 'utf8')).expo as Record<string, unknown>;
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('keeps INTERNET for development builds', () => {
    delete process.env.SCANPILOT_OFFLINE;
    expect(appConfig({ config: base }).android.blockedPermissions).not.toContain('android.permission.INTERNET');
  });

  it('blocks INTERNET and sets the versionCode for CI release builds', () => {
    process.env.SCANPILOT_OFFLINE = '1';
    process.env.SCANPILOT_VERSION_CODE = '57';
    const config = appConfig({ config: base });
    expect(config.android.blockedPermissions).toContain('android.permission.INTERNET');
    expect(config.android.blockedPermissions).not.toContain('android.permission.CAMERA');
    expect(config.android.versionCode).toBe(57);
    expect(config.plugins).toContain('./plugins/withReleaseSigning');
  });
});
