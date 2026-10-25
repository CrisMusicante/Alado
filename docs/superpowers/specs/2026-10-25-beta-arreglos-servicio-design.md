# Beta de ALADO — Proyecto A: servicio, guardado, intercambio de setlists y logo

Fecha: 2026-10-25 · Estado: borrador para aprobación

## Intención

El usuario (tecladista y cantante de su iglesia) probó el `.exe` de la beta en dos compus. Antes de llamarlo MVP necesita que armar y mover un servicio (setlist) sea confiable:

- hoy el setlist en armado **se borra** al ir a la vista de Canciones a revisar una letra;
- el botón **Guardar** "no hace nada": no da señal de haber guardado y no hay manera de llevar un servicio a otra compu;
- el **logo** de ALADO no aparece en la app instalada.

Este proyecto (A) deja la beta usable en la compu de la iglesia. También es la base del proyecto B (nube + celular), que va a reutilizar el formato de archivo de setlist y la lógica de importación.

La app se llama **ALADO** en todo texto visible. "WorshipFlow" es solo el nombre viejo del repo.

## Objetivos

1. El setlist en armado sobrevive al cambio de vista y al cierre de la app.
2. Ver la letra de una canción desde la pantalla de Servicio sin salir de ella.
3. "Guardar" confirma visiblemente y actualiza el servicio cargado en vez de duplicarlo.
4. Exportar un servicio a un archivo e importarlo en otra compu.
5. Exportar un servicio a PowerPoint como respaldo de emergencia.
6. El logo de ALADO en el ejecutable, el instalador, los accesos directos y la barra de tareas.

## No-objetivos (fuera de A)

- Nube, sincronización y app del celular: es el proyecto B, con su propio diseño (ver anexo).
- Exportar el servicio con videos y audios dentro del archivo. Para el audio de una canción ya existe `.wfpack`.
- PowerPoint con estilos por canción, videos o animaciones.
- Agente de IA para importar letras con otros proveedores, como NVIDIA. Queda anotado para el futuro.

## Anti-objetivos (sería un fracaso aunque "funcione")

- Que al importar un servicio se **sobrescriba** una canción que ya existe en esa compu.
- Que importar o exportar se caiga o deje un servicio a medias porque falta un video o un audio.
- Que se pierda el orden de las canciones o la estructura de las secciones.
- Usar `alert`/`confirm` nativos. Están prohibidos en el renderer porque rompen el foco en Electron/Windows; se usan `ask`/`confirmDialog`/`alertDialog` de `src/store/dialog.store.ts`.

## Estado actual (hallazgos)

- `src/App.tsx` monta una página a la vez (`page === 'setlist' && <SetlistPage/>`). `SetlistPage` guarda el setlist en `useState` (`setlistSongs`, `setlistName`), así que se pierde al desmontarse.
- `handleSave` en `src/pages/Setlist/SetlistPage.tsx` sí llama a `db:save-setlist`, pero:
  - no da ninguna confirmación;
  - nunca manda `id`, así que cada clic inserta un servicio nuevo;
  - siempre pone `service_date` = hoy;
  - `loadSetlist` descarta el `id` del servicio cargado;
  - no hay `try/catch`: si falla, el botón se queda en "Guardando...".
- `db:save-setlist` (`electron/ipc/db.handlers.ts`) ya soporta actualizar si recibe `id`.
- `video_path` es una ruta absoluta. Los videos del catálogo embebido se copian a `userData/videos/` al instalar (`installSeed` en `electron/db/database.ts`), así que existen en toda compu instalada con el mismo instalador.
- `electron-builder.yml` tiene `win.signAndEditExecutable: false`. Con eso, electron-builder no ejecuta rcedit sobre el `.exe`, y probablemente por eso el ejecutable y sus accesos directos salen con el ícono de Electron. `assets/icons/icon.ico` es válido (256/48/32/16 px).

## Diseño

### 1. Setlist en armado persistente

- Mover el estado del setlist en armado (canciones con su id local, nombre, fecha, `id` del servicio guardado si lo hay y si tiene cambios sin guardar) a un store de Zustand, por ejemplo `useServiceDraftStore`. `SetlistPage` lo lee de ahí.
- Persistir el borrador para que sobreviva al cierre de la app. **Decisión mía:** se guardan los ids de las canciones, no copias. Al rehidratar, se resuelven contra el catálogo y se descartan en silencio las que ya no existan. El mecanismo de guardado lo decide quien construya: `localStorage` del renderer o `app_settings`.
- "Nuevo servicio" (decisión mía: un botón en la cabecera) limpia el borrador. Si hay cambios sin guardar, pregunta antes con `confirmDialog`.

