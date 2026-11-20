# B1a — Fallas del templo y selector de videos: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir las dos fallas de 1.2.0 en el templo (la primera alabanza no se proyecta; la proyección tapa la app en modo "duplicar") y reemplazar el campo de ruta del video por un selector con miniaturas de los videos precargados.

**Architecture:** Todo es escritorio (Electron). La proyección pasa a ser robusta: el proceso main recuerda el último estado enviado a la ventana live y lo **repite** cada vez que esa ventana avisa que está lista, y la ventana live elige su modo (pantalla externa o ventana normal) con una función pura. Los videos se listan y se copian en `userData/videos/` desde el main; el renderer muestra un modal con miniaturas reutilizando `grabVideoFrame`.

**Tech Stack:** Electron 40, React 18, Zustand, Tailwind, Vitest (Node).

**Spec:** `docs/superpowers/specs/2026-11-19-fase-b-alado-conectado-design.md` (secciones "0. Fallas del templo" y "1. Selector de videos precargados"). Es la primera de cuatro partes de B1: B1a (este plan) → B1b nube → B1c sincronización en la compu → B1d app del celular.

## Global Constraints

- Prohibido `alert`/`confirm` nativos en el renderer: usar `ask`/`confirmDialog`/`alertDialog` de `src/store/dialog.store.ts` y avisos de `src/store/toast.store.ts`.
- Textos de la interfaz en español; nombre de la app: **ALADO**.
- Canales de empuje nuevos (`main → renderer`) deben agregarse a la lista permitida de `window.api.on()` en `electron/preload.ts`.
- La DB no se prueba en Vitest (`better-sqlite3` compilado para Electron). Lógica nueva en funciones puras con pruebas.
- Nombres de archivo que llegan del renderer se validan antes de construir rutas (patrón de `electron/audio/validate.ts`): nunca `..`, separadores ni rutas absolutas.
- `npm run dist:win` no compila: correr `npm run build` antes.
- Versión resultante: **1.2.1** en `package.json`.

## Review Focus

1. **La ventana live tarda más de 5 s en cargar** (compu lenta del templo, primer arranque): la primera sección debe aparecer igual cuando la ventana termine de cargar. → prueba en Task 1 (`replays the latest state after a late ready`).
2. **La ventana live se recarga o se cierra y se vuelve a abrir a media presentación**: debe mostrar la sección actual, el video y el blackout vigentes, no una pantalla vacía. → prueba en Task 1 (`replays on every ready, not only the first`).
3. **Esc con el foco en la proyección** (la única ventana visible en modo duplicar): debe cerrar la proyección y la app principal debe volver al estado "no en vivo". → Task 2, paso de verificación manual + prueba de `live:closed` en el store.
4. **Video elegido con "Explorar..." con el mismo nombre que uno existente pero distinto contenido**: no debe reemplazar el video de otras canciones. → prueba en Task 3 (`suffixes a different file with the same name`).
5. **Carpeta `userData/videos/` vacía o inexistente** (instalación sin semilla): el selector abre sin error y muestra "No hay videos todavía" con "Explorar...". → prueba en Task 3 (`returns [] when the folder does not exist`).

---

### Task 1: La proyección repite el último estado cuando la ventana live está lista

Causa por confirmar primero. Hechos ya vistos: `live:open` (`electron/main.ts:37-58`) espera `live:renderer-ready` **solo 5 s** y luego sigue; lo que se mande antes de que la ventana escuche se pierde. En una compu lenta, la primera sección se pierde y la primera alabanza no aparece hasta cambiar de canción.

**Files:**
- Create: `electron/live/liveState.ts`
- Test: `electron/live/liveState.test.ts`
- Modify: `electron/ipc/live.handlers.ts` (registrar cada envío en el caché y exponer `replayLiveState`)
- Modify: `electron/main.ts:37-58` (repetir el estado en **cada** `live:renderer-ready`; limpiar el caché al cerrar)

**Interfaces:**
- Produces: `class LiveStateCache { record(channel: LiveChannel, payload: unknown): void; replay(send: (channel: LiveChannel, payload: unknown) => void): void; clear(): void }` y `type LiveChannel = 'live:set-video' | 'live:transition' | 'live:blackout' | 'live:whiteout' | 'live:show-section'`. `replayLiveState(): void` y `clearLiveState(): void` exportadas desde `live.handlers.ts`.

