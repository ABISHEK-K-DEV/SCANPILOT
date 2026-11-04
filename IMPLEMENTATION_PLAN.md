# ScanPilot implementation plan

Legend: ✅ done · 🟡 partial · ⬜ not started

## Milestone 1 — Foundation ✅

| Item | Status | Notes |
| --- | --- | --- |
| Expo SDK 58 project, strict TS, ESLint, Jest | ✅ | React Compiler on; type-aware no-floating-promises |
| Navigation (Expo Router: tabs + stack, onboarding guard) | ✅ | `Stack.Protected` gates onboarding |
| Design system (tokens, light/dark, accessible components) | ✅ | 48dp touch targets, labels on icon buttons, font scaling capped at 1.6× |
| Splash + onboarding | ✅ | Native splash held until DB ready; branded icon set |
| Home dashboard | ✅ | Hero, tools, recent, favourites, folders, search entry |
| Local library (SQLite + private files) | ✅ | Relative paths, migrations, atomic writes, temp cleanup |
| Grid/list, search, favourites, sort (name/date/size/opened) | ✅ | Persisted preferences |
| Folders (create/rename/delete/move) | ✅ | Deleting a folder keeps its documents |
| Import PDF / images → PDF | ✅ | Header validation; photos resized & JPEG-encoded natively |
| PDF viewer | ✅ | react-native-pdf; password prompt; page indicator |
| Rename / duplicate / delete / share / save to device | ✅ | Save to device = Android SAF folder picker; iOS via share sheet |
| PDF engine + tests | ✅ | images→PDF, merge, split, extract, rotate, reorder, delete, duplicate, page plans |
| Settings, privacy page, licences, storage usage | ✅ | App lock / private folder shown as "Soon" |

**Verification performed in CI-like sandbox:** typecheck, lint, 42 Jest tests,
independent PDF validation (poppler + pypdf), Metro export for Android & iOS,
`expo prebuild` manifest inspection, expo-doctor (18/20 — the 2 failures need network access to exp.host).
**Not yet performed:** a Gradle build and run on a physical Android device
(no Android SDK in the sandbox). Do this first — see the checklist below.

### Device test checklist (Milestone 1)

- [ ] Fresh install → splash → onboarding → home
- [ ] Import single PDF → opens in viewer; thumbnail + page count appear in library
- [ ] Import several PDFs incl. a non-PDF renamed to `.pdf` → partial-failure message
- [ ] Import a password-protected PDF → password prompt; wrong password → retry message
- [ ] Images → PDF with 1 and 10 photos (incl. HEIC on iOS) → page order matches selection
- [ ] Cancel during a long image import → nothing half-created in the library
- [ ] Rename (incl. duplicate name, invalid chars), duplicate, favourite, move, delete
- [ ] Folder create / rename / delete; documents survive folder deletion
- [ ] Sort by each option; grid ↔ list; search incl. `%` and `_`
- [ ] Share to another app; Save to device into Downloads; open result in an independent reader (Google Drive PDF viewer, Adobe Reader)
- [ ] Dark mode, large font size, TalkBack pass
- [ ] Airplane mode: everything above still works
- [ ] 200+ page / 100 MB PDF: opens, scrolls, page count backfilled

## Milestone 2 — Scanner ✅

| Item | Status | Notes |
| --- | --- | --- |
| Native scanner behind `src/native/scanner` | ✅ | ML Kit Document Scanner (Android, full mode) / VisionKit (iOS) via react-native-document-scanner-plugin; lazy-loaded, typed `DocumentScanner` contract |
| Live preview, edge detection, auto-capture, flash, perspective correction, multi-page, retake inside the scanner | ✅ | Provided by ML Kit / VisionKit system UI (not restylable) |
| No Android CAMERA permission | ✅ | Verified in the prebuilt manifest; iOS gets `NSCameraUsageDescription` |
| Fallback when scanner unavailable (no Play services / not linked) | ✅ | Friendly message + "Choose photos" |
| Review screen (multi-page preview) | ✅ | Large preview, thumbnail strip, rotate left/right, crop, retake page, delete (confirm), move earlier/later, add pages (scan more / photos), rename, unsaved-changes guard |
| Manual corner adjustment + perspective correction | ✅ | 4-handle editor; axis-aligned crops use native crop, other quads use a JS homography warp (jpeg-js decode → bilinear warp → BMP → native JPEG). ~0.4 s for a 2.8 MP page in V8; expect a few × slower on Hermes |
| Gallery import into a scan | ✅ | Photos are normalised (EXIF, ≤2480 px) and can be corner-corrected |
| Document types | ✅ | Original, A4, Letter, Receipt (80 mm), Business card, ID card (ID-1), Book/notes |
| Non-destructive within a session | ✅ | Each edit writes a new file; "Original" restores the capture; orphaned files deleted immediately; session dir wiped on save/discard/cold start |
| Tests | ✅ | Geometry, homography, warp, BMP, session reducer, PDF presets, review-screen & scan-entry UI tests |

