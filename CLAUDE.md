# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start in development mode (electron-vite with HMR)
npm run build        # Production build → out/
npm run preview      # Preview production build
npm run lint         # ESLint
npm run test         # Vitest (unit tests)
npx vitest run src/audio/cues.test.ts  # Run a single test file
npm run dist:win     # Package for Windows (electron-builder)
npm run dist:mac     # Package for macOS
```

## Architecture

WorshipFlow is an **Electron + React** desktop app for worship song presentation in churches. It uses `electron-vite` as the build system.

### Two Processes, Two Windows

The app has two Electron `BrowserWindow` instances:

1. **Main window** (`electron/windows/main.window.ts`) — The operator's control UI. Loads `index.html` → `src/main.tsx` → `src/App.tsx`.
2. **Live window** (`electron/windows/live.window.ts`) — A fullscreen, frameless, always-on-top presentation window. Targets an external display if found, otherwise falls back to primary. Loads `src/live/live.html` → `src/live/live.tsx` → `src/live/VideoOverlay.tsx`.

The live window is opened/closed on demand via `ipcMain.handle('live:open' / 'live:close')` in `electron/main.ts`.

### IPC Layer

All renderer↔main communication goes through `electron/preload.ts`, which exposes `window.api` via `contextBridge`. IPC channels follow the convention `namespace:action`:

- `db:*` — CRUD for songs and setlists (`electron/ipc/db.handlers.ts`)
- `live:*` — Commands forwarded from main window to live window (`electron/ipc/live.handlers.ts`)
- `system:*` — Display enumeration, file dialogs (`electron/ipc/system.handlers.ts`)

**Live display data flow:** `useLiveStore` → `window.api.showSection()` → IPC → `live.handlers.ts` → `liveWindow.webContents.send()` → `VideoOverlay.tsx` listens via `window.api.on()`

### Data Layer

SQLite via `better-sqlite3`. The singleton `getDb()` in `electron/db/database.ts` initializes from `electron/db/schema.sql` and stores the DB in Electron's `userData` path. Schema: `songs`, `setlists`, `setlist_items`, `app_settings`. The `sections` and `text_style` columns are stored as JSON strings and deserialized on read in `deserializeSong()`.

Automatic weekly backup: up to 5 backups kept in `userData/backups/`.

### Frontend State

Three Zustand stores in `src/store/`:

- `useSongsStore` — song list, search, CRUD via `window.api`
- `useLiveStore` — live session state (current song, section index, blackout/whiteout), drives IPC calls
- `useSetlistsStore` — saved setlist persistence (save/load/delete via `window.api`)

### Type Duplication

`Song`, `Section`, and `TextStyle` interfaces are intentionally defined in **both** `electron/ipc/db.handlers.ts` (main process) and `src/store/songs.store.ts` (renderer process). This is expected due to Electron's process isolation — the two processes cannot share TypeScript types at runtime.

The `window.api` type declaration lives in `src/store/songs.store.ts` as a global augmentation.

`window.api.on()` enforces a channel allowlist in `electron/preload.ts`: `live:show-section`, `live:set-video`, `live:blackout`, `live:whiteout`, `live:transition`, `live:closed`. Adding new push channels requires updating that allowlist.

### Notes on the DB

The schema includes a `songs_fts` FTS5 virtual table for full-text search, but `db:get-songs` currently uses `LIKE` queries instead. The `setlist_items` table cascades deletes from `setlists` but restricts deletes from `songs` — deleting a song that belongs to a setlist will fail at the DB level.

### Lyrics Import

`electron/ipc/lyrics.handlers.ts` handles `lyrics:fetch-url` (scrapes letras.com, genius.com, musica.com, and a generic fallback via `cheerio`) and `lyrics:fetch-ai` (stub, not yet implemented). The shared parser in `src/utils/lyricsParser.ts` converts raw text to `Section[]` using three strategies in priority order: explicit bracket headers (`[Verse 1]`), standalone keyword lines (`CORO`, `VERSO`), and repetition analysis (identical blocks ≥2 times → chorus, unique blocks → verse). The modal in `src/components/SongEditor/LyricsImportModal.tsx` provides three tabs: paste, URL, and Claude AI (stub).

The Claude AI tab reads `claudeApiKey` from `localStorage` (set in Settings → "Importar con IA" section). Implementing `lyrics:fetch-ai` in `lyrics.handlers.ts` is the remaining step to activate it.

### Audio: stems, cues y paquetes

- **Motor:** `electron/audio/engine.ts` descarga en el primer uso Python embebido + PyTorch CPU + Demucs (`demucs==4.1.0` de PyPI, publicado por el fork `adefossez/demucs`; versiones fijadas en `engine-manifest.json`) a `userData/audio-engine/`. `getDemucsCommand()` arma el comando con `HF_HOME`/`TORCH_HOME` dentro del motor (Demucs 4.1 baja los pesos vía Hugging Face) y `bin/ffmpeg` en `PATH`. Mac Intel no está soportado (PyTorch ya no publica wheels x86_64 para macOS).
- **Cola:** `SeparationQueue` (`electron/audio/queue.ts`) corre un trabajo a la vez usando `runDemucs` (`--two-stems=vocals -n htdemucs`). Stems en `userData/stems/<songId>/` (`instrumental` y `vocals`, `.wav` o `.flac`). En CPU tarda ≈2–3× la duración de la canción.
- **DB:** tabla `song_audio` (migración `user_version = 3`), con `cues` como JSON y `cues_sections_sig` para detectar cues desactualizados.
- **IPC:** `audio:*` y `pack:*`. Canales de empuje: `audio:progress`, `audio:status-changed`, `audio:engine-progress` (en la lista permitida de `preload.ts`). Los ids y nombres de pista que llegan del renderer se validan con `electron/audio/validate.ts` antes de construir rutas.
- **Renderer:** `src/audio/cues.ts` (lógica pura con pruebas), `StemPlayer` (Web Audio), `usePlaybackStore`, y `PlaybackController` montado en `App.tsx`, que llama a `useLiveStore.goToSection` al cruzar cues. La ventana live no reproduce audio.
- **Paquetes:** `.wfpack` = ZIP con `manifest.json`, `song.json`, `audio/*.flac`, `video/*`. `electron/audio/pack.ts` valida entradas (anti zip-slip) y versión del formato.
- **Pruebas:** `npx vitest run` (Node). `better-sqlite3` está compilado para Electron, así que la DB no se prueba en Vitest. `electron/audio/__fixtures__/fake-demucs.cjs` reemplaza a Demucs en las pruebas.

### Path Alias

`@` resolves to `src/` (configured in `electron.vite.config.ts`).