- [ ] **Step 1: Reproducir antes de arreglar** (superpowers:systematic-debugging). En `npm run dev`, armar un servicio de 2 canciones y presentar. Probar dos causas:
  - (a) Ventana lenta: poner temporalmente un `await new Promise(r => setTimeout(r, 6000))` antes de `window.api.signalReady()` en `src/live/VideoOverlay.tsx`.
  - (b) Teclado: después de clic en "Presentar", pulsar Espacio con el foco en ese botón. Así se descarta que el botón se active otra vez o que salte una sección.

  Anotar en el commit cuál reproduce el síntoma "arranca desde la segunda". Si (b) lo reproduce, agregar a esta tarea: `handlePresent` (`src/pages/Setlist/SetlistPage.tsx:69`) hace `(document.activeElement as HTMLElement | null)?.blur()` antes de `startLive`. Quitar el retraso temporal de (a).

- [ ] **Step 2: Escribir las pruebas que fallan** en `electron/live/liveState.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { LiveStateCache } from './liveState'

const sent = (c: LiveStateCache) => { const out: [string, unknown][] = []; c.replay((ch, p) => out.push([ch, p])); return out }

describe('LiveStateCache', () => {
  it('replays the latest state after a late ready', () => {
    const c = new LiveStateCache()
    c.record('live:set-video', { videoPath: 'a.mp4' })
    c.record('live:show-section', { sectionIndex: 0 })
    c.record('live:show-section', { sectionIndex: 1 })
    expect(sent(c)).toEqual([
      ['live:set-video', { videoPath: 'a.mp4' }],
      ['live:show-section', { sectionIndex: 1 }],
    ])
  })
  it('replays on every ready, not only the first', () => {
    const c = new LiveStateCache()
    c.record('live:blackout', { active: true })
    sent(c)
    expect(sent(c)).toEqual([['live:blackout', { active: true }]])
  })
  it('sends the section last so it shows over the right video and style', () => {
    const c = new LiveStateCache()
    c.record('live:show-section', { sectionIndex: 0 })
    c.record('live:transition', { type: 'cut', duration: 0 })
    c.record('live:whiteout', { active: false })
    c.record('live:set-video', { videoPath: null })
    expect(sent(c).map(([ch]) => ch)).toEqual(['live:set-video', 'live:transition', 'live:whiteout', 'live:show-section'])
  })
  it('clear forgets everything', () => {
    const c = new LiveStateCache()
    c.record('live:show-section', { sectionIndex: 0 })
    c.clear()
    expect(sent(c)).toEqual([])
  })
})
```

- [ ] **Step 3: Correr y ver que fallan.** Comando: `npx vitest run electron/live/liveState.test.ts`. Resultado esperado: FAIL, "Cannot find module './liveState'".

- [ ] **Step 4: Implementar `LiveStateCache`** en `electron/live/liveState.ts`. Usa un `Map` con el último payload por canal. `replay` envía en el orden fijo `set-video, transition, blackout, whiteout, show-section` y omite los canales sin valor.

- [ ] **Step 5: Correr y ver que pasan.** Comando: `npx vitest run electron/live/liveState.test.ts`. Resultado esperado: PASS (4).

- [ ] **Step 6: Conectar.**
  - En `live.handlers.ts`, cada handler hace `cache.record(canal, payload)` antes de `liveWindow?.webContents.send(...)`.
  - En `main.ts`, registrar en la ventana nueva `liveWindow.webContents.ipc.on('live:renderer-ready', replayLiveState)`. Se usa `on` y no solo `once`, para que también se repita si la ventana se recarga. Se conserva la espera actual de `live:open`.
  - En el `'closed'` de la ventana live, llamar a `clearLiveState()`.

- [ ] **Step 7: Verificar en la app.** `npm run dev` con el retraso de 6 s del Step 1 (a) puesto temporalmente. Al presentar, la primera sección de la primera canción aparece cuando la ventana termina de cargar. Quitar el retraso. Correr `npx vitest run` (todo verde) y `npx tsc --noEmit -p tsconfig.json`, sin errores.

- [ ] **Step 8: Commit.**

```bash
git add electron/live electron/ipc/live.handlers.ts electron/main.ts src/pages/Setlist/SetlistPage.tsx
git commit -m "fix(live): replay current state when the live window becomes ready"
```

---

### Task 2: Proyección sin segunda pantalla (modo duplicar) y salida con Esc