**Not verified yet:** running the scanner on a real device (no Android SDK in the sandbox). Device checklist:

- [ ] Home → Scan document opens ML Kit; capture 3 pages incl. auto-capture → review screen shows 3 pages
- [ ] Retake page 2 → replaced in place; Rotate, Delete, Move work; Add pages → scan more & from photos
- [ ] Crop a skewed gallery photo → straightened page; "Original" restores it
- [ ] Each document type → PDF page size correct in an external reader (e.g. receipt is 80 mm wide)
- [ ] Back with unsaved pages → discard prompt; cancel scanner → no session left behind
- [ ] Device without Play services (or emulator without) → fallback dialog
- [ ] iOS: VisionKit flow and camera permission prompt text

### Deferred to later milestones
* Persisting original page images with the saved PDF for re-editing after save (Milestone 3, together with the filter edit stack).
* Automatic edge detection for *gallery* photos (ML Kit does it for camera scans) — OpenCV/VisionCamera fallback, Milestone 6 polish.
* Drag-and-drop page reordering (arrows used now; drag lands with the Milestone 4 page organiser).

## Milestone 5 — Everyday PDF toolkit, editing, OCR ✅

21 tools, grouped Scan & create · Organise · Edit & sign · Convert · Optimise · Security:

| Tool | Status | How it works |
| --- | --- | --- |
| Sign PDF | ✅ Android | Draw on a pad, saved signatures (on device), place/move/resize, date & text; vector ink in the PDF |
| Edit PDF | ✅ Android | Pen, highlighter, text, box, circle, arrow, line, whiteout, image, signature; undo/redo; colours & widths |
| Redact PDF | ✅ Android | Boxes are burned into pixels and redacted pages rebuilt from the image — hidden text is truly removed |
| Watermark | ✅ | Diagonal/centre/tiled text, colour, transparency (Latin characters) |
| Page numbers | ✅ | 6 positions, 4 styles, skip cover; correct on rotated pages (verified by rendering) |
| Protect / Unlock | ✅ | AES-256 password with print/copy permissions; unlock with the known password |
| Crop PDF | ✅ | Drag edges on a preview; all pages or first page |
| Rotate PDF | ✅ | All pages 90°/180°; per-page via Organise |
| Repair PDF | ✅ | Rebuilds structure by copying readable pages |
| Extract text (OCR) | ✅ Android | ML Kit on-device, English and Hindi (+English); copy, .txt, search within, searchable PDF; text indexed for library search |
| PDF to Word | ✅ Android | OCR text → .docx (layout/images not reproduced, stated in UI) |
| PDF to JPG | ✅ Android | 150/220/300 dpi; save all to a folder or share as ZIP |
| JPG to PDF, Text to PDF | ✅ | Text to PDF uses the system print engine, so any script renders |
| Print | ✅ | From every document's menu |

Security: App lock (fingerprint/face/PIN, re-locks after 30 s in background) and a Locked folder (documents hidden from Home/Files/search until unlocked). Honest note: documents are protected by Android's app sandbox and file-based encryption; the locked folder adds an access gate, not an extra cipher.

Not offline-feasible and therefore not offered: Word/Excel/PowerPoint → PDF and layout-preserving PDF → Office conversions (they need a full office engine or a cloud service, which would break the privacy promise).

