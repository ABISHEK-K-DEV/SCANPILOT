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

## Milestone 3 — Filters & enhancement ⬜ (next)
Colour modes (original, auto, grayscale, B/W, high contrast, clarity, photo), brightness/contrast/sharpness/saturation/exposure, strength slider, before/after, non-destructive edit stack stored in SQLite, export quality.

## Milestone 4 — PDF toolkit UI ⬜
Merge (pick, preview, order, name), split (all pages / ranges / selection), page organiser (thumbnail grid: drag-reorder, rotate, delete, duplicate, extract), compress (low/medium/high, estimated vs actual size), rotate. Engine already implemented and tested.

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
