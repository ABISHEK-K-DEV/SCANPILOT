# Releasing ScanPilot (Android)

Every push to `main` runs **Android APK** (`.github/workflows/android-apk.yml`):
typecheck + tests → `expo prebuild` → Gradle release build → artifacts.

* Release builds are **offline**: `SCANPILOT_OFFLINE=1` removes `android.permission.INTERNET`
  (`app.config.js`). Local `npx expo run:android` builds keep it, because Metro needs it.
* `versionCode` = the workflow run number, so every upload to Play is accepted.
* Per-architecture APKs: `ScanPilot-…apk` (arm64 — almost every phone), `…-universal.apk` (any phone).
* After the build, the **e2e** job installs the x86_64 APK on an Android 14 emulator and runs
  `.maestro/smoke.yaml` (introduction → Home → a tool + guide → camera → review → save with OCR →
  Files → Settings → Licence). Any crash fails the run; screenshots and logcat are in the
  `ScanPilot-e2e-results` artifact.
* Without signing secrets the APK is signed with the public **debug** key — fine for
  sideloading and testing, **not** accepted by Google Play.

## One-time: create your upload key

**Easiest:** on your computer run `bash scripts/create-upload-key.sh`. It creates the key and — if the
GitHub CLI (`gh`) is logged in — stores the four secrets for you. Otherwise do it by hand:

Keep the keystore and passwords safe and backed up. Losing them means you cannot update the app.

```bash
keytool -genkeypair -v -storetype JKS -keystore scanpilot-upload.jks \
  -alias scanpilot -keyalg RSA -keysize 2048 -validity 10000
```

```bash
base64 -w0 scanpilot-upload.jks > scanpilot-upload.jks.base64   # macOS: base64 -i scanpilot-upload.jks
```

## One-time: add the GitHub secrets

GitHub → repository **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `SCANPILOT_UPLOAD_KEYSTORE_BASE64` | contents of `scanpilot-upload.jks.base64` |
| `SCANPILOT_UPLOAD_STORE_PASSWORD` | keystore password |
| `SCANPILOT_UPLOAD_KEY_ALIAS` | `scanpilot` (the alias above) |
| `SCANPILOT_UPLOAD_KEY_PASSWORD` | key password |

From the next push on, the run's **Artifacts** contain a signed `.apk` **and** a signed `.aab`
(the format Google Play requires). The Gradle wiring lives in `plugins/withReleaseSigning.js`.

## Publishing to Google Play

1. Create the app in the Play Console (package `app.scanpilot`) and enrol in **Play App Signing**.
2. Upload the `.aab` to an internal-testing track first; install it on 2–3 phones (include a low-end one).
3. Store listing: screenshots from `docs/screenshots/`, privacy policy from `docs/PRIVACY_POLICY.md`
   (host it on any public page, e.g. GitHub Pages), Data safety answers from that file.
4. Promote to production when testing is clean.