## Design system refresh ✅
Professional visual overhaul across every screen, driven from shared tokens and components so no screen drifts:
- **Tokens** (`src/theme/tokens.ts`): neutral slate palette with one indigo accent, a dark "ink" hero surface, restrained category accents, layered elevation, and the **Inter** typeface (400/500/600/700, one family per weight so Android never fakes bold; `AppText` maps `fontWeight` overrides to the right face).
- **Icons**: one consistent line-icon family (Lucide, ISC) behind `Icon` — per-icon imports keep the bundle small; the `IconName` type makes any unmapped name a compile error.
- **Start-up**: native splash hands over to an animated `BootScreen` (mark with sweeping scan beam + slim progress bar) while the library opens.
- **Loading**: `ProgressOverlay` rebuilt as a compact dialog with an animated `ProgressRing` (percentage or spinning arc) and a full-width Cancel; `LoadingState` uses the same ring.
- **Onboarding**: swipeable three-step introduction with illustrated scenes, animated dots and Continue → Get started.
- **Home**: ink scanner hero, Import PDF / JPG to PDF cards, 4-column quick tools; Tools tab is a two-column card grid; Settings opens with a library summary; tab bar uses a pill indicator.
- **Scan review**: labelled toolbar tiles, dashed "Add" page tile, sticky Add + Save bar.
- **Licence**: ScanPilot is MIT-licensed (`LICENSE`, `package.json`). Settings → Licence shows the MIT summary (permissions / conditions / limitations) and full text; third-party acknowledgements are collapsed beneath it (their notices must still be shipped).
- **App icon / splash / favicon** regenerated from the same vector mark: `node scripts/brand/render-icons.mjs`.

## ScanPilot camera & redesigned review ✅
The capture screens are now ScanPilot's own — Google's scanner UI (its add-page icon, Enhance/Filters/Crop bar) no longer appears by default.
- **Camera** (`src/app/scan/camera.tsx`, expo-camera behind `src/native/camera`): frame guide, flash off/auto/on, grid, gallery import, batch capture with a live page stack and count, *Done* → review. Permission screen with *Open settings* and *Choose photos instead*. Modes: new, append, replace (Retake) and return (tools await pages through `services/scan/cameraBridge.ts`).
- **Edge detection on the phone** (`services/scan/detect.ts`, pure + Jest tests): Otsu threshold → largest bright region → extreme-point corners, with confidence/coverage checks; `autoCropPage` perspective-corrects with the existing warp, then *Auto enhance* is applied. The untouched photo stays as the page original.
- **Review**: page strip with a dashed *Add page* tile, then three tabs — **Edit** (rotate, crop, retake, delete), **Filter** (live thumbnail previews of every filter + *Apply to all*), **Page size** (presets); bottom bar *Scan more* + *Save PDF*.
- **Settings → Scanning → Scanner**: ScanPilot camera (default) or the system scanner (Google ML Kit / Apple VisionKit).
- Adds the `CAMERA` permission (camera only — microphone and barcode scanning are disabled in the `expo-camera` plugin).
- Repository works on a single **`main`** branch; the APK workflow builds on every push to `main` (and on demand).

## Camera & import everywhere, document toolbar ✅
Found on a real device: most tools could only pick from the library, the introduction collapsed when reopened from Settings, and Google's scanner showed its own filter UI.
- **`useDocumentSources`** (camera scan → PDF, import PDF, photos → PDF) without leaving the screen. Used by the document picker (`DocumentSelectModal`: Scan / Import PDF / Photos tiles; new documents are selected straight away) and by **`ChooseDocumentCard`**, the empty state of every tool (Sign, Edit, Redact, Split, Compress, Organise, OCR, PDF to JPG, Merge, Watermark, Page numbers, Protect, Unlock, Repair, Rotate, Crop).
- **Files & folders**: floating **Scan** button; empty library/folder shows Scan / Import PDF / Photos.
- **Document viewer**: bottom toolbar — **Add pages** (scan or photos appended as a new copy; or Merge with another PDF), Sign, Edit, Compress, More.
- **Scanner**: ML Kit now runs in `SCANNER_MODE_BASE` (camera + crop only). Enhancement and filters happen in ScanPilot's own review screen; camera pages start with *Auto enhance* (Filter → Original restores the capture). Google's camera screen itself is drawn by Play services and cannot be restyled.
- **Introduction**: the pager is measured and each slide gets an explicit size (a horizontal ScrollView gives pages no height on Android), and the illustration scales down on short screens.

