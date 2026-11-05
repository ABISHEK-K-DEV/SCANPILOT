/**
 * Expo config plugin: signs Android release builds with the upload key from
 * environment variables (set by CI from GitHub secrets), falling back to the
 * template's debug key when they are absent so local and fork builds still work.
 *
 *   SCANPILOT_UPLOAD_STORE_FILE      absolute path to the .jks / .keystore
 *   SCANPILOT_UPLOAD_STORE_PASSWORD
 *   SCANPILOT_UPLOAD_KEY_ALIAS
 *   SCANPILOT_UPLOAD_KEY_PASSWORD
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (System.getenv('SCANPILOT_UPLOAD_STORE_FILE')) {
                storeFile file(System.getenv('SCANPILOT_UPLOAD_STORE_FILE'))
                storePassword System.getenv('SCANPILOT_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('SCANPILOT_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('SCANPILOT_UPLOAD_KEY_PASSWORD')
            }
        }`;

function applySigning(gradle) {
  if (gradle.includes('SCANPILOT_UPLOAD_STORE_FILE')) return gradle;
  const withConfig = gradle.replace(/signingConfigs\s*\{/, (m) => `${m}${RELEASE_CONFIG}`);
  if (withConfig === gradle) throw new Error('withReleaseSigning: signingConfigs block not found in app/build.gradle');
  const withRelease = withConfig.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
    "$1signingConfig System.getenv('SCANPILOT_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
  );
  if (withRelease === withConfig) throw new Error('withReleaseSigning: release signingConfig not found in app/build.gradle');
  return withRelease;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.applySigning = applySigning;