### 2. Vista previa de letras en Servicio (opción C elegida por el usuario)

- **Biblioteca (columna izquierda):** al dejar el mouse sobre una canción (≈400 ms), aparece una tarjeta flotante junto a ella con el título y las primeras secciones (etiqueta y primeras líneas). El clic sigue agregando la canción como hoy. La tarjeta no debe bloquear el clic ni salirse de la ventana.
- **Setlist (columna derecha):** cada canción tiene un control ▸/▾ que la despliega en su lugar y muestra **todas** sus secciones en orden, con su etiqueta y sus líneas. Desplegar no interfiere con arrastrar para reordenar ni con el clic en modo en vivo.
- Las tarjetas y los despliegues respetan el orden de `sections` y muestran `repeat` si lo hay (por ejemplo "Coro ×2").

### 3. Guardar

- Guardar manda el `id` del servicio cargado o guardado antes: si existe, se actualiza; si no, se crea y su `id` nuevo pasa al borrador.
- Al terminar, un aviso no bloqueante: "Servicio guardado". Si falla, un aviso de error y el botón vuelve a la normalidad (`try/finally`).
- La fecha del servicio se puede editar en la cabecera junto al nombre. Por defecto es hoy.
- Cargar un servicio con cambios sin guardar en el borrador pide confirmación antes.
- **Decisión mía:** mostrar un indicador discreto de "cambios sin guardar".

### 4. Exportar e importar servicio (`.alado`)

**Formato.** Un JSON con extensión `.alado`, legible y versionado, para que el proyecto B lo reutilice:

```json
{
  "format": "alado-setlist",
  "version": 1,
  "exported_at": "2026-10-25T18:00:00Z",
  "setlist": { "name": "...", "service_date": "2026-10-26", "notes": null },
  "items": [
    { "position": 0, "song": { "title": "...", "artist": "...", "sections": [ ... ], "text_style": { ... }, "video_file": "nombre.mp4" }, "custom_video_file": null }
  ]
}
```

- `sections` y `text_style` van tal cual, para conservar etiquetas, líneas, `repeat`, orden y estilo.
- `video_file` es solo el **nombre de archivo** del video, nunca la ruta.
- Audio, cues y videos no viajan en el archivo.

**Exportar.** Botón "Exportar" en la cabecera de Servicio, junto a Guardar. Abre el diálogo nativo de guardar archivo (el diálogo de archivos del sistema sí está permitido; los prohibidos son `alert`/`confirm`). El nombre sugerido es el del servicio. Se puede exportar el borrador aunque no esté guardado.

**Importar.** Botón "Importar" (decisión mía: junto a "Cargar"). Elegir el archivo, validarlo y luego, en una sola transacción:

1. Por cada canción, buscar una existente con el **mismo título** (comparación sin distinguir mayúsculas ni acentos y sin espacios sobrantes; decisión mía). Si hay varias con el mismo título, se prefiere la que también coincide en artista y, si no, la editada más recientemente (decisión mía).
   - **Existe:** se usa la de la compu tal como está. No se toca nada, **aunque su letra o sus secciones sean distintas a las del archivo**: así lo decidió el usuario ("que gane la de la compu"). Hay que comparar `sections` para avisar de estas diferencias en el resumen.
   - **No existe:** se crea con sus secciones y estilo y queda "Sin carpeta".
2. Para las canciones creadas, buscar el video por nombre en `userData/videos/`. Si está, se asigna su ruta local; si no, se queda sin video y usa el fondo por defecto.
3. Crear el servicio guardado con el nombre y la fecha del archivo y cargarlo en el borrador. Si ya existe un servicio guardado con el mismo nombre y fecha, preguntar con `ask` entre "Reemplazar" y "Crear copia" (decisión mía), para que importar dos veces no duplique sin querer.
4. Mostrar un resumen:
   - cuántas canciones se usaron existentes y cuántas se crearon;
   - **cuáles existían con letra distinta** (se usó la de esta compu);
   - cuáles quedaron sin video;
   - cuáles no tienen audio en esta compu.

**Validación.** Rechazar con un mensaje claro un archivo con otro `format`, una `version` mayor a la soportada o una estructura inválida. Un error a medias no deja canciones creadas sueltas (transacción).

**IPC sugerido:** `setlist:export` y `setlist:import`, en un handler nuevo del main process, siguiendo el patrón de `pack.handlers.ts`. La lógica de mapeo, coincidencia de títulos y validación va en funciones puras con pruebas en Vitest. La DB no se prueba en Vitest.

### 5. Exportar a PowerPoint (respaldo)

