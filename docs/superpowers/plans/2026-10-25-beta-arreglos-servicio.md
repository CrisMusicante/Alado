# Beta ALADO — Proyecto A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lograr que armar un servicio sea confiable: que el borrador persista, que se pueda ver la letra desde Servicio, que Guardar funcione de verdad, que haya intercambio `.alado` y respaldo `.pptx`, y que el `.exe` lleve el logo de ALADO.

**Architecture:**
- El borrador del servicio vive en un store de Zustand con `persist` en `localStorage`, separado de `SetlistPage`.
- El formato `.alado` y la planeación de la importación son funciones puras en `electron/setlist/` con pruebas. El handler de IPC hace el diálogo de archivos y la transacción en SQLite.
- El `.pptx` se arma en el renderer con `pptxgenjs`: el cuadro del video se extrae con `<video>` + `<canvas>` y los bytes se mandan al main para el diálogo de guardar.

**Tech Stack:** Electron 40, React 18, Zustand 4 (`zustand/middleware` persist), better-sqlite3, Vitest (entorno node), Tailwind, `pptxgenjs` (nueva dependencia).

**Spec:** `docs/superpowers/specs/2026-10-25-beta-arreglos-servicio-design.md`

## Global Constraints

- El nombre visible de la app es **ALADO**; nunca "WorshipFlow" en textos nuevos.
- No se usan `window.alert`/`window.confirm` en el renderer. Se usan `ask`, `confirmDialog` y `alertDialog` de `src/store/dialog.store.ts`. Los diálogos de archivos nativos (`dialog.showSaveDialog`/`showOpenDialog`) sí están permitidos.
- Al importar, una canción existente **nunca** se modifica: gana la de la compu.
- `video_file` / `custom_video_file` en `.alado` son solo nombres de archivo, nunca rutas.
- El formato es `"format": "alado-setlist"` y `"version": 1`. Se rechaza otro `format` y cualquier `version` > 1.
- La DB no se prueba en Vitest (better-sqlite3 está compilado para Electron). La lógica se prueba en funciones puras.
- Textos de la UI en español. El estilo sigue Tailwind con la paleta slate/indigo existente.
- Formato estándar del texto en el `.pptx`: centrado, grande, blanco, con sombra.

## Review Focus

