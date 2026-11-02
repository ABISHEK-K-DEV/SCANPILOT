# ScanPilot — free document scanner & PDF editor

> **Scan anything. Edit everything. Manage your documents. No subscription. No watermark.**

ScanPilot is an offline-first document scanner and PDF toolkit for Android
(primary) and iOS, built with React Native, Expo and strict TypeScript.
Documents never leave the device unless the user explicitly shares or exports them.

**Status:** Milestone 1 (foundation) complete — see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

| Doc | Contents |
| --- | --- |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Milestones, status, what's next |
| [docs/TECHNOLOGY.md](docs/TECHNOLOGY.md) | Stack, scanner/PDF/OCR library evaluation, licences |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, data model, storage layout |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | Licences of bundled software |

## What works today (Milestone 1)

* Home dashboard: hero actions, tool grid, recent documents, favourites, folders.
* Document library: grid/list views, search, favourites filter, sorting (name, date, size, recently opened), pull-to-refresh.
* Folders: create, rename, delete (documents are kept), move documents between folders.
* Import PDFs (multi-select, header validation) and convert photos to a PDF (ordered multi-select, resized & re-encoded on device).
* Native PDF viewer with page indicator, password-protected PDF support, page-count backfill.
* Document actions: share, save to device (Android folder picker), rename, favourite, move, duplicate, delete.
* Light/dark/system theme, onboarding, privacy page, open-source licences, storage usage & temp-file cleanup.
* Tested PDF engine (pdf-lib): images→PDF, merge, split, extract, rotate, reorder, delete, duplicate — UI arrives in Milestone 4.

Tools that are not built yet (scanner, merge, split, compress, OCR…) are shown
**disabled with a “Soon” badge** — no button silently does nothing.

## Requirements

| Tool | Version |
| --- | --- |
| Node.js | 22.13+ or 24.3+ (LTS recommended) |
| npm | 10+ |
| JDK | 17 (e.g. Temurin 17, or the JBR bundled with Android Studio) |
| Android Studio | Latest stable, with **Android SDK Platform 37**, **Build-Tools 37**, **NDK 27.1.12297006**, Platform-Tools |
| A real Android phone | Android 7.0+ (API 24+), USB debugging enabled |
| iOS (optional) | macOS + Xcode 26+, CocoaPods |

Set `ANDROID_HOME` (macOS: `~/Library/Android/sdk`, Linux: `~/Android/Sdk`,
Windows: `%LOCALAPPDATA%\Android\Sdk`) and add `$ANDROID_HOME/platform-tools` to `PATH`.

## Why a development build (not Expo Go)

ScanPilot uses native modules that are **not included in Expo Go**:
`react-native-pdf`, `react-native-blob-util`, `react-native-pdf-thumbnail`
(and, from Milestone 2, the ML Kit / VisionKit document scanner). You run the
app in a **development build** — your own debug APK containing these modules
plus `expo-dev-client`. JavaScript changes still hot-reload from Metro.

## Run on Android — local build

```bash
git clone https://github.com/abishek-k-dev/scanpilot.git
```

```bash
cd scanpilot
```

```bash
npm install
```

Connect your phone over USB (accept the debugging prompt) and confirm it's visible:

```bash
adb devices
```

Build, install and launch the development build (first build takes several minutes):

```bash
npx expo run:android
```

This runs `expo prebuild` (generates the git-ignored `android/` folder from
`app.json` + config plugins), compiles with Gradle, installs the APK, and starts Metro.
Afterwards, for JS-only changes just start Metro and open the installed app:

```bash
npm start
```

Rebuild natively (`npx expo run:android`) whenever you add/upgrade a native
dependency or change `app.json` plugins. To regenerate native projects from scratch:

```bash
npm run prebuild
```

Release-mode build on a device (no Metro, closer to production performance):

```bash
npx expo run:android --variant release
```

## Run on Android — cloud build with EAS (no Android Studio needed)

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest build --profile development --platform android
```

Install the APK from the link/QR code EAS prints, then:

```bash
npm start
```

`preview` produces an installable release APK; `production` produces an AAB for Google Play (see `eas.json`).

## Run on iOS (macOS)

```bash
npx expo run:ios --device
```

or in the cloud:

```bash
npx eas-cli@latest build --profile development --platform ios
```

## Quality checks

```bash
npm run verify
```

runs, in order:

| Script | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (Expo config + React Compiler rules + type-aware floating-promise checks) |
| `npm test` | Jest: PDF engine, page ranges, query builder, path/name utils, UI smoke tests |
| `npm run licenses:check` | Fails on copyleft/unknown licences in production dependencies |

Validate generated PDFs with independent readers (poppler `pdfinfo` + Python `pypdf`):

```bash
npm run test:pdf-readers
```

## Project structure

```
src/
  app/                 Expo Router screens (routes only)
    (tabs)/            Home, Files, Tools, Settings
    document/[id].tsx  PDF viewer
    folder/[id].tsx    Folder contents
  components/
    ui/                Design system (Button, Card, ActionSheet, TextPromptModal, …)
    documents/         Document grid/list, thumbnails, library browser
    pdf/               PdfViewer (native) + .web fallback
  hooks/               Data + action hooks used by screens
  services/            Business logic (no React): pdf, library, import, share, storage, thumbnails
  db/                  SQLite connection, migrations, repositories, query builder
  native/              Adapters/contracts for native capabilities (scanner, OCR)
  stores/              Zustand stores (settings, library revision)
  theme/               Tokens (colour, spacing, type) + useAppTheme
  features/            Tool registry, licence list
scripts/               Licence audit, PDF reader validation
docs/                  Technology decisions, architecture
```

## Privacy model

* Files live in the app's private storage; metadata in a local SQLite database.
* No account, no backend, no analytics or ad SDKs.
* Imports use system pickers — no broad storage permission. Android `allowBackup` is disabled.
* Permissions blocked in the manifest: camera (not needed yet), microphone, legacy storage, overlay.

## Troubleshooting

* **“Native module … not found / RNPDFPdfView not found”** — you're in Expo Go or an old build. Rebuild with `npx expo run:android`.
* **Gradle: “SDK location not found”** — set `ANDROID_HOME` or create `android/local.properties` with `sdk.dir=…`.
* **Gradle: unsupported Java version** — use JDK 17 (`java -version`); in Android Studio set Gradle JDK to 17.
* **Device not listed by `adb devices`** — enable USB debugging, accept the RSA prompt, try another cable.
* **Metro not reachable from the phone** — same Wi-Fi network, or `adb reverse tcp:8081 tcp:8081`.

## Licence

No licence has been chosen for ScanPilot's own source code yet. Third-party
components keep their own licences — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
