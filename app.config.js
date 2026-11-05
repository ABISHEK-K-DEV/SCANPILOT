/**
 * Build-time additions on top of app.json (which stays the main config):
 *  - SCANPILOT_OFFLINE=1   release builds without the INTERNET permission
 *                          (set by CI; local dev builds need it for Metro)
 *  - SCANPILOT_VERSION_CODE  Android versionCode (CI uses the run number)
 *  - release signing from the upload key, see plugins/withReleaseSigning.js
 *  - SCANPILOT_ABI_SPLITS=1  per-architecture APKs (CI; x86_64 runs the emulator tests)
 */
module.exports = ({ config }) => {
  const offline = process.env.SCANPILOT_OFFLINE === '1';
  const versionCode = Number(process.env.SCANPILOT_VERSION_CODE) || config.android?.versionCode;
  return {
    ...config,
    android: {
      ...config.android,
      ...(versionCode ? { versionCode } : {}),
      blockedPermissions: [...(config.android?.blockedPermissions ?? []), ...(offline ? ['android.permission.INTERNET'] : [])],
    },
    plugins: [...(config.plugins ?? []), './plugins/withReleaseSigning', ...(process.env.SCANPILOT_ABI_SPLITS === '1' ? ['./plugins/withAbiSplits'] : [])],
  };
};
