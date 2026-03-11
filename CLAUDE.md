# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start in development mode (electron-vite with HMR)
npm run build        # Production build → out/
npm run preview      # Preview production build
npm run lint         # ESLint
npm run test         # Vitest (unit tests)
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

Two Zustand stores in `src/store/`:

- `useSongsStore` — song list, search, CRUD via `window.api`
- `useLiveStore` — live session state (current song, section index, blackout/whiteout), drives IPC calls

### Type Duplication

`Song`, `Section`, and `TextStyle` interfaces are intentionally defined in **both** `electron/ipc/db.handlers.ts` (main process) and `src/store/songs.store.ts` (renderer process). This is expected due to Electron's process isolation — the two processes cannot share TypeScript types at runtime.

The `window.api` type declaration lives in `src/store/songs.store.ts` as a global augmentation.

### Path Alias

`@` resolves to `src/` (configured in `electron.vite.config.ts`).
