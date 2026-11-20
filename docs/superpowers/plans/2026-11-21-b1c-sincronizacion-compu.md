# B1c — Sincronización en la compu: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ALADO de escritorio se vincula a la nube y se sincroniza solo: al abrir, cada pocos minutos y bajo demanda. Muestra el estado y avisa si falla. Lo editado en la compu sube y lo aprobado en la nube baja. Nada cambia a media proyección.

**Architecture:**
- **Comparar contra una foto.** En lugar de enganchar cada ruta de escritura (editor, `.alado`, `.wfpack`, carpetas), la compu guarda una **foto** de lo último que coincidió con la nube (`sync_snapshot`). En cada ciclo compara la DB local contra la foto: lo distinto se sube, y lo que llega de la nube se aplica sobre los campos que no se editaron localmente.
- **Identificadores globales.** Triggers de SQLite dan un `uid` a toda fila nueva de `songs`, `setlists` y `folders`.
- **Pruebas sin Electron.** El motor recibe una interfaz `LocalDb` (subconjunto común de `better-sqlite3` y `node:sqlite`) y una función `api(path, body)`. En las pruebas, `api` llama directo al `route()` de la nube sobre `node:sqlite`, así que escritorio y nube se prueban juntos en Node.

**Tech Stack:** Electron main process, better-sqlite3, `safeStorage` de Electron para el token, Vitest + `node:sqlite`.

**Spec:** `docs/superpowers/specs/2026-11-19-fase-b-alado-conectado-design.md` (secciones 2 "Primera vez" y "Vincular otra compu", 3, 6). Es la parte B1c: B1a ✅ → B1b ✅ → **B1c** → B1d.

## Global Constraints

- La app debe funcionar completa sin internet y sin cuenta. Sincronizar nunca bloquea abrir la app.
- Sincroniza al abrir, cada **3 min** (bajar y subir) y cada **60 s** solo sube si hay cambios locales. También con "Sincronizar ahora".
- **Durante la proyección** (ventana live abierta) solo se sube; lo que llega se retiene y se aplica al cerrar la proyección o con "Actualizar".
  - **Ruling de planeación:** se retiene **todo** lo entrante, no solo el servicio en curso. Es más simple y seguro, y el costo son unos minutos de atraso mientras se proyecta.
- El video viaja por **nombre de archivo**. Al bajar, se usa `userData/videos/<nombre>` aunque falte el archivo, para no perder el nombre en la siguiente subida.
- Token del dispositivo cifrado con `safeStorage` cuando esté disponible, en `app_settings.sync_token`.
- URL de la nube: `https://alado.mj-cristhian.workers.dev`, en `electron/sync/config.ts`.
- Diálogos nativos prohibidos en el renderer.

## Review Focus

1. **Cambio local y cambio remoto del mismo campo antes de sincronizar:** gana el último en llegar a la nube. La compu sube su campo editado y la nube avisa al otro autor; nunca se pierde en silencio. → prueba en Task 3.
2. **Se borra en la compu una canción que en la nube está en un servicio:** la nube rechaza con `song-in-use` y la canción se **restaura** localmente desde la foto, con aviso. → prueba en Task 3.
3. **Sin internet al abrir:** estado `error` con la hora del último éxito; la app sigue funcionando. → prueba en Task 3.
4. **Llegan cambios mientras se proyecta:** no se aplican hasta cerrar la proyección. → prueba en Task 3.
5. **Vincular una segunda compu con canciones de mismo título y distinta letra:** gana la nube, la local se respalda en un archivo y aparece en el resumen. → prueba en Task 2.

---

### Task 1: Migración v6 (uid, triggers, foto) y vista local normalizada

**Files:**
- Create: `electron/sync/localDb.ts`
  - `interface LocalDb { prepare(sql): { all(...p), get(...p), run(...p) }; exec(sql) }`
  - `inTransaction(db, fn)` con `BEGIN`/`COMMIT`/`ROLLBACK`.
- Create: `electron/sync/schema.ts`
  - `migrateV6(db: LocalDb)`: agrega `uid TEXT` a `songs`, `setlists` y `folders`, los llena con `lower(hex(randomblob(16)))`, crea índices únicos y los triggers `AFTER INSERT` que asignan `uid` si es NULL.
  - Crea la tabla `sync_snapshot(kind TEXT, uid TEXT, data TEXT, versions TEXT, seq INTEGER, PRIMARY KEY(kind, uid))`.
  - Exporta `BASE_SCHEMA_FOR_TESTS`: el `SCHEMA` de `database.ts` más las migraciones 2–5, como SQL plano para `node:sqlite`.