1. **Borrador que apunta a canciones borradas o con la letra editada desde otra vista.** Al volver a Servicio se descartan las borradas y se refresca la letra de las que siguen. Prueba en la Task 1 (`syncWithCatalog`).
2. **Archivo `.alado` corrupto, truncado, de otra app o de una versión futura.** Mensaje claro y ningún cambio en la DB. Pruebas en la Task 4 (`parseAladoFile`).
3. **Títulos con acentos, mayúsculas o espacios distintos** ("Cuán Grande Es Él " contra "cuan grande es el"): deben reconocerse como la misma canción. Prueba en la Task 4 (`normalizeTitle` / `pickMatch`).
4. **Video local que no se puede leer en el canvas** (por CORS o por un códec no soportado). El `.pptx` se genera igual, con fondo liso. Prueba en la Task 6 (`buildDeckPlan` con `frame: null`) más una verificación manual.
5. **Doble clic en Guardar o un error de la DB.** El botón vuelve a la normalidad y no quedan dos registros. Prueba en la Task 2 (estado `dirty` / `setlistId` tras `markSaved`) más una verificación manual.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/store/serviceDraft.store.ts` (nuevo) | Borrador persistente: items, nombre, fecha, `setlistId` y `dirty` |
| `src/store/serviceDraft.store.test.ts` (nuevo) | Pruebas del borrador |
| `src/store/toast.store.ts` + `src/components/ToastHost.tsx` (nuevos) | Avisos no bloqueantes |
| `src/utils/sectionPreview.ts` (+ `.test.ts`) (nuevos) | Etiquetas "Coro ×2" y recorte de la vista previa |
| `src/pages/Setlist/LyricsHoverCard.tsx`, `SectionList.tsx` (nuevos) | UI de la vista previa (opción C) |
| `src/pages/Setlist/SetlistPage.tsx` | Usa el store y agrega la cabecera nueva y el menú Exportar |
| `electron/setlist/aladoFile.ts` (+ `.test.ts`) (nuevos) | Formato `.alado`: construir, validar, coincidencias y plan de importación |
| `electron/ipc/setlist.handlers.ts` (nuevo) | `setlist:export`, `setlist:import-inspect`, `setlist:import-apply`, `setlist:save-pptx` |
| `electron/preload.ts`, `src/store/songs.store.ts` (global `window.api`), `electron/main.ts` | Cableado de IPC |
| `electron/media/protocol.ts` | `corsEnabled` + `Access-Control-Allow-Origin` para leer cuadros en el canvas |
| `src/setlist/pptxExport.ts` (+ `.test.ts`) (nuevos) | Plan de diapositivas (puro), extracción del cuadro y generación con pptxgenjs |
| `electron-builder.yml` | Ícono del ejecutable y del instalador |

---

### Task 1: Store del borrador del servicio

**Files:**
- Create: `src/store/serviceDraft.store.ts`, `src/store/serviceDraft.store.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DraftItem { key: string; song: Song }
  export interface ServiceDraftState {
    setlistId: number | null; name: string; serviceDate: string /* YYYY-MM-DD */;
    items: DraftItem[]; dirty: boolean
    addSong(song: Song): void            // ignora si song.id ya está
    removeItem(key: string): void
    moveItem(fromKey: string, toKey: string): void
    setName(name: string): void; setServiceDate(date: string): void
    loadSaved(saved: SavedSetlist): void // setlistId = saved.id, dirty=false
    reset(): void                        // nombre `Servicio ${hoy es}`, fecha hoy, sin id, dirty=false
    markSaved(id: number): void          // setlistId=id, dirty=false
    syncWithCatalog(all: Song[]): void   // refresca snapshots por id y descarta los ausentes; no cambia dirty
  }
  export const useServiceDraftStore
  export function todayISO(): string
  ```
  Toda mutación excepto `loadSaved`, `reset`, `markSaved` y `syncWithCatalog` pone `dirty = true`. Se persiste con `persist(..., { name: 'alado-service-draft', partialize })`, sin las funciones.

- [ ] **Step 1: Write the failing tests** (`describe('serviceDraft')`, `beforeEach(() => useServiceDraftStore.getState().reset())`):
  - `addSong agrega una vez y marca dirty`: dos `addSong(song(1))` → `items.length === 1` y `dirty === true`.
  - `moveItem reordena`: con items [1,2,3], `moveItem(key3, key1)` → ids `[3,1,2]`.
  - `loadSaved toma id, nombre, fecha y canciones sin dirty`: `loadSaved({ id: 7, name: 'Dom', service_date: '2026-10-26', songs: [{song: song(2), position: 0}] })` → `setlistId 7`, `serviceDate '2026-10-26'`, `dirty false`, ids `[2]`.
  - `markSaved fija el id y limpia dirty`: tras `addSong` y `markSaved(9)` → `setlistId 9`, `dirty false`. Un segundo `markSaved(9)` deja el mismo id (no hay un segundo registro).
  - `syncWithCatalog descarta canciones borradas y refresca letras`: items [1,2]; `syncWithCatalog([{...song(1), title: 'Nuevo'}])` → ids `[1]`, `items[0].song.title === 'Nuevo'` y `dirty` sin cambio.
  - `reset deja nombre por defecto y fecha de hoy`: `name.startsWith('Servicio ')` y `serviceDate === todayISO()`.

- [ ] **Step 2: Run** `npx vitest run src/store/serviceDraft.store.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implement** `src/store/serviceDraft.store.ts` según Interfaces. `persist` en entorno node sin `localStorage` debe seguir funcionando: usa `createJSONStorage(() => localStorage)`, y si las pruebas lanzan errores por la falta de `localStorage`, envuélvelo en un `try`/no-op storage.

- [ ] **Step 4: Run** el mismo comando → PASS.

- [ ] **Step 5: Commit** `feat(service): persistent service draft store`

---

### Task 2: SetlistPage sobre el borrador + Guardar con aviso

**Files:**
- Create: `src/store/toast.store.ts`, `src/components/ToastHost.tsx`
- Modify: `src/pages/Setlist/SetlistPage.tsx`, `src/App.tsx` (montar `<ToastHost />` junto a `<DialogHost />`)

**Interfaces:**
- Consumes: `useServiceDraftStore` (Task 1).
- Produces: `showToast(message: string, kind?: 'success' | 'error'): void` en `toast.store.ts`. Los avisos se ocultan solos a los ~2.5 s.

