/**
 * Expo config plugin (CI only, SCANPILOT_ABI_SPLITS=1): one APK per CPU
 * architecture plus a universal APK. Phones get the smaller arm64 APK; the
 * x86_64 APK runs the end-to-end tests on the Android emulator. The Play
 * Store AAB is unaffected.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const SPLITS = `
    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a", "armeabi-v7a", "x86_64"
            universalApk true
        }
    }`;

function applyAbiSplits(gradle) {
  if (gradle.includes('universalApk true')) return gradle;
  const out = gradle.replace(/\nandroid\s*\{/, (m) => `${m}${SPLITS}`);
  if (out === gradle) throw new Error('withAbiSplits: android { } block not found in app/build.gradle');
  return out;
}

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = applyAbiSplits(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.applyAbiSplits = applyAbiSplits;