- Modify: `electron/db/database.ts` (`version < 6` → `migrateV6(database)` + `user_version = 6`)
- Create: `electron/sync/localView.ts`
  - `readLocal(db): { songs: Map<uid, SongFields>, setlists: Map<uid, SetlistData>, folders: Map<uid, string> }`. Mapea `video_path` → nombre de archivo, `folder_id` → `folder_uid`, `text_style` y `sheet_style` JSON, y `artist` vacío → null.
- Test: `electron/sync/localView.test.ts` (sobre `node:sqlite` con `BASE_SCHEMA_FOR_TESTS` + `migrateV6`)

- [ ] **Step 1: Pruebas que fallan.**
  - `existing rows get a uid and new inserts get one too`;
  - `readLocal maps video_path to file name and folder_id to folder uid`;
  - `setlist items keep order and custom video file names`;
  - `migrateV6 is idempotent`.
- [ ] **Step 2:** Ver que fallan.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(sync): uid columns, snapshot table and local view`.

### Task 2: Escritura local desde la nube y vinculación

**Files:**
- Create: `electron/sync/applyRemote.ts`
  - `applyRemote(db, pulled: PullResponse, opts: { videosDir: string }) → { changedSongs: number; changedSetlists: number; restoredLocalEdits: string[] }`.
  - Por cada fila entrante:
    - si la fila local difiere de su foto, los **campos editados localmente se conservan** y los demás se reemplazan;
    - si no, se reemplaza todo;
    - borrados: si una canción está en un servicio local, no se borra y se quita de la foto para que se vuelva a subir;
    - al final, la foto queda con los datos y versiones de la nube.
- Create: `electron/sync/link.ts`
  - `adoptOnLink(db, pulled, opts: { backupDir }) → { adopted, replaced: { title, backupFile }[], uploaded }`.
  - Empata por título normalizado (`normalizeTitle` de `electron/setlist/aladoFile.ts`):
    - **iguales** → la canción local toma el uid de la nube;
    - **distintas** → gana la nube y la local se escribe completa en `backups/vinculacion-<fecha>.json`;
    - **solo locales** → quedan sin foto, así que el siguiente ciclo las sube.
  - **Ruling de planeación:** sin elegir canción por canción. El resumen lista las reemplazadas y su respaldo. Elegir una por una queda para después, porque vincular una segunda compu es raro y la copia queda respaldada.
- Test: `electron/sync/applyRemote.test.ts`, `electron/sync/link.test.ts`

- [ ] **Step 1: Pruebas que fallan.**
  - `incoming song is inserted with video path in videosDir`;
  - `incoming change keeps a locally edited field and replaces the rest`;
  - `incoming setlist maps song uids to local ids in order`;
  - `remote delete of a song used by a local setlist keeps it and clears its snapshot`;
  - `link: same title same lyrics adopts the cloud uid`;
  - `link: same title different lyrics → cloud wins and local copy is backed up`.
- [ ] **Step 2:** Ver que fallan.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(sync): apply cloud rows locally and adopt on link`.

### Task 3: Motor de sincronización contra la nube real (en memoria)

**Files:**
- Create: `electron/sync/diff.ts`
  - `localChanges(local, snapshot) → Change[]`. El orden es: carpetas, canciones nuevas o cambiadas, servicios, borrados de servicios y luego de canciones.
  - Canciones: solo los campos distintos, con `seen` = versiones de la foto. Si la canción es nueva, todos los campos con `seen: {}`.
- Create: `electron/sync/engine.ts`
  - `class SyncEngine`, construida con `{ db, api, videosDir, backupDir, isLive: () => boolean, now }`.
  - Métodos:
    - `run({ force?: boolean }): Promise<SyncStatus>`. Pasos: pull → aplicar, o retener si se proyecta y no se forzó → push → pull de nuevo para fijar versiones.
    - `pushOnly()`.
    - `status`.
  - Mientras `isLive()`, lo entrante se guarda en `pendingPull` sin aplicarse. Con `force` o fuera de proyección, se aplica.
  - Un `song-delete` rechazado con `song-in-use` reinserta la canción desde la foto y agrega el aviso *"«{título}» no se borró: está en un servicio de la nube."*
  - El `seq` se guarda en `app_settings.sync_seq` y el último éxito en `sync_last_ok`.
- `type SyncStatus = { state: 'off' | 'syncing' | 'ok' | 'error' | 'held'; lastOk: string | null; error: string | null; notices: string[]; held: boolean }`
- Test: `electron/sync/engine.test.ts`
  - Una "nube" en memoria con `route()` de `cloud/src/router.ts` sobre `sqliteDb()`.
  - Dos compus en `node:sqlite`, más una sesión de Líder llamando a la API directo, que hace de celular.

