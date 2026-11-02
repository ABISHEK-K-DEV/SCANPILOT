# Architecture

```
┌──────────────────────────── src/app (Expo Router screens) ────────────────────────────┐
│ (tabs)/index · library · tools · settings │ document/[id] · folder/[id] · folders ·   │
│ onboarding · privacy · licenses                                                        │
└───────────────┬───────────────────────────────────────────────┬───────────────────────┘
                │ hooks/ (useDocuments, useImportActions,        │ components/
                │ useDocumentActions, useAsyncQuery)             │  ui/ (design system)
                ▼                                                │  documents/ · pdf/ · brand/
┌──────────────────────────── services/ (no React) ─────────────────────────────────────┐
│ library/   documentService, folderService  — orchestrate files + metadata            │
│ import/    importService                   — pickers → normalise → library           │
│ pdf/       pdfService (pdf-lib, pure bytes) — create/merge/split/rotate/plan          │
│ thumbnails/ thumbnailService               — native first-page JPEGs                  │
│ share/     shareService                    — share sheet, Save to device (SAF)        │
│ storage/   paths, fileStore                — private dirs, atomic writes, temp cleanup│
└───────────────┬───────────────────────────────────────────────┬───────────────────────┘
                ▼                                               ▼
┌──────── db/ (expo-sqlite) ────────┐               ┌──── native/ (adapters) ─────────┐
│ migrations (PRAGMA user_version)  │               │ scanner/ contract (M2)          │
│ documents · folders · settings    │               │ ocr/ (M5)                       │
└───────────────────────────────────┘               └─────────────────────────────────┘
```

## Principles

1. **SQLite is the source of truth** for metadata; files live in private app
   storage. UI never touches the file system directly.
2. **Pure PDF core.** `services/pdf` takes and returns `Uint8Array`, so it runs
   unchanged in React Native, on the web, and in Jest.
3. **Native code behind adapters.** Screens import `services/*` or
   `native/*` interfaces, never a native SDK, so Expo Go / web degrade gracefully
   and implementations can be swapped (ML Kit ↔ VisionCamera, ML Kit OCR ↔ Tesseract).
4. **Never destroy originals.** Edits write new files atomically
   (temp file → move); encrypted PDFs are refused for modification.
5. **Reactive without duplication.** Mutations call `notifyLibraryChanged()`,
   which bumps a revision; mounted queries re-run against SQLite.

## Data model (schema v1)

| Table | Columns |
| --- | --- |
| `documents` | id, name, kind, source, **file_path** (relative), **thumbnail_path** (relative), page_count (nullable for huge files until viewed), size_bytes, folder_id → folders, is_favorite, created_at, updated_at, last_opened_at |
| `folders` | id, name, created_at, updated_at |
| `settings` | key, value (JSON) |

Paths are stored **relative to the library root** because the absolute
container path changes across app updates on iOS.

## Storage layout

```
<documentDirectory>/ScanPilot/
  documents/<uuid>.pdf
  thumbnails/<uuid>-<version>.jpg
<cacheDirectory>/scanpilot-tmp/     ← wiped on every cold start
```

## Performance notes

* Library lists use virtualised `FlatList`s; thumbnails are ~420×560 JPEGs.
* Page counts are read with pdf-lib only for files ≤ 40 MB; larger files get
  their count from the native viewer on first open.
* The viewer renders pages lazily natively; full-resolution pages are never
  decoded in JS.
* Long operations report progress and accept a `CancelToken` checked between pages.