- [ ] **Step 1: Reemplazar el estado local** de `SetlistPage` (`setlistSongs`, `setlistName`) por el store. `handleDragEnd` usa `moveItem`. Tras el `fetchSongs()` del montaje, que es sin filtro, llamar `syncWithCatalog(songs)` con el resultado: usa `await useSongsStore.getState().fetchSongs()` y luego lee el estado.

- [ ] **Step 2: Cabecera:**
  - `<input type="date">` ligado a `serviceDate`.
  - Indicador "• sin guardar" cuando `dirty`.
  - Botón "Nuevo" que llama `reset()`. Si `dirty`, primero `confirmDialog('Hay cambios sin guardar. ¿Empezar un servicio nuevo?')`.
  - "Cargar" también confirma si `dirty` antes de `loadSaved`.

- [ ] **Step 3: `handleSave`:** `saveSetlist({ id: setlistId ?? undefined, name, service_date: serviceDate, songs })` dentro de `try { … markSaved(id); showToast('Servicio guardado') } catch { showToast('No se pudo guardar el servicio', 'error') } finally { setSaving(false) }`. Mientras `saving` sea true, ignora clics repetidos.

- [ ] **Step 4: Verificar** con `npm run dev`:
  - armar 2 canciones → ir a Canciones → volver: siguen ahí;
  - cerrar la app y abrirla: siguen ahí;
  - Guardar dos veces: dos avisos y **un** solo servicio en "Cargar";
  - cambiar la fecha y guardar: se ve en "Cargar".

  Corre también `npx vitest run` → todo en verde.

- [ ] **Step 5: Commit** `fix(service): keep draft across views, save updates in place with confirmation`

---

### Task 3: Vista previa de letras (opción C)

**Files:**
- Create: `src/utils/sectionPreview.ts`, `src/utils/sectionPreview.test.ts`, `src/pages/Setlist/LyricsHoverCard.tsx`, `src/pages/Setlist/SectionList.tsx`
- Modify: `src/pages/Setlist/SetlistPage.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function sectionLabel(s: Section): string   // "Coro", "Coro ×2" si repeat > 1
  export function previewSections(song: Song, maxSections = 2, maxLines = 2): Array<{ label: string; lines: string[]; truncated: boolean }>
  ```
  `SectionList({ song })` muestra todas las secciones en orden. `LyricsHoverCard({ song, anchorRect })` usa `previewSections`.

- [ ] **Step 1: Write the failing tests:**
  - `sectionLabel({label:'Coro', repeat: 2, …}) === 'Coro ×2'`; con `repeat` 1 o indefinido → `'Coro'`.
  - `previewSections` con 3 secciones de 4 líneas → 2 entradas, cada una con 2 líneas y `truncated: true`. Una canción con `sections: []` → `[]`.

- [ ] **Step 2: Run** `npx vitest run src/utils/sectionPreview.test.ts` → FAIL.

- [ ] **Step 3: Implement** las funciones. Luego, la UI:
  - **Biblioteca:** un hover sostenido de 400 ms muestra la tarjeta a la derecha del botón, con posición `fixed` calculada desde `getBoundingClientRect()` y limitada a `window.innerHeight`. Tiene `pointer-events: none` para no bloquear el clic que agrega, y se oculta en `mouseleave` o al hacer scroll.
  - **Setlist:** un botón ▸/▾ en `SortableSetlistItem` alterna un estado local `expanded` y renderiza `<SectionList>`. El botón detiene la propagación (`onPointerDown` y `onClick`) para no iniciar arrastre ni `changeSong` en vivo.

- [ ] **Step 4: Run** las pruebas → PASS. Verifica en `npm run dev`:
  - el hover muestra la tarjeta;
  - el clic sigue agregando;
  - ▸ despliega todas las secciones con "×N";
  - arrastrar sigue funcionando con items desplegados.

- [ ] **Step 5: Commit** `feat(service): lyrics hover preview and expandable setlist items`

---

### Task 4: Formato `.alado` y plan de importación (puro)

