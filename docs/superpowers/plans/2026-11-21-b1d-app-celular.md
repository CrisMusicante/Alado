# B1d — App del celular (PWA): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una app web instalable en el celular, servida por el mismo Worker (`https://alado.mj-cristhian.workers.dev`), con la que el Líder y los Editores preparan el servicio del sábado, con o sin señal:
- armar y editar servicios;
- ver letras;
- editar (Líder) o proponer (Editor) cambios de letra y tono;
- aprobar propuestas;
- administrar usuarios y compus.

**Architecture:**
- **Proyecto.** `mobile/` es un proyecto Vite + React + Tailwind aparte. Compila a `cloud/public/` y se sirve en el mismo origen que la API, sin CORS.
- **Funciona sin conexión.**
  - El catálogo, los servicios y la sesión viven en IndexedDB.
  - Los cambios se guardan en una **bandeja de salida**, se aplican de inmediato a la copia local y se suben al haber señal.
  - Un service worker guarda el "cascarón" de la app para abrirla sin red.
- **Pruebas.** La lógica (catálogo local, bandeja, armado de servicios) son funciones puras con pruebas en Vitest. La interfaz se prueba de punta a punta con Playwright (Chromium, vista de celular) contra `wrangler dev`.

**Tech Stack:** Vite 7, React 18, Tailwind 3, IndexedDB nativo, Service Worker, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-19-fase-b-alado-conectado-design.md` (secciones 2, 4, 5). Es la parte B1d: B1a ✅ → B1b ✅ → B1c ✅ → **B1d**.

## Global Constraints

- **Español, celular primero** (vertical, áreas de toque ≥ 44 px), tema oscuro slate/indigo y etiqueta ámbar para el tono, como en el escritorio.
- **Roles.**
  - El Líder edita letra, tono, título, artista y video directo.
  - El Editor **propone** esos cambios; nunca escribe la canción directo.
  - Los dos arman servicios.
  - El Miembro solo lee.
  - El Editor no puede meter en un servicio una canción nueva propuesta (no existe hasta aprobarse).
- **La bandeja de salida respeta el tope de la nube** (30 cambios por envío) y conserva el orden.
- Siempre se ve el estado:
  - *"Al día"*;
  - *"Sin conexión · N cambios por subir"*;
  - *"Sincronizando…"*.
- El tono sale de la lista fija `src/utils/songKeys.ts`.
- El video se elige por **nombre** entre los que ya usan las canciones del catálogo, o se deja sin video.
- Sin dependencias nuevas de runtime: React y React DOM ya están.

## Review Focus

1. **Editar sin señal y cerrar la app:** al volver a abrirla, lo pendiente sigue en la bandeja y sube al haber red. → prueba de la bandeja (Task 1) y de punta a punta (Task 4).
2. **La nube rechaza un cambio** (`forbidden`, `unknown-song`): no se reintenta para siempre; se avisa y sale de la bandeja. → Task 1.
3. **Un Editor intenta guardar una canción:** se convierte en propuesta y la canción local no cambia. → Task 1.
4. **Sesión revocada o código de iglesia rotado:** al recibir 401 vuelve a la pantalla de entrada sin borrar la bandeja. → Task 1.
5. **Aprobar con una vista vieja (409):** el Líder ve *"La canción cambió…"* y la lista se recarga. → Task 3, de punta a punta.

---

### Task 1: Núcleo sin conexión (catálogo local, bandeja, sincronización)

**Files:**
- Create: `mobile/src/core/catalog.ts`
  - `applyPull(catalog, pulled) → catalog`;
  - `applyLocalChange(catalog, change) → catalog`: cambio optimista;
  - `searchSongs(catalog, q)`: sin acentos ni mayúsculas;
  - `videoNames(catalog)`.
- Create: `mobile/src/core/outbox.ts`
  - `enqueue(outbox, change)`: un cambio de canción combina sus campos con otro pendiente del mismo uid y guarda el `seen` **más viejo**; un servicio reemplaza al anterior del mismo uid.
  - `takeBatch(outbox, 30)`.
  - `settle(outbox, batch, results) → { outbox, failed: { change, error }[] }`: lo aceptado sale; lo rechazado sale y se reporta.
- Create: `mobile/src/core/sync.ts`
  - `syncOnce(state, api) → { state, notices, failed, unauthorized }`: subir la bandeja por lotes, luego bajar desde `seq`.
  - Las propuestas en espera (`pendingProposals`) se mandan a `/api/proposals`.
- Create: `mobile/src/core/types.ts` (re-exporta `shared/types.ts`; `LocalState = { session, me, catalog, seq, outbox, pendingProposals }`)
- Test: `mobile/src/core/*.test.ts` (y `vitest.config.ts` incluye `mobile/**/*.test.ts`)

- [ ] **Step 1: Pruebas que fallan.**
  - `applyPull merges by uid and drops deleted rows`;
  - `enqueue merges two edits of one song keeping the oldest seen`;
  - `a later setlist edit replaces the queued one`;
  - `takeBatch respects 30`;
  - `settle drops accepted and reports rejected`;
  - `syncOnce pushes then pulls and returns notices` (con una `api` falsa);
  - `401 marks unauthorized and keeps the outbox`;
  - `editor song edit becomes a pending proposal and the catalog is untouched`.
- [ ] **Step 2:** Ver que fallan.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(mobile): offline catalog, outbox and sync core`.

