# Third-party notices

ScanPilot is built on open-source software. The in-app list lives in
`src/features/licenses.ts` (Settings → Open-source licences); keep both in sync.

Run `npm run licenses:check` to audit every JavaScript package reachable from
production dependencies. The check fails on copyleft (GPL/AGPL/LGPL/MPL/SSPL…)
or unknown licences unless a package is allow-listed with a written reason in
`scripts/check-licenses.js`. Native Android/iOS libraries pulled in through
Gradle/CocoaPods are listed manually below.

| Component | Licence | Used for | Shipped in app |
| --- | --- | --- | --- |
| React, React Native | MIT | App framework | Yes |
| Expo SDK, Expo Router, expo-* modules | MIT | Native modules, navigation, build tooling | Yes |
| pdf-lib 1.17.1 | MIT | Creating/modifying PDFs (merge, split, rotate, images→PDF) | Yes |
| react-native-pdf 7.x | MIT | PDF viewer component | Yes |
| AndroidPdfViewer (zacharee fork) | Apache-2.0 | Android viewer widget used by react-native-pdf | Yes (Android) |
| PdfiumAndroidKt (`io.legere:pdfiumandroid`) | Apache-2.0 | Android PDFium bindings | Yes (Android) |
| PDFium | BSD-3-Clause / Apache-2.0 | Android PDF rendering engine | Yes (Android) |
| Gson | Apache-2.0 | JSON used by AndroidPdfViewer | Yes (Android) |
| react-native-blob-util | MIT | File access dependency of react-native-pdf | Yes |
| react-native-pdf-thumbnail 2.x | MIT | First-page thumbnails (Android PdfRenderer / iOS PDFKit) | Yes |
| react-native-document-scanner-plugin 2.0.4 | MIT | iOS VisionKit bridge (Android uses ScanPilot's own module) | Yes (iOS) |
| Google ML Kit Document Scanner (`play-services-mlkit-document-scanner` 16.0.0) | Google APIs Terms (free, closed source) | Android scanning UI, runs inside Google Play services | Yes (Android) |
| Apple VisionKit | Apple SDK | iOS scanning UI | System framework |
| jpeg-js 0.4.4 | BSD-3-Clause | JPEG decoding for manual perspective correction | Yes |
| Zustand | MIT | App state | Yes |
| Ionicons via @expo/vector-icons | MIT | Icons | Yes |
| SQLite (via expo-sqlite) | Public domain | Local metadata database | Yes |
| react-native-screens / safe-area-context / gesture-handler / reanimated / worklets | MIT | Navigation & layout primitives | Yes |
| node-forge | BSD-3-Clause (dual BSD/GPL; used under BSD) | Expo CLI dev server | No (build tool) |
| lightningcss | MPL-2.0 | Metro CSS transform | No (build tool) |

Apache-2.0 components require that their licence text and any NOTICE file be
reproduced with binary distributions. Before the first store release, generate a
full native notice bundle (e.g. Google's `oss-licenses-plugin` on Android and a
CocoaPods acknowledgements plist on iOS) and link it from the licences screen.

Planned (not yet integrated — see `docs/TECHNOLOGY.md`):

| Component | Licence | Milestone |
| --- | --- | --- |
| @react-native-ml-kit/text-recognition | MIT | 5 |
| Google ML Kit Text Recognition v2 (bundled models) | ML Kit Terms (free, closed source, on-device) | 5 |