- [ ] **Step 1: Pruebas que fallan.**
  - `first sync uploads the whole catalog`;
  - `a change on the phone reaches the computer`;
  - `a change on the computer reaches the phone`;
  - `same field edited on both: last arrival wins and the computer gets the notice`;
  - `deleting locally a song used by a cloud setlist restores it with a notice`;
  - `offline: state error, lastOk kept, local data intact`;
  - `while live, incoming changes are held until run({ force }) or live ends`.
- [ ] **Step 2:** Ver que fallan.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(sync): desktop sync engine`.

### Task 4: IPC, temporizadores y token

**Files:**
- Create: `electron/sync/config.ts` (`CLOUD_URL`)
- Create: `electron/sync/service.ts`
  - Instancia única: `startSync(getMainWindow, isLive)`.
  - Al arrancar, si hay token, corre `run()` sin bloquear.
  - Temporizadores de 60 s y de 3 min.
  - Cada vez que cambia el estado, empuja `sync:status`. Si se aplicó algo, empuja `sync:applied`.
  - Al cerrar la proyección, `run()`.
  - El token se cifra con `safeStorage`.
- Create: `electron/ipc/sync.handlers.ts`, con estos canales:

  | Canal | Qué hace |
  |---|---|
  | `sync:get-status` | devuelve el estado |
  | `sync:run` | `run({ force: true })` |
  | `sync:setup` | `{ churchName, leaderName, pin, setupKey }` → `/api/setup` y luego primer `run`; devuelve `{ churchCode, recoveryCode }` |
  | `sync:link` | `{ code }` → `/api/link`, luego `adoptOnLink` y `run`; devuelve el resumen |
  | `sync:unlink` | borra el token, la foto y el `seq` |
  | `sync:info` | `{ linked, churchName, lastOk }` |
- Modify: `electron/main.ts` (registrar y llamar a `startSync` cuando la ventana esté lista); `electron/ipc/live.handlers.ts` (`isLiveOpen()`)
- Modify: `electron/preload.ts`: métodos más los canales `sync:status` y `sync:applied` en la lista permitida. Tipos en `src/store/songs.store.ts`.
- Test: `electron/sync/service.test.ts`, con temporizadores falsos de Vitest y `api` y `db` inyectados. Casos:
  - `runs at start when linked and not when unlinked`;
  - `pushes every 60 s and full sync every 3 min`.

- [ ] **Step 1:** Pruebas que fallan.
- [ ] **Step 2:** Ver que fallan.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS. Correr `npx tsc --noEmit -p tsconfig.json`.
- [ ] **Step 5:** Commit `feat(sync): sync service, IPC and timers`.

### Task 5: Interfaz en la compu

**Files:**
- Create: `src/store/sync.store.ts` (estado desde `sync:status`; `sync:applied` → recargar canciones, carpetas y servicios con las funciones existentes de los stores)
- Create: `src/components/SyncIndicator.tsx`, en la barra lateral de `App.tsx`:
  - ✅ *"Sincronizado hace N min"*;
  - 🔄 *"Sincronizando…"*;
  - ⚠️ *"Sin sincronizar · último: sáb 8:40 p.m."* con **Reintentar**;
  - ⏸ *"Cambios nuevos en espera"* con **Actualizar**, mientras se proyecta.
  - Los avisos de la nube se muestran como toasts.
  - Si no está vinculada, no muestra nada.
- Create: `src/pages/Settings/CloudSection.tsx`, sección "ALADO conectado" en Configuración:
  - **Sin vincular:** dos caminos:
    - **"Crear la iglesia"**: nombre de la iglesia, tu nombre, PIN y clave de instalación. Al terminar muestra el código de la iglesia y el de recuperación, con el texto *"Imprime o anota estos códigos y guárdalos."*.
    - **"Vincular con código"**: el código de 8 dígitos del celular del líder. Muestra el resumen de `adoptOnLink`.
  - **Vinculada:** muestra la iglesia, el último éxito, *"Sincronizar ahora"* y *"Desvincular"* (con `confirmDialog`).
- Test: `src/store/sync.store.test.ts`. Casos:
  - `status updates from push channel`;
  - `applied triggers a reload of songs, folders and setlists`.

- [ ] **Step 1:** Pruebas que fallan.
- [ ] **Step 2:** Ver que fallan.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS. Correr `npx tsc --noEmit -p tsconfig.json`.
- [ ] **Step 5: Prueba de punta a punta.** Electron + Playwright con un userData de prueba, contra la nube **local** (`wrangler dev --local` en el puerto 8787, con `ALADO_CLOUD_URL` como variable de entorno para la URL):
  - crear la iglesia;
  - ver ✅;
  - editar el tono de una canción;
  - comprobar que llega por la API.
- [ ] **Step 6:** Commit `feat(sync): cloud status and linking UI`.
