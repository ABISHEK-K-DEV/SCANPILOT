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

## Milestone 2 — Scanner ⬜ (next)

1. Add `react-native-document-scanner-plugin` (+ its Expo config plugin) behind `src/native/scanner` (`DocumentScanner` contract already defined).
2. Availability check (Play services / iOS version) with graceful fallback to gallery import.
3. Scan flow: launch ML Kit / VisionKit (edge detection, auto-capture, perspective correction, crop are native) → **Review screen**: page thumbnails, reorder (drag), rotate, delete, retake, add more pages.
4. Manual corner adjustment for pages re-opened later: crop editor with 4 draggable handles (Reanimated + Gesture Handler) and perspective warp (native module or Skia).
5. Document type presets (A4, receipt, card, ID, book) affecting output page size.
6. Create PDF via `imagesToPdf`; keep original page images for non-destructive re-editing.
7. Tests: scanner adapter mocks, review-screen reducer, page ordering.

## Milestone 3 — Filters & enhancement ⬜
Colour modes (original, auto, grayscale, B/W, high contrast, clarity, photo), brightness/contrast/sharpness/saturation/exposure, strength slider, before/after, non-destructive edit stack stored in SQLite, export quality.

## Milestone 4 — PDF toolkit UI ⬜
Merge (pick, preview, order, name), split (all pages / ranges / selection), page organiser (thumbnail grid: drag-reorder, rotate, delete, duplicate, extract), compress (low/medium/high, estimated vs actual size), rotate. Engine already implemented and tested.

## Milestone 5 — Advanced editing & OCR ⬜
Annotation overlay (text, highlight, underline, strike-through, pen, shapes, date, images), signatures (draw/save), AcroForm filling (pdf-lib), offline OCR (ML Kit Latin + Devanagari) with progress, FTS search, searchable PDF (invisible text layer). Always saves an edited copy.

## Milestone 6 — Security & polish ⬜
App lock + biometrics, encrypted private folder, remove INTERNET permission from release builds, performance pass on low-RAM devices, full regression suite, native licence notices.

## Known limitations / decisions

* pdf-lib cannot modify encrypted PDFs → refused with a clear message (never silently corrupted).
* Very large PDFs (> 40 MB) show "— pages" until first opened (page count comes from the native renderer).
* Images→PDF keeps all page images in memory during creation; for very large batches (≫ 50 photos) a streaming writer may be needed (revisit in Milestone 2).
* PDF links are not opened automatically (privacy); a confirm-to-open flow can be added.