### Task 2: Cascarón: proyecto, almacenamiento, entrada y navegación

**Files:**
- Create:
  - `mobile/index.html`, `mobile/vite.config.ts` (`root: mobile`, `build.outDir: ../cloud/public`, `emptyOutDir: true`), `mobile/tailwind.config.cjs`, `mobile/postcss.config.cjs`;
  - `mobile/public/manifest.webmanifest` (nombre "ALADO", `display: standalone`, colores slate) y `mobile/public/icon-192.png` / `icon-512.png`, generados desde `assets/icons/icon.png`;
  - `mobile/public/sw.js`: precache del cascarón, red primero para navegación, nunca cachea `/api/`.
- Create: `mobile/src/main.tsx`, `mobile/src/App.tsx` (pestañas abajo: Servicios · Canciones · Pendientes (Líder, con contador) · Ajustes), `mobile/src/store.ts` (estado con React, persistido en IndexedDB vía `mobile/src/core/idb.ts`), `mobile/src/api.ts`.
- Create: `mobile/src/screens/Login.tsx`:
  - pestañas **"Líder o editor"** (código de iglesia, nombre y PIN) y **"Solo ver"** (código de iglesia);
  - recordar el código de la iglesia.
- Modify: `package.json`, scripts `mobile:dev` y `mobile:build`; `cloud:deploy` compila primero la PWA.
- Test: compilar (`npm run mobile:build`) y abrir en Playwright (Chromium, 390×844). Casos: la pantalla de entrada se ve, entrar con datos de `wrangler dev` lleva a Servicios, y con la red cortada la app abre sin conexión.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `npm run mobile:build`, sin errores.
- [ ] **Step 3:** Prueba con Playwright.
- [ ] **Step 4:** Commit `feat(mobile): installable shell, login and offline storage`.

### Task 3: Pantallas

**Files:**
- Create: `mobile/src/screens/Services.tsx`
  - lista por fecha, la próxima primero;
  - "Nuevo servicio";
  - editor: nombre, fecha y notas; agregar canciones con buscador; subir, bajar o quitar canciones.
- Create: `mobile/src/screens/Songs.tsx`: buscador; ver la letra por secciones con el tono.
- Create: `mobile/src/screens/SongEdit.tsx`:
  - campos: título, artista, tono y video por nombre;
  - secciones: etiqueta y líneas en un área de texto; agregar, quitar y reordenar;
  - el Líder **guarda**; el Editor **propone** y ve el texto *"Tu cambio queda pendiente hasta que el líder lo apruebe"*;
  - el Editor también puede proponer una canción nueva.
- Create: `mobile/src/screens/Pending.tsx` (Líder)
  - tarjetas con autor, fecha, tono "E → G" y diff de letra (`shared/lyricsDiff.ts`), con la advertencia *"La canción cambió después de esta propuesta"* cuando `stale`;
  - Aprobar y Rechazar, con nota opcional. Aprobar manda `seen` con las versiones vistas; un 409 recarga la lista.
  - El Editor ve aquí **"Mis propuestas"**, con su estado y la opción de retirar.
- Create: `mobile/src/screens/Settings.tsx`
  - estado de sincronización y "Sincronizar ahora";
  - para el Líder: código de la iglesia y "Cambiar código"; usuarios (crear con nombre, rol y PIN; cambiar rol; reiniciar PIN; desactivar); compus (lista, "Vincular una compu" con el código de 8 dígitos, "Quitar acceso");
  - "Salir".
- Test: Playwright de punta a punta contra `wrangler dev`, con la iglesia creada por API. Recorrido:
  1. el Líder entra y crea un servicio sin conexión (la red cortada con `context.setOffline`);
  2. recupera la red y el servicio sube;
  3. edita el tono de una canción;
  4. crea un Editor;
  5. el Editor entra en otro contexto, propone una letra y no ve el cambio aplicado;
  6. el Líder aprueba;
  7. la canción cambia.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `npm run mobile:build`.
- [ ] **Step 3:** Prueba de punta a punta.
- [ ] **Step 4:** Commit `feat(mobile): services, songs, proposals and settings screens`.

### Task 4: Despliegue y verificación en producción

- [ ] **Step 1:** `npm run cloud:deploy`, que compila la PWA y despliega el Worker.
- [ ] **Step 2:** Prueba de humo en producción con Playwright (vista de celular):
  - `/` carga la pantalla de entrada;
  - el manifest y el service worker responden;
  - `/api/health` está bien.
  - **No** se crea la iglesia real: lo hace la compu del pastor.
- [ ] **Step 3:** Agregar a `CLAUDE.md` cómo se compila y despliega la PWA. Commit `feat(mobile): deploy PWA with the Worker`.
