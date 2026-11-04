// The Android side of react-native-document-scanner-plugin crashed with a
// NullPointerException under React Native 0.88 (bridgeless mode returns no
// activity from ReactContext.getCurrentActivity()). Android scanning now uses
// ScanPilot's own module (modules/scanpilot-native); the plugin stays for iOS.
module.exports = {
  dependencies: {
    'react-native-document-scanner-plugin': {
      platforms: { android: null },
    },
  },
};
