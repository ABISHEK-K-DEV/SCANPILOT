# Technology decisions

_Last verified: November 2026 against the npm registry and the installed package sources._

## 1. Recommended stack

| Layer | Choice | Version | Licence | Why |
| --- | --- | --- | --- | --- |
| Framework | Expo SDK (React Native, New Architecture) | SDK 58 / RN 0.88 / React 19.3 | MIT | Current stable SDK; continuous native generation via config plugins; EAS builds. |
| Language | TypeScript, `strict` | 6.0 | Apache-2.0 | Required by spec. |
| Navigation | Expo Router (file-based, bundles React Navigation) | 58 | MIT | Typed routes, deep links, web-ready. |
| Metadata DB | expo-sqlite (FTS enabled) | 58 | MIT / SQLite public domain | Local, fast queries for sort/search; FTS5 ready for OCR search. |
| Files | expo-file-system (`File` / `Directory` API) | 58 | MIT | Private app storage, atomic writes, SAF directory picker on Android. |
| Import | expo-document-picker, expo-image-picker | 58 | MIT | System pickers — no broad storage permission. Android uses the Photo Picker. |
| Image normalisation | expo-image-manipulator | 58 | MIT | Resize + JPEG re-encode (HEIC/WebP → JPEG) natively. |
| PDF create/modify | pdf-lib | 1.17.1 | MIT | Pure JS, works in RN/web/Node; merge, split, copy pages, rotate, embed JPEG/PNG, form fields. |
| PDF viewing | react-native-pdf (+ react-native-blob-util) | 7.0.5 | MIT (Apache-2.0 native deps) | Native PDFium (Android) / PDFKit (iOS), lazy page rendering, password support. |
| Thumbnails | react-native-pdf-thumbnail | 2.0.0 | MIT | Android `PdfRenderer` / iOS PDFKit, bounded output size, New Architecture. |
| State | Zustand | 5 | MIT | Tiny; settings + a library revision counter. SQLite stays the source of truth. |
| Sharing | expo-sharing | 58 | MIT | System share sheet only — nothing is uploaded by the app. |
| Tests | jest-expo, React Native Testing Library 14, poppler `pdfinfo`, pypdf | — | MIT / GPL tools used only in CI | Unit + UI smoke tests; exported PDFs verified by independent readers. |

**Not usable in Expo Go:** react-native-pdf, react-native-blob-util and
react-native-pdf-thumbnail contain custom native code. ScanPilot therefore runs
in an **Expo development build** (`expo-dev-client`), not Expo Go.

## 2. Document-scanner evaluation (Milestone 2)

| Option | Android | iOS | Maintenance | Licence / cost | Verdict |
| --- | --- | --- | --- | --- | --- |
| **react-native-document-scanner-plugin 2.0.4** | Google ML Kit Document Scanner (`play-services-mlkit-document-scanner:16.0.0`) | VisionKit `VNDocumentCameraViewController` | Active (Jan 2026), TurboModule, ships an Expo config plugin | MIT wrapper; ML Kit is free but closed source (Google APIs ToS); VisionKit is a system framework | **Recommended primary scanner.** Edge detection, auto-capture, perspective correction, crop, multi-page and retake are provided natively. On Android it needs **no CAMERA permission** (Play services owns the camera UI). |
| react-native-vision-camera 5 + OpenCV (e.g. react-native-fast-opencv) | CameraX-based | AVFoundation | Active | MIT + Apache-2.0 (OpenCV) | **Fallback** for devices without Google Play services (Huawei, some AOSP) and for a fully branded camera UI. Much more work: edge detection, stability-based auto-capture and the warp must be built ourselves. |
| expo-camera | Yes | Yes | Active | MIT | Capture only — no edge detection. Not sufficient alone. |
| Scanbot, Dynamsoft, Genius Scan, Anyline SDKs | Yes | Yes | Commercial | Paid / trial licences | **Rejected** — paid SDKs with usage limits violate the cost policy. |

Constraints of the recommended plugin to design around:
* The capture UI is the system's (ML Kit / VisionKit) and cannot be restyled.
* ML Kit Document Scanner requires Google Play services; the first use may
  download the module. Detect `missing-play-services` and offer gallery import
  (and later the VisionCamera fallback).