**Files:**
- Create: `electron/setlist/aladoFile.ts`, `electron/setlist/aladoFile.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const ALADO_FORMAT = 'alado-setlist'; export const ALADO_VERSION = 1
  export interface AladoSong { title: string; artist?: string | null; sections: Section[]; text_style: Record<string, unknown>; video_file: string | null }
  export interface AladoFile { format: string; version: number; exported_at: string;
    setlist: { name: string; service_date: string | null; notes: string | null };
    items: Array<{ position: number; song: AladoSong; custom_video_file: string | null }> }
  export interface LocalSong { id: number; title: string; artist: string | null; sections: Section[]; updated_at: string | null }
  export function buildAladoFile(setlist: AladoFile['setlist'], songs: Array<{ title: string; artist?: string | null; sections: Section[]; text_style: object; video_path?: string | null; custom_video?: string | null }>, now: Date): AladoFile
  export function parseAladoFile(text: string): AladoFile        // lanza Error con mensaje en español
  export function normalizeTitle(t: string): string
  export function pickMatch(song: AladoSong, local: LocalSong[]): LocalSong | null
  export function sectionsDiffer(a: Section[], b: Section[]): boolean
  export type ImportStep = { kind: 'existing'; songId: number; title: string; differs: boolean }
                         | { kind: 'create'; song: AladoSong; videoPath: string | null }
  export function planImport(file: AladoFile, local: LocalSong[], videosDir: string, videoNames: Set<string>): ImportStep[]
  ```
  `Section` se define localmente en este archivo, igual que en `db.handlers.ts` (duplicación intencional entre procesos).

- [ ] **Step 1: Write the failing tests:**
  - `buildAladoFile` toma solo el nombre del archivo: `video_path: 'C:\\x\\videos\\fondo.mp4'` → `video_file: 'fondo.mp4'`. Las posiciones son 0..n-1, `format`/`version` son correctos y `exported_at === now.toISOString()`.
  - Ida y vuelta: `parseAladoFile(JSON.stringify(buildAladoFile(...)))` es igual al original, con secciones, `repeat` y `text_style` intactos.
  - `parseAladoFile` lanza un error que contiene `'no es un servicio de ALADO'` para `'{}'`, para JSON de otro `format` y para texto no-JSON (`'hola'`).
  - Lanza un error que contiene `'versión más nueva'` para `version: 2`.
  - Lanza error si un item no tiene `song.title` o si `sections` no es un arreglo.
  - `normalizeTitle('  Cuán  Grande Es ÉL ') === normalizeTitle('cuan grande es el')`.
  - `pickMatch`: con dos locales del mismo título, prefiere la que coincide en artista. Sin coincidencia de artista, prefiere el `updated_at` más reciente. Sin título igual → `null`.
  - `sectionsDiffer`: igual → `false`; una línea distinta, otra etiqueta o un `repeat` distinto → `true`.
  - `planImport`:
    - existente con letra distinta → `{kind:'existing', differs:true}`;
    - nueva con `video_file` presente en `videoNames` → `videoPath === path.join(videosDir, name)`;
    - nueva sin video encontrado → `videoPath: null`.

- [ ] **Step 2: Run** `npx vitest run electron/setlist/aladoFile.test.ts` → FAIL.