**Files:**
- Create: `electron/windows/liveDisplay.ts`
- Test: `electron/windows/liveDisplay.test.ts`
- Modify: `electron/windows/live.window.ts` (usar el plan de pantalla)
- Modify: `electron/main.ts` (`live:open` devuelve `{ windowed: boolean }`; handler `live:escape` cierra la ventana live)
- Modify: `electron/preload.ts` (`openLive` devuelve `Promise<{ windowed: boolean }>`; `requestCloseLive: () => ipcRenderer.send('live:escape')`)
- Modify: `src/live/VideoOverlay.tsx` (Esc → `window.api.requestCloseLive()`)
- Modify: `src/store/live.store.ts` (avisar si quedó en ventana; escuchar `live:closed`)
- Modify: `src/store/songs.store.ts` (tipos de `window.api`: `openLive`, `requestCloseLive`)
- Test: `src/store/live.store.test.ts`

**Interfaces:**
- Produces: `planLiveWindow(displays: { id: number; bounds: Rect; workArea: Rect }[], primaryId: number): { windowed: false; bounds: Rect } | { windowed: true; bounds: Rect }`, con `type Rect = { x: number; y: number; width: number; height: number }`.
- Produces: `window.api.openLive(): Promise<{ windowed: boolean }>`; `window.api.requestCloseLive(): void`.

- [ ] **Step 1: Escribir las pruebas que fallan** en `electron/windows/liveDisplay.test.ts`:
  - `uses the external display fullscreen`: con 2 pantallas, devuelve `{ windowed: false, bounds }` con los `bounds` de la que no es primaria.
  - `falls back to a centered window on the primary work area when only one display`: con 1 pantalla de `workArea {0,0,1920,1040}`, devuelve `{ windowed: true, bounds: { x: 480, y: 250, width: 960, height: 540 } }`. Es una ventana de 16:9 al 50 % del ancho del área de trabajo, centrada.
  - `never exceeds a small work area`: con un `workArea` de 800×600, el ancho queda ≤ 800 y el alto ≤ 600, y se mantiene 16:9.

- [ ] **Step 2: Correr y ver que fallan.** Comando: `npx vitest run electron/windows/liveDisplay.test.ts`. Resultado esperado: FAIL.

- [ ] **Step 3: Implementar `planLiveWindow`** en `electron/windows/liveDisplay.ts`. En `live.window.ts`, `createLiveWindow()` devuelve `{ win: BrowserWindow; windowed: boolean }`.
  - **Con ventana normal (`windowed`):** `frame: true`, `alwaysOnTop: false`, `fullscreen: false`, `resizable: true`, `skipTaskbar: false`, `title: 'ALADO — Proyección'`.
  - **Con pantalla externa:** se queda como hoy.

- [ ] **Step 4: Correr y ver que pasan.** Comando: `npx vitest run electron/windows/liveDisplay.test.ts`. Resultado esperado: PASS.

- [ ] **Step 5: Escribir las pruebas del store que fallan** en `src/store/live.store.test.ts`. Seguir el patrón de `src/audio/playback.store.test.ts` para simular `window.api`.
  - `warns when the projection opened windowed`: `openLive` devuelve `{ windowed: true }`. `startLive([song])` muestra un toast con el texto exacto *"No hay segunda pantalla. La proyección se abrió en una ventana: en Windows usa Win+P → Extender."*
  - `resets when the live window closes`: tras `startLive`, emitir `live:closed` (simulado por `window.api.on`). Queda `isLive === false` y `currentSong === null`.

- [ ] **Step 6: Implementar.**
  - **Store:** `startLive` lee `{ windowed }` y, si es verdadero, llama a `showToast(mensaje, 'info')` de `src/store/toast.store.ts` (si `Toast['kind']` no tiene `'info'`, usar el tipo de aviso no-error que exista). En la creación del store, `window.api.on('live:closed', ...)` hace `set({ isLive: false, currentSong: null, blackout: false, whiteout: false })`.
  - **Esc en la proyección:** en `VideoOverlay`, un `keydown` con `Escape` llama a `window.api.requestCloseLive()`. En `main.ts`, `ipcMain.on('live:escape', () => liveWindow?.close())`.

- [ ] **Step 7: Correr las pruebas.** Comando: `npx vitest run src/store/live.store.test.ts electron/windows`. Resultado esperado: PASS.

- [ ] **Step 8: Verificar en la app.** `npm run dev` con una sola pantalla.
  - Presentar: la proyección se abre en una ventana con marco que se puede mover y achicar, y aparece el aviso.
  - Esc con el foco en la proyección: se cierra y la app sale de "en vivo".
  - Con dos pantallas en Extender (si hay monitor a mano): sin cambios, a pantalla completa en la externa.