* Output is per-page JPEG files in the cache; ScanPilot's own crop/filter
  editor (Milestones 2–3) works on those images before PDF creation.

**Implemented (Milestone 2).** Manual perspective correction for gallery photos
uses a pure-TypeScript homography warp (`src/services/scan/warp.ts`) with
jpeg-js (BSD-3-Clause) for decoding; the warped pixels are handed to the native
image manipulator as a BMP for fast JPEG encoding. This avoids a large native
dependency (Skia/OpenCV) and is fully unit-tested.

## 3. PDF library verification

| Library | Licence | Commercial use | Notes |
| --- | --- | --- | --- |
| pdf-lib 1.17.1 | MIT | Yes; keep copyright notice | Last release 2021 but stable and widely used. Cannot render pages, cannot decrypt/re-encrypt; ScanPilot refuses to modify encrypted PDFs instead of corrupting them. Maintained fork **@cantoo/pdf-lib** (MIT, 2.x, adds encryption) is a drop-in candidate if we need password-protecting output. |
| PDF.js (pdfjs-dist 6.x) | Apache-2.0 | Yes; include licence + NOTICE | Planned only for the future **web** viewer and possibly page-image rendering in a WebView. Native viewer is faster on mobile. |
| react-native-pdf 7.x | MIT (Android deps Apache-2.0) | Yes | Native viewer. Default `trustAllCerts` is `true` for remote URLs; ScanPilot only opens local files and sets it to `false`. |
| PDFium | BSD-3 / Apache-2.0 | Yes | Used through react-native-pdf on Android. |
| MuPDF, Ghostscript, iText, PSPDFKit, Apryse | AGPL / commercial | Copyleft or paid | **Rejected** under the licensing policy. |

**Compression (Milestone 4):** pdf-lib cannot recompress embedded images. The
plan is: render/extract each page image natively, re-encode at the chosen
quality with expo-image-manipulator, and rebuild the PDF — honest for scanned
documents; for vector/text PDFs the UI will report when compression cannot help.

## 4. OCR evaluation (Milestone 5)

| Option | Offline | Hindi | Licence | Verdict |
| --- | --- | --- | --- | --- |
| **Google ML Kit Text Recognition v2** via `@react-native-ml-kit/text-recognition` (MIT) | Yes — bundled on-device models | Yes — Devanagari model | Free, closed-source SDK | **Recommended.** Fast, accurate, no network. APK grows ~4 MB per script; ship Latin + Devanagari, others optional. |
| Tesseract 5 (Apache-2.0) via a native wrapper | Yes | Yes (`hin.traineddata`) | Apache-2.0 | Fallback for de-Googled devices; RN wrappers are poorly maintained, would need our own module. |
| Cloud OCR APIs | No | — | Paid | **Rejected** — documents must never leave the device. |

OCR sits behind an `OcrProvider` interface (language packs are modules), the
text is stored in an SQLite FTS5 table for search, and searchable PDFs are
produced by drawing invisible text with pdf-lib over the page image.

## 5. Image processing (Milestone 3)

* Geometry (rotate, crop, resize) and encoding: **expo-image-manipulator** (native, MIT).
* Colour filters (grayscale, B/W threshold, contrast, brightness, saturation,
  sharpen): GPU shaders via **@shopify/react-native-skia** (MIT) — preview in
  real time, export with `makeImageSnapshot`. Non-destructive: the original
  image is kept and filter parameters stored in SQLite.
* Shadow removal / adaptive threshold: OpenCV (Apache-2.0) if Skia shaders are
  insufficient — evaluated at the start of Milestone 3.

## 6. Security (Milestone 6)

* App lock: `expo-local-authentication` (MIT) — BiometricPrompt / Face ID with device-credential fallback.
* Encrypted private folder: per-file AES-GCM with a key in `expo-secure-store`
  (Android Keystore / iOS Keychain); evaluate SQLCipher (`useSQLCipher` in the expo-sqlite plugin) for metadata.
* Release builds: remove `android.permission.INTERNET` via a config plugin so
  the shipped app physically cannot transmit documents (dev builds need it for Metro).