- [ ] **Step 3: Implement.** `normalizeTitle` hace `NFD`, quita `\p{Diacritic}`, pasa a minúsculas, colapsa espacios y aplica `trim`. `sectionsDiffer` compara `label`, `type`, `lines` y `repeat ?? 1` en orden.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat(setlist): .alado file format and pure import planning`

---

### Task 5: IPC + UI de exportar e importar `.alado`

**Files:**
- Create: `electron/ipc/setlist.handlers.ts`
- Modify: `electron/main.ts` (`registerSetlistHandlers()`), `electron/preload.ts`, `src/store/songs.store.ts` (tipos de `window.api`), `src/pages/Setlist/SetlistPage.tsx`

**Interfaces:**
- Consumes: Task 4 (`buildAladoFile`, `parseAladoFile`, `planImport`), `getDb`, `deserializeSong` (exportarla desde `db.handlers.ts` si no lo está), `useServiceDraftStore.loadSaved`.
- Produces (en `window.api`):
  ```ts
  setlistExport(p: { name: string; service_date: string; songIds: number[] }): Promise<{ path: string } | null>
  setlistImportInspect(): Promise<{ path: string; name: string; service_date: string | null; songCount: number; duplicateOf: number | null } | null>
  setlistImportApply(p: { path: string; mode: 'new' | 'replace'; replaceId?: number }): Promise<ImportSummary>
  // ImportSummary = { setlistId: number; reused: number; created: string[]; differing: string[]; missingVideo: string[]; missingAudio: string[] }
  ```

- [ ] **Step 1: `setlist:export`.** Lee las canciones por id en el orden recibido, arma el archivo con `buildAladoFile` y abre `dialog.showSaveDialog` con `defaultPath` = nombre saneado (como en `pack.handlers.ts`) y el filtro `{ name: 'Servicio ALADO', extensions: ['alado'] }`. Escribe el JSON con `JSON.stringify(file, null, 2)`. Si se cancela → `null`.

- [ ] **Step 2: `setlist:import-inspect`.** Llama `showOpenDialog` con el filtro `alado`, lee el archivo y lo pasa por `parseAladoFile` (los errores se propagan al renderer). Calcula `duplicateOf` = id del setlist con el mismo `name` y `service_date`, o `null`.

- [ ] **Step 3: `setlist:import-apply`:**
  - vuelve a parsear el archivo;
  - lee las canciones locales y la lista de nombres en `path.join(app.getPath('userData'), 'videos')` (vacía si no existe);
  - llama `planImport`;
  - en **una** `db.transaction`:
    - inserta las canciones `create` con `folder_id NULL` y `video_path`;
    - con `mode 'replace'`, borra los `setlist_items` y actualiza la fila `replaceId`; si no, inserta un setlist nuevo;
    - inserta los items en orden.
  - `missingAudio` = títulos cuyo `song_audio.status !== 'ready'`; `missingVideo` = creadas con `videoPath null`.

- [ ] **Step 4: UI.**
  - **Exportar:** botón "Exportar ▾" con las opciones "Archivo .alado" y "PowerPoint" (esta última se cablea en la Task 6). Llama `setlistExport` con el borrador actual y, al terminar, `showToast('Servicio exportado')`.
  - **Importar:** botón "Importar" junto a "Cargar". Si `dirty`, primero confirma.
    - `inspect`: si hay `duplicateOf`, pregunta con `ask` entre `Reemplazar` (`replace`), `Crear copia` (`new`) y `Cancelar`.
    - `apply`: luego `fetchSetlists()`, `fetchSongs()` y `loadSaved` del setlist importado.
    - Muestra un resumen con `alertDialog`, en líneas, omitiendo las que estén en cero: "N canciones ya estaban en esta compu", "Se crearon: …", "Con letra distinta (se usó la de esta compu): …", "Sin video (fondo por defecto): …", "Sin audio en esta compu: …".
    - Los errores de `inspect`/`apply` se muestran con `alertDialog(error.message, 'No se pudo importar')`.

- [ ] **Step 5: Verificar** con `npm run dev`:
  - exportar un servicio de 3 canciones y abrir el `.alado`: los campos son correctos;
  - cambiar en la DB la letra de una canción y reimportar: el resumen la reporta como distinta y la canción no cambió;
  - importar dos veces: aparece la pregunta;
  - un `.alado` con `"version": 2` muestra el error y no cambia nada.

  Corre `npx vitest run` → verde.

- [ ] **Step 6: Commit** `feat(setlist): export/import services as .alado files`

---

### Task 6: Exportar a PowerPoint

**Files:**
- Create: `src/setlist/pptxExport.ts`, `src/setlist/pptxExport.test.ts`
- Modify: `electron/media/protocol.ts`, `electron/ipc/setlist.handlers.ts`, `electron/preload.ts`, `src/store/songs.store.ts`, `src/pages/Setlist/SetlistPage.tsx`, `package.json` (`npm i pptxgenjs`)

**Interfaces:**
- Consumes: `sectionLabel` (Task 3), menú "Exportar ▾" (Task 5).
- Produces:
  ```ts
  export type SlideSpec = { kind: 'title'; songIndex: number; title: string; artist?: string } | { kind: 'section'; songIndex: number; text: string; repeat: number }
  export function buildDeckPlan(songs: Song[]): SlideSpec[]
  export function fitFontSize(text: string): number   // pt; 40 base, baja hasta 20 según líneas/longitud
  export function grabVideoFrame(videoPath: string): Promise<string | null>  // JPEG dataURL o null
  export async function exportServicePptx(name: string, songs: Song[]): Promise<{ path: string } | null>
  // window.api.setlistSavePptx(p: { bytes: Uint8Array; defaultName: string }): Promise<{ path: string } | null>
  ```

- [ ] **Step 1: Write the failing tests:**
  - `buildDeckPlan` con 2 canciones (2 y 3 secciones) → 7 diapositivas en el orden `title, section, section, title, section, section, section`.
  - Una sección con `repeat: 2` → `repeat: 2`; `text` = líneas unidas por `\n`.
  - Una canción sin secciones → solo su diapositiva de título.
  - `fitFontSize`: 2 líneas cortas → 40; 10 líneas → ≥ 20 y < 40; nunca baja de 20.

- [ ] **Step 2: Run** `npx vitest run src/setlist/pptxExport.test.ts` → FAIL.

- [ ] **Step 3: Implement las funciones puras.**

- [ ] **Step 4: Cuadro del video.**
  - En `protocol.ts`, agrega `corsEnabled: true` a los privilegios y `Access-Control-Allow-Origin: *` a la respuesta (copia el `Response` de `net.fetch` con los headers extra).
  - `grabVideoFrame`:
    - crea un `<video>` con `crossOrigin='anonymous'`, `muted` y `src=mediaUrl(path)`;
    - en `loadedmetadata`, busca `min(1, duration*0.1)`;
    - en `seeked`, dibuja en un canvas de ≤1280×720 (conservando la proporción), pinta encima `rgba(0,0,0,0.35)` y devuelve `toDataURL('image/jpeg', 0.7)`.
  - Cualquier error, o un timeout de 8 s → `null`.

- [ ] **Step 5: `exportServicePptx`.**
  - `layout: 'LAYOUT_16x9'`.
  - Un cuadro por canción, cacheado por índice.
  - Fondo: `background: { data }` o `{ color: '0F172A' }` si no hay cuadro.
  - El texto va centrado, blanco, con `shadow` y `fontSize` de `fitFontSize`, con `fit: 'shrink'`. El "×N" va en una caja pequeña abajo a la derecha.
  - Al final, `pptx.write({ outputType: 'uint8array' })` → `setlistSavePptx`.
  - En el main, `setlist:save-pptx` abre `showSaveDialog` (`.pptx`) y escribe los bytes.
  - Desde el menú: aviso de "Generando PowerPoint…" y luego "PowerPoint exportado".

- [ ] **Step 6: Verificar.**
  - Corre las pruebas → PASS.
  - En `npm run dev`, exporta un servicio de unas 6 canciones con y sin video y ábrelo en PowerPoint:
    - se ven los fondos de imagen oscurecidos;
    - la letra es legible;
    - hay "×N";
    - el archivo pesa unos pocos MB.
  - Si `toDataURL` lanza `SecurityError` (canvas contaminado), confirma que el `.pptx` sale con fondo liso y corrige los headers CORS.

- [ ] **Step 7: Commit** `feat(setlist): export service as lightweight PowerPoint backup`

---

### Task 7: Logo en el ejecutable y el instalador

**Files:**
- Modify: `electron-builder.yml`

- [ ] **Step 1:** En `win:`, quita `signAndEditExecutable: false` (por defecto es `true`: rcedit aplica el ícono y no firma si no hay certificado). En `nsis:`, agrega `installerIcon`, `uninstallerIcon` e `installerHeaderIcon`, los tres con `assets/icons/icon.ico`.

- [ ] **Step 2:** `npm run build && npm run dist:win`. Si falla por la firma o por winCodeSign (permisos de symlinks en Windows), documenta el error. La alternativa que conserva rcedit es activar el Modo de desarrollador de Windows o correr el comando una vez como administrador para que se extraiga winCodeSign. No vuelvas a poner `false` sin avisar.

- [ ] **Step 3: Verificar** instalando `dist/*.exe`: el ícono de ALADO aparece en el instalador, el acceso directo del escritorio, el menú Inicio, la barra de tareas con la app abierta y "Aplicaciones instaladas". Si Windows muestra el ícono viejo, ejecuta `ie4uinit.exe -show` y anótalo en el reporte.

- [ ] **Step 4: Commit** `fix(build): embed ALADO icon in executable and installer`

---

## Cobertura del spec

| Spec | Task |
|---|---|
| §1 Borrador persistente, Nuevo servicio, sin guardar | 1, 2 |
| §2 Vista previa C | 3 |
| §3 Guardar | 2 |
| §4 `.alado` exportar/importar, duplicados, resumen | 4, 5 |
| §5 PowerPoint | 6 |
| §6 Logo | 7 |