- Botón "Exportar PowerPoint" (decisión mía: dentro de un menú "Exportar ▾" junto a `.alado`).
- Contenido, en el orden del servicio:
  - una diapositiva de título por canción (título y artista);
  - después, una diapositiva por sección. Si la sección tiene `repeat`, una sola diapositiva con "×N" discreto (decisión mía).
- Formato 16:9. Letra blanca, centrada, grande y con sombra (el formato estándar de la app). Si una sección no cabe, se reduce el tamaño de letra; nunca se corta texto.
- **Fondo:** un cuadro fijo del video de la canción. Se extrae en el renderer con `<video>` + `<canvas>` (buscar el segundo ~1, o el 10 % de la duración si dura menos), se reduce a ≤1280×720, se guarda como JPEG de calidad ~0.7 y se le aplica un oscurecimiento leve (decisión mía) para que la letra se lea. Así no se depende de ffmpeg, que solo existe si se instaló el motor de audio.
- Sin video o si la extracción falla: fondo liso oscuro (decisión mía; el `.pptx` no debe fallar por un video).
- El archivo debe pesar poco: una imagen por canción, reutilizada en todas sus diapositivas.
- Librería: la elige quien construya. `pptxgenjs` es la candidata obvia.

### 6. Logo

- Quitar o cambiar `signAndEditExecutable: false` para que el `.exe` lleve `assets/icons/icon.ico`. Si se dejó así por un problema de firma o de compilación en esta máquina, buscar la alternativa que conserve el ícono, por ejemplo `win.signtoolOptions` sin firmar y rcedit activo.
- Revisar `nsis.installerIcon`, `uninstallerIcon` e `installerHeaderIcon`.
- Verificación real: compilar con `npm run dist:win`, instalar y confirmar el ícono en el instalador, el acceso directo del escritorio, el menú Inicio, la barra de tareas con la app abierta y Agregar/Quitar programas. Si Windows muestra el ícono viejo por caché, anotarlo.

## Criterios de aceptación

- Armar un servicio, ir a Canciones, volver: el servicio sigue igual. Cerrar y abrir la app: el borrador sigue.
- Pasar el mouse sobre una canción de la biblioteca muestra el inicio de su letra. Desplegar una canción del setlist muestra todas sus secciones en orden.
- Guardar dos veces el mismo servicio deja **un** registro y muestra la confirmación ambas veces.
- Exportar en la compu 1 e importar en la compu 2: mismo nombre, fecha y orden de canciones. Las canciones nuevas llegan con sus secciones idénticas. Las que ya existían no se modificaron, y si su letra difería, el resumen lo dice.
- Importar dos veces el mismo archivo pregunta antes de crear un segundo servicio.
- Un archivo inválido o de una versión futura se rechaza con un mensaje y sin efectos secundarios.
- El `.pptx` abre en PowerPoint con fondos de imagen ligeros y la letra legible. Un servicio de unas 6 canciones pesa unos pocos MB como máximo.
- El instalador y la app instalada muestran el logo de ALADO.

## Lo que queda a quien construya

- Nombres de componentes y stores, y el mecanismo de persistencia del borrador.
- El estilo visual de la tarjeta flotante y del despliegue, coherente con el resto de la app (Tailwind, paleta slate/indigo).
- El componente de aviso no bloqueante, si no existe uno.
- La librería para PowerPoint.
- El orden de implementación. **Sugerencia:** 1 → 3 → 2 → 4 → 5 → 6.

## Anexo: proyecto B (decidido hasta ahora, no es parte de A)

Para no perder lo hablado. Tendrá su propio documento de diseño.

- **Uso:** el usuario, en el teclado, con el celular o la tablet en un atril, ve la letra en vivo y puede avanzarla. Alguien del coro también puede hacerlo desde su celular, o solo seguirla si la persona de cabina es quien controla.
- **Preparación:** el sábado, en el ensayo (en la iglesia, en el mismo wifi, pero **sin** la compu de la presentación), arma y guarda el setlist desde el celular. El domingo se conecta a la compu, sube el setlist y controla o sigue la letra.
- **Arquitectura acordada:**
  - nube en Cloudflare (Workers + D1) para el catálogo y los setlists, sincronizados con la compu y los celulares;
  - app del celular como página web instalable servida desde Cloudflare, con copia del catálogo para funcionar sin conexión;
  - el control **en vivo** va por la red local (celular ↔ compu), no por internet;
  - acceso con un código de la iglesia (una sola iglesia por ahora; compartir con otras iglesias se decide después) y un PIN mostrado en la compu para controlar;
  - el archivo `.alado` queda como respaldo.
- **Pendiente:** cuenta de Cloudflare. En esta sesión no había `wrangler` ni conexión a Cloudflare.
- **Futuro:** IA para importar letras con proveedores configurables (por ejemplo NVIDIA), no solo Claude.