- [ ] **Step 9: Commit.**

```bash
git add electron/windows electron/main.ts electron/preload.ts src/live/VideoOverlay.tsx src/store
git commit -m "fix(live): windowed projection without a second display; Esc closes it"
```

---

### Task 3: Biblioteca de videos en el main (listar e importar)

**Files:**
- Create: `electron/media/videoLibrary.ts`
- Test: `electron/media/videoLibrary.test.ts`
- Create: `electron/ipc/videos.handlers.ts` (registrar en `electron/main.ts` junto a los demás)
- Modify: `electron/preload.ts`, `src/store/songs.store.ts` (tipos)

**Interfaces:**
- Produces (puras, con `dir` inyectado para probarlas sobre una carpeta temporal):
  - `listVideos(dir: string): VideoEntry[]` con `type VideoEntry = { name: string; path: string; size: number }`. Incluye solo `.mp4`, `.webm` y `.mov` (sin distinguir mayúsculas), ordenados por nombre con `localeCompare(…, 'es')`. Si la carpeta no existe, devuelve `[]`.
  - `importVideo(srcPath: string, dir: string): VideoEntry`. Copia a `dir` y crea la carpeta si falta. Si ya existe un archivo con ese nombre e **idéntico contenido** (mismo tamaño y mismo SHA-256), lo reutiliza sin copiar. Si existe con contenido distinto, copia como `nombre (2).ext`, `nombre (3).ext`, etc.
- Produces (IPC): `videos:list → VideoEntry[]` sobre `userData/videos`. `videos:import → VideoEntry | null` abre el diálogo nativo de archivos (filtro Video: mp4/webm/mov) e importa lo elegido; si se cancela, devuelve `null`.
- Produces (`window.api`): `listVideos(): Promise<VideoEntry[]>` e `importVideo(): Promise<VideoEntry | null>`.

- [ ] **Step 1: Escribir las pruebas que fallan** en `electron/media/videoLibrary.test.ts`, usando `fs.mkdtempSync(os.tmpdir())`:
  - `lists only video files, sorted`: con `b.mp4`, `A.MOV`, `notas.txt` y `c.webm`, devuelve los nombres `['A.MOV', 'b.mp4', 'c.webm']`.
  - `returns [] when the folder does not exist`.
  - `copies a new video into the folder`.
  - `reuses an identical file with the same name`: el resultado tiene el mismo `path` y no aparece ningún `(2)`.
  - `suffixes a different file with the same name`: el resultado tiene `name === 'fondo (2).mp4'` y el original no cambia.

- [ ] **Step 2: Correr y ver que fallan.** Comando: `npx vitest run electron/media/videoLibrary.test.ts`. Resultado esperado: FAIL.

- [ ] **Step 3: Implementar `listVideos` e `importVideo`** con `fs` síncrono y `crypto.createHash('sha256')` por streams. El SHA solo se calcula si coincide el tamaño. Después, el handler y el preload.

- [ ] **Step 4: Correr y ver que pasan.** Comando: `npx vitest run electron/media/videoLibrary.test.ts`. Resultado esperado: PASS (5).

- [ ] **Step 5: Commit.**

```bash
git add electron/media/videoLibrary.* electron/ipc/videos.handlers.ts electron/main.ts electron/preload.ts src/store/songs.store.ts
git commit -m "feat(videos): list and import background videos in userData/videos"
```

---

### Task 4: Selector de videos con miniaturas en el editor de canción

**Files:**
- Modify: `src/setlist/pptxExport.ts:43` (`grabVideoFrame` acepta opciones)
- Create: `src/components/SongEditor/VideoPicker.tsx` (modal)
- Create: `src/utils/videoFilter.ts`
- Test: `src/utils/videoFilter.test.ts`
- Modify: `src/components/SongEditor/SongEditor.tsx:253-270` (reemplazar el input de ruta)

**Interfaces:**
- Consumes: `window.api.listVideos()` y `window.api.importVideo()` (Task 3).
- Produces: `grabVideoFrame(videoPath: string, opts?: { darken?: boolean; maxWidth?: number; maxHeight?: number }): Promise<string | null>`. Por omisión se comporta igual que hoy: `darken: true` y los máximos actuales. El exportador de PowerPoint no cambia.
- Produces: `filterVideos(list: VideoEntry[], query: string): VideoEntry[]`. No distingue mayúsculas ni acentos (NFD, quita diacríticos), ignora espacios sobrantes y la consulta vacía devuelve todo.
- Produces: `<VideoPicker open: boolean; current: string; onPick: (path: string) => void; onClose: () => void />`.

