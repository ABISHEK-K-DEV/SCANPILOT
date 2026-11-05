#!/usr/bin/env bash
# Installs the APK on the running emulator, runs the Maestro flows and fails
# on any app crash in logcat. Results (screenshots, JUnit, logcat) go to e2e-results/.
set -uo pipefail
APK="$1"
mkdir -p e2e-results
adb wait-for-device
adb install -r -g "$APK"            # -g grants the camera permission up front
adb logcat -c
# Let the freshly booted emulator settle and close any system dialogs first.
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true
sleep 10
status=0
maestro test .maestro/smoke.yaml --format junit --output e2e-results/report.xml || status=$?
adb logcat -d > e2e-results/logcat.txt
echo "::group::Camera used"
grep -E "ScanPilotCamera|ScanPilot live camera" e2e-results/logcat.txt | tail -20 || true
echo "::endgroup::"
if [ "$status" -ne 0 ]; then
  # Make failures readable straight from the job log.
  echo "::group::Screen text at failure"
  maestro hierarchy 2>/dev/null | grep -oE '"(text|accessibilityText)" *: *"[^"]+"' | head -60
  echo "::endgroup::"
  echo "::group::App log (errors, JS, camera)"
  grep -v -E " Maestro |CompositionEngine|UiDevice" e2e-results/logcat.txt | grep -E "ReactNativeJS|AndroidRuntime|ExpoModulesCore|ScanPilotCamera|CameraX|Camera2|app\.scanpilot" | tail -150
  echo "::endgroup::"
fi
if grep -E "FATAL EXCEPTION|ANR in app\.scanpilot" -A 30 e2e-results/logcat.txt | grep -q "app.scanpilot"; then
  echo "::error::ScanPilot crashed or stopped responding during the end-to-end test (see logcat.txt)."
  grep -E "FATAL EXCEPTION|ANR in" -A 30 e2e-results/logcat.txt | head -80
  status=1
fi
exit $status