## Milestone 3 — Filters & enhancement ✅
Scan review → Filter: Original, Auto enhance, Document (shadow & colour-cast removal), Grayscale, Black & white (adaptive threshold), High contrast, Photo; apply to one or all pages; switching filters never stacks (each page keeps its pre-filter image).

## Next
- iOS parity for native-only tools (PDFKit renderer + Vision OCR).
- Drag-and-drop page reordering; Hindi/Unicode text in watermark & annotations (bundle a Noto font via fontkit).

Colour modes (original, auto, grayscale, B/W, high contrast, clarity, photo), brightness/contrast/sharpness/saturation/exposure, strength slider, before/after, non-destructive edit stack stored in SQLite, export quality.

## Milestone 4 — PDF toolkit ✅

| Tool | Status | Notes |
| --- | --- | --- |
| Merge | ✅ | Pick from library (multi-select, search) or import, reorder, remove, name output, progress + cancel, Open/Share result. Originals kept |
| Split | ✅ | By ranges (`1-3, 4-6, 7-` → one PDF each), extract pages (one PDF), every page separately; live validation & preview of the files that will be created |
| Compress | ✅ Android | Low/Medium/High (200/150/110 dpi). Estimated size per level measured from sample pages; actual size shown after; nothing saved if the result would not be smaller. Pages are re-rendered as images (stated in the UI). iOS: shown as "Soon" until a PDFKit renderer is added |
| Organise pages | ✅ | Thumbnail grid; select pages; rotate left/right, move earlier/later, duplicate, delete (never all pages), extract to new PDF; save as copy or replace original (confirm); unsaved-changes guard |
| Rotate | ✅ | Individual or multiple pages, clockwise/anticlockwise (organiser) |
| Entry points | ✅ | Home tiles, Tools tab, and every document's ⋮ menu |

Drag-and-drop reordering is deferred: move earlier/later buttons are used for reliability and accessibility.

### Android scanner fix (found on a real device)
`react-native-document-scanner-plugin` crashed on Android with
`NullPointerException in HostFunction` (it casts `ReactContext.getCurrentActivity()`,
which is null under React Native 0.88 bridgeless mode). Android now uses ScanPilot's
own Expo module `modules/scanpilot-native` (ML Kit via `startIntentSenderForResult`
+ `OnActivityResult`), which also provides `PdfRenderer` page rendering at any DPI.
The plugin is excluded from Android autolinking (`react-native.config.js`) and kept for iOS.

### Device checklist (Milestone 4)
- [ ] Scan document opens ML Kit (no NPE); first run may download the scanner module
- [ ] Merge 3 PDFs in a custom order → page order correct in an external reader
- [ ] Split `1-2, 3-` and Extract `2, 4` → correct pages; Every page on a 20-page PDF
- [ ] Compress a scanned 10+ page PDF at each level → estimate close to actual; readable
- [ ] Organise: rotate, delete, duplicate, reorder, extract; Save as copy and Replace; thumbnails update
- [ ] Share and Save to device for results; password-protected PDF gives a clear error in every tool

## Milestone 5 — Advanced editing & OCR ⬜
Annotation overlay (text, highlight, underline, strike-through, pen, shapes, date, images), signatures (draw/save), AcroForm filling (pdf-lib), offline OCR (ML Kit Latin + Devanagari) with progress, FTS search, searchable PDF (invisible text layer). Always saves an edited copy.

## Milestone 6 — Security & polish ⬜
App lock + biometrics, encrypted private folder, remove INTERNET permission from release builds, performance pass on low-RAM devices, full regression suite, native licence notices.

## Screenshots

`npm run screenshots` renders every screen from a demo web build (in-memory sample data, see `metro.config.js` / `src/demo/`) and writes `docs/screenshots/*.png` plus `overview.png`.

## Known limitations / decisions

* pdf-lib cannot modify encrypted PDFs → refused with a clear message (never silently corrupted).
* Very large PDFs (> 40 MB) show "— pages" until first opened (page count comes from the native renderer).
* Images→PDF keeps all page images in memory during creation; for very large batches (≫ 50 photos) a streaming writer may be needed (revisit in Milestone 2).
* PDF links are not opened automatically (privacy); a confirm-to-open flow can be added.