- [ ] **Step 1: Escribir las pruebas que fallan** en `src/utils/videoFilter.test.ts`:
  - `matches without accents or case`: `'cancion'` encuentra `Canción Fondo.mp4`.
  - `empty query returns all`.
  - `trims the query`: `'  fondo '` encuentra los que contienen `fondo`.

- [ ] **Step 2: Correr y ver que fallan.** Comando: `npx vitest run src/utils/videoFilter.test.ts`. Resultado esperado: FAIL.

- [ ] **Step 3: Implementar `filterVideos`.** Después, el componente:
  - **El modal:** sigue el estilo de los modales existentes (Tailwind slate/indigo; el de "⚙ Configuración general" en `SongEditor` sirve de referencia). Lleva un buscador arriba y una cuadrícula de tarjetas con miniatura 16:9 y nombre. El video actual va marcado con anillo indigo.
  - **Interacción:** clic en una tarjeta → `onPick(entry.path)` y se cierra. Un botón "Explorar..." llama a `importVideo()` y, si devuelve un video, lo elige.
  - **Miniaturas:** `grabVideoFrame(path, { darken: false, maxWidth: 320, maxHeight: 180 })`, cargadas de a una (en secuencia, para no abrir decenas de `<video>` a la vez) y guardadas en un `Map` a nivel de módulo para que reabrir el modal sea instantáneo. Mientras carga o si falla, la tarjeta muestra un placeholder con el ícono 🎬.
  - **Carpeta vacía:** texto *"No hay videos todavía."* y el botón "Explorar...".

- [ ] **Step 4: Cambiar el editor.** La sección "Video de fondo" muestra la miniatura pequeña y el nombre del video actual, o *"Sin video (fondo por defecto)"*. Lleva los botones **"Elegir video"** (abre el modal) y **"Quitar"** (deja `videoPath = ''`; solo aparece si hay video). Se quita el `<input>` de ruta y la función `pickVideo`.

- [ ] **Step 5: Correr todo.** `npx vitest run` → todo verde. `npx tsc --noEmit -p tsconfig.json` → sin errores.

- [ ] **Step 6: Verificar en la app.** En `npm run dev`, abrir una canción y luego "Elegir video".
  - Se ven las miniaturas de `userData/videos/`; buscar filtra.
  - Elegir uno lo asigna y la vista previa de la canción lo muestra.
  - "Explorar..." con un video de fuera lo copia a `userData/videos/` y lo asigna.
  - Guardar la canción y reabrirla: el video sigue.
  - Exportar un PowerPoint de un servicio: los fondos siguen oscurecidos como antes.

- [ ] **Step 7: Commit.**

```bash
git add src/setlist/pptxExport.ts src/components/SongEditor src/utils/videoFilter.*
git commit -m "feat(editor): pick background videos from a thumbnail gallery"
```

---

### Task 5: Versión 1.2.1 y verificación final

**Files:**
- Modify: `package.json` (`"version": "1.2.1"`)
- Modify: `CLAUDE.md`: en "Two Processes, Two Windows", una línea sobre `planLiveWindow` (ventana normal sin segunda pantalla) y la repetición del estado (`LiveStateCache`). En "IPC Layer", agregar el namespace `videos:*`.

- [ ] **Step 1: Pruebas y tipos.** `npx vitest run` → todo verde, con las 163 previas más las nuevas. `npx tsc --noEmit -p tsconfig.json` → sin errores.
- [ ] **Step 2: Compilar.** `npm run build` → termina sin errores.
- [ ] **Step 3: Prueba de punta a punta.** Usar Electron + Playwright con un `userData` aparte en el scratchpad, como en 1.2.0.
  - Presentar un servicio: la primera sección de la primera canción llega a la ventana live.
  - Con una sola pantalla: la proyección queda en ventana normal y Esc la cierra.
  - El selector de videos asigna un video.
  - Borrar el `userData` temporal al terminar.
- [ ] **Step 4: Commit.**

```bash
git add package.json CLAUDE.md
git commit -m "chore: v1.2.1 (temple fixes + video picker)"
```

El instalador (`npm run dist:win`) no se genera en este plan: por decisión del usuario, sale junto con B1.
