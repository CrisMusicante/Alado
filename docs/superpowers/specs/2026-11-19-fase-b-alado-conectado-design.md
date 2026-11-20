# Fase B — ALADO conectado (diseño)

> Fecha: 2026-11-19 · Rama: `feat/alado-conectado` · Parte del anexo de `2026-10-25-beta-arreglos-servicio-design.md`.
> Marcas: **(usuario)** = lo decidió el usuario · **(mía)** = propuesta/decisión de Claude que el usuario puede corregir.

## Intención

El líder de alabanza (el usuario) prepara el servicio del domingo en el ensayo del sábado, en la iglesia, **muchas veces sin acceso a la compu del pastor**, que es la que proyecta. Hoy eso obliga a esperar al domingo o a cargar archivos `.alado` a mano. Quiere preparar **todo** desde su celular (servicio, letras y tonos) y que el domingo, al abrir ALADO en la compu, todo esté listo **"sí o sí"**. **(usuario)**

Además quiere gobernar quién cambia las canciones: solo él cambia letras y tonos directamente, puede dar permiso de proponer cambios a algunos miembros, y esas propuestas las aprueba o rechaza él. **(usuario)**

Más adelante (B2), controlar o seguir la letra en vivo desde el celular en el atril. **(usuario)**

### Entregas

B se entrega en dos partes, cada una instalable en el templo por separado. La prioridad es preparar desde el celular. **(usuario)** Sin fecha fija. **(usuario)**

- **B1 — Preparar desde el celular** (este documento lo detalla): fallas del templo, selector de videos, nube, cuentas y roles, aprobaciones, app del celular para armar servicios y editar o proponer, sincronización de la compu.
- **B2 — En vivo desde el atril** (decidido en lo esencial, se detalla al empezarla): control y seguimiento por el wifi del templo.

## Objetivos (B1)

1. Desde el celular, con o sin señal, un Líder o Editor arma y guarda servicios, y un Líder edita letras y tonos.
2. Un Editor propone cambios de letra y tono; el Líder los aprueba o rechaza desde su celular.
3. Al abrir ALADO en la compu, se sincroniza sola y avisa claramente si no pudo o si lo que muestra está desactualizado.
4. Lo que se edite en la compu del pastor sube a la nube.
5. Corregir las dos fallas reportadas en el templo con 1.2.0 y agregar el selector de videos precargados.

## No objetivos (B1)

- Control y seguimiento en vivo desde el celular (es B2).
- Subir audio, stems, cues o archivos de video a la nube. Solo viaja el **nombre** del video.
- Varias iglesias. Una sola por ahora, pero sin cerrarle la puerta (ver [[app-name-alado]]): todo lleva `church_id`. **(mía)**
- Notificaciones push. El Líder ve un contador de pendientes al abrir la app. **(mía)**
- Editar el estilo del texto en pantalla, el ajuste de hoja PDF o las carpetas desde el celular. Se sincronizan, pero se editan en la compu. **(mía)**
- Conexión permanente en tiempo real (opción B de la nube; ver Enfoques).

## Anti-objetivos (sería un fracaso aunque "funcione")

- Que el domingo la compu **no tenga el servicio** por depender de la nube. Si no sincroniza, debe decirlo y seguir funcionando con lo último que tenía.
- Que un cambio se **pierda en silencio**, venga de donde venga.
- Que un cambio de un Editor llegue a la pantalla **sin aprobación** del Líder.
- Que la letra cambie **a media proyección** por una sincronización.
- Que ALADO en la compu deje de funcionar sin internet o sin cuenta.
- Usar `alert`/`confirm` nativos en el renderer (regla vigente; usar `src/store/dialog.store.ts`).

## Restricciones y estado actual

- **Escritorio:** Electron + React + SQLite (`better-sqlite3`), DB en `userData`, migraciones por `user_version` (va en 5). Ids `INTEGER AUTOINCREMENT` locales en `songs`, `setlists`, `setlist_items`, `folders`: **no sirven para sincronizar** entre dispositivos.
- `songs.video_path` es una ruta absoluta; los videos precargados viven en `userData/videos/` (copiados por `installSeed`). El `.alado` ya viaja solo con el nombre de archivo (`video_file`).
- `setlist_items.song_id` tiene `ON DELETE RESTRICT`.
- Nube: cuenta Cloudflare lista (`npx wrangler@4 whoami` OK; permisos D1, Workers, Pages). Sin bases D1 todavía. Plan gratuito.
- La compu del pastor tiene internet en el templo ~95 % de las veces. **(usuario)** Celulares y compu están en el **mismo wifi**. **(usuario)**
- Catálogo actual: ~101 canciones, 4 servicios, 2 carpetas.

## Enfoques considerados (nube)

| | Enfoque | A favor | En contra |
|---|---|---|---|
| **A** ⭐ | **D1 + Worker, sincronización por consulta** (al abrir y cada pocos minutos, "dame lo que cambió desde X") | Es lo pedido (sincronizar al abrir, avisar si falló); simple de entender y depurar; cabe en el plan gratuito; coincide con lo acordado el 25-oct | Los cambios tardan lo que tarde la siguiente consulta (minutos) |
| B | Igual, con conexión permanente (Durable Objects + WebSocket) | Cambios instantáneos; serviría de plan B para el control en vivo | Más piezas y más difícil de depurar; lo instantáneo casi no se nota para preparar el sábado |
| C | Servicio de sincronización hecho (Firebase, Supabase) | La parte sin conexión ya viene resuelta | Sale de Cloudflare, otro proveedor y otros precios |

**Elegido: A. (usuario)** **B queda anotada como optimización futura (usuario)**; el diseño de A no debe impedir migrar a B (la API de cambios debe poder empujarse por WebSocket después).

## Diseño B1

### 0. Fallas del templo (1.2.0) — primero

1. **La primera alabanza no se proyecta al iniciar el servicio; arranca desde la segunda.** Sospecha sin verificar: `openLive()` (`src/store/live.store.ts`) resuelve antes de que la ventana live termine de cargar y el primer `live:show-section` se pierde. Investigar con depuración sistemática; el arreglo debe garantizar que la ventana live recibe el estado actual al terminar de cargar (por ejemplo, que `live:open` espere `did-finish-load` o que la ventana live pida el estado al arrancar). Reproducir primero.
2. **En modo "duplicar pantalla" la ventana live tapa la app** y no se puede detener. Causa confirmada en `electron/windows/live.window.ts`: con una sola pantalla abre a tamaño completo, sin marco y `alwaysOnTop` sobre la principal. Comportamiento esperado **(mía)**: si no hay pantalla externa, avisar ("No hay segunda pantalla: revisa que Windows esté en modo Extender") y ofrecer abrir la proyección en una **ventana normal** (con marco, sin `alwaysOnTop`, redimensionable) en lugar de cubrir todo. Además, **Esc** con foco en la ventana live debe cerrar o salir de la proyección, para que nunca quede atrapado.

### 1. Selector de videos precargados (escritorio)

- En el editor de canción, el campo de "Video de fondo" pasa a ser un **selector con miniaturas** de los videos de `userData/videos/` (nombre + cuadro del video), con búsqueda por nombre. Un clic lo asigna. **(usuario: elegir ahí mismo los videos precargados)**
- "Explorar..." se queda para traer un video nuevo. **(mía)** Al elegir uno de fuera, se **copia** a `userData/videos/` para que tenga nombre estable y viaje por nombre. **(mía)** Si ya existe uno con el mismo nombre y distinto contenido, se renombra con sufijo.
- Las miniaturas pueden extraerse como en el exportador PowerPoint (`<video>` + `<canvas>`) y cachearse; lo decide quien construya.

### 2. Cuentas y roles

- **Iglesia:** una, con un **código de iglesia** (corto, legible).
- **Usuarios:** nombre + **PIN personal** que da el Líder. **(mía, aceptada)** Roles **(usuario)**:
  - **Líder:** edita todo directo, aprueba o rechaza propuestas, administra usuarios (crear, cambiar rol, reiniciar PIN, desactivar). **Puede haber más de un Líder**: un Líder nombra a otro desde la app ya desplegada. **(usuario)** No se puede quitar ni desactivar al último Líder activo. **(mía)**
  - **Editor:** arma y edita servicios libremente; **propone** cambios a canciones.
  - **Miembro** (músicos, coristas…): ve canciones y servicios; no cambia nada.
- **Compu del pastor = dispositivo de confianza (mía, aceptada):** lo que se edite en ALADO de escritorio se aplica directo, como el Líder, sin que nadie inicie sesión en ella. No aprueba propuestas ni administra usuarios. **(mía)**
- **Primera vez (mía):** desde la compu del pastor, en Configuración → "ALADO conectado", se crea la iglesia y la cuenta del Líder (nombre + PIN). Esa compu queda vinculada como dispositivo de confianza y **sube su catálogo completo** (canciones, servicios, carpetas) como punto de partida. Si otra compu tiene datos que no están ahí, se llevan antes con `.alado`.
- **Vincular otra compu (mía):** el Líder genera desde su celular un código de vinculación de un solo uso y caducidad corta; se teclea en la compu. Una compu ya con datos que se vincula a una iglesia con catálogo **no sube su catálogo a ciegas**: baja el de la nube y empata por título normalizado (misma comparación que `.alado`). Para cada canción empatada:
  - **Iguales:** se enlazan (la canción local toma el UUID de la nube).
  - **Distintas** (letra, tono, estilo…): se muestra una **pantalla de revisión** con la lista; por omisión gana **la de la nube** y la local se guarda en `userData/backups/` antes de reemplazarla. Por canción se puede elegir "usar la de esta compu", que se sube como cambio normal. Nada se pierde en silencio.
  - **Solo en esta compu:** se suben. **Solo en la nube:** se bajan.
- **Seguridad:** todo permiso se valida en el Worker, nunca solo en la app. PIN guardado con hash lento (PBKDF2 vía WebCrypto) y sal. Bloqueo temporal tras varios intentos fallidos. Sesiones con token de larga duración en el celular (no pedir PIN cada sábado) que el Líder puede revocar al desactivar al usuario. Solo HTTPS. **(mía)**
- **Miembros entran con el código de iglesia**, sin usuario personal: solo ven canciones y servicios. **(usuario)** Un Líder puede **cambiar el código** cuando quiera; al cambiarlo, las sesiones de Miembro con el código viejo se cierran. **(mía)** Editores y Líderes siempre entran con nombre + PIN. El código lleva límite de intentos como el PIN.
- **Recuperación (mía):** al crear la iglesia se genera un **código de recuperación** para imprimir y guardar; permite reiniciar el PIN de un Líder si no queda ningún otro Líder con acceso.

### 3. Modelo de datos y sincronización

**Identidad global.** Cada canción, servicio, elemento de servicio y carpeta lleva un identificador global (UUID) generado donde se crea. En escritorio, migración `user_version = 6` agrega la columna y la llena para lo existente. Los ids enteros locales se quedan para el resto de la app.

**Qué se sincroniza:**

| Dato | Sube y baja | Quién lo edita |
|---|---|---|
| Canción: título, artista, secciones, tono | Sí | Líder y compu directo; Editor por propuesta |
| Canción: video (solo nombre de archivo) | Sí | Líder y compu directo; Editor por propuesta **(mía)** |
| Canción: estilo de texto, ajuste de hoja PDF, carpeta | Sí | Solo compu **(mía)** |
| Canción nueva | Sí | Líder y compu directo; Editor la propone **(mía)** |
| Borrar canción | Sí (como "borrada") | Solo Líder y compu; se rechaza si está en algún servicio (igual que hoy). Si después llega de un dispositivo sin conexión un servicio que la usa, la canción **se restaura** y el Líder recibe un aviso; borrar es reversible del lado de la nube. **(mía)** |
| Servicio (nombre, fecha, notas, orden, video por servicio) | Sí | Líder, Editor y compu, directo **(mía, aceptada)** |
| Carpetas | Sí | Solo compu **(mía)** |
| Audio, stems, cues, archivos de video | **No** | — |

**Mecanismo (enfoque A):**

- La nube asigna a cada cambio aceptado un **número de secuencia** creciente. Cada dispositivo guarda el último número que vio y pide "lo que cambió después de N". Los borrados viajan como marcas de borrado.
- **Canciones: fusión por campo.** Título, artista, secciones, tono, video, estilo, hoja y carpeta se fusionan cada uno por separado: cambiar el tono en el celular y la letra en la compu no choca. Si el **mismo campo** cambió en los dos lados, gana el último en llegar a la nube y el dispositivo cuyo cambio perdió **muestra un aviso** con lo que se reemplazó ("Tu cambio de tono en 'Tu fidelidad' fue reemplazado por uno más reciente de la compu"). Nunca en silencio. Las secciones son un solo campo.
- **Servicios:** el servicio completo (datos + lista ordenada) es una unidad; gana el último y el otro lado recibe el aviso. **(mía)**
- **Sin conexión:** el celular y la compu guardan sus cambios en una **bandeja de salida** y los suben al volver la conexión, en orden.
- Las propuestas no se sincronizan a la compu; solo su resultado una vez aprobado.

### 4. Propuestas y aprobación

- Un Editor edita una canción en el celular igual que un Líder, pero al guardar se crea una **propuesta pendiente** con los campos cambiados y la versión de la canción sobre la que se hizo. La canción no cambia para nadie. **(usuario)**
- Una **canción nueva propuesta** no puede agregarse a un servicio hasta que se apruebe; el celular lo bloquea y explica por qué ("Pendiente de aprobación del líder"). Así ningún servicio apunta a canciones que podrían rechazarse. **(mía)**
- El Editor ve sus propuestas y su estado (pendiente, aprobada, rechazada) y puede retirar una pendiente. **(mía)**
- El Líder tiene una **bandeja de pendientes** con contador. Cada propuesta muestra quién, cuándo y **qué cambió**: tono "E → G", título, y en la letra las líneas modificadas resaltadas por sección. Un toque para **Aprobar** o **Rechazar**, con nota opcional al rechazar. **(mía, aceptada)**
- Si la canción cambió **después** de que se hizo la propuesta, la bandeja lo advierte y muestra la versión actual al lado, para que el Líder decida con lo vigente. **(mía)**
- Varias propuestas sobre la misma canción se ven juntas y el Líder elige. **(mía, aceptada)**
- Aprobar aplica los campos propuestos como un cambio normal del Líder (número de secuencia nuevo); así llega a la compu.

### 5. App del celular

- **Qué es:** una app web instalable (PWA), servida desde Cloudflare Pages en la **dirección gratuita** `*.pages.dev` (por ejemplo `alado.pages.dev`). **(usuario)** Cambiar de dirección después obliga a reinstalar en cada celular; se acepta ese costo si algún día hay dominio propio. Se "agrega a pantalla de inicio" desde el navegador. React + Vite + Tailwind, reutilizando lo que se pueda del escritorio: tipos, `src/utils/lyricsParser.ts`, `src/utils/songKeys.ts`, `KeyBadge`, la vista de letra. **(mía)**
- **Sin conexión:** guarda el catálogo y los servicios en el almacenamiento del navegador y funciona completa sin señal, incluidas las ediciones y propuestas, que esperan en la bandeja de salida. Siempre muestra si está al día o cuándo sincronizó por última vez.
- **Pantallas de B1:**
  - **Entrar:** código de iglesia, nombre, PIN.
  - **Canciones:** buscar, ver la letra con su tono, editar (Líder) o proponer (Editor). Elegir video de una lista de nombres **(mía)**; los videos viven en la compu.
  - **Servicios:** lista por fecha; crear, editar, reordenar arrastrando, agregar canciones del catálogo. Mismo modelo que el escritorio.
  - **Pendientes** (Líder): bandeja de aprobación.
  - **Usuarios** (Líder): crear, cambiar rol, reiniciar PIN, desactivar.
- Diseñada para celular primero (vertical), usable en tablet.

### 6. Sincronización en la compu (escritorio)

- **Al abrir ALADO**, antes que nada, consulta la nube: baja servicios y cambios aprobados y sube lo pendiente. **(usuario)**
- Indicador permanente y discreto: "Sincronizado hace 2 min" ✅. **(mía, aceptada)**
- **Si falla:** aviso visible no bloqueante: "No se pudo sincronizar. Lo que ves es de la última vez: sábado 8:40 p.m.", con **Reintentar**. La app sigue funcionando normal. **(usuario: avisar si no funcionó o si está desactualizada)**
- **Con la app abierta**, consulta cada pocos minutos. Si llega algo nuevo: aviso "Hay cambios nuevos · Actualizar". **(mía, aceptada)**
- **Durante la proyección** (desde que se abre la ventana live hasta que se cierra) **no se aplican cambios al servicio en curso** (nombre, orden, elementos) **ni a sus canciones**; se aplican al cerrar la proyección o con "Actualizar". Los demás cambios se aplican normal. **(mía, aceptada; alcance al servicio completo: mía)**
- Si el borrador del servicio abierto en la compu tiene cambios sin guardar y llega una versión nueva de ese servicio desde la nube, no se pisa: se avisa y se pregunta con `ask`. **(mía)**
- Lo guardado en la compu sube en cuanto se guarda; sin internet, queda en espera. **(usuario)**
- **Video por nombre:** al bajar una canción, su `video_file` se resuelve contra `userData/videos/`. Si no existe en esa compu, la canción usa el fondo por defecto y se marca "video no encontrado" en la biblioteca. **(mía)**
- El `.alado` sigue funcionando igual como respaldo.
- Configuración → "ALADO conectado": estado, iglesia vinculada, sincronizar ahora, desvincular.

### 7. Nube

- Cloudflare Worker (API) + D1 (base) + Pages (app del celular). Plan gratuito.
- La API valida sesión y rol en cada llamada; ningún dato sale sin sesión válida de la iglesia.
- Migraciones de D1 versionadas en el repo. Estructura de carpetas, rutas de la API y nombres los decide quien construya.

## B2 — En vivo desde el atril (decidido, se detalla después)

- **Conexión:** por el wifi del templo, directo celular ↔ compu, sin internet. **(usuario)** La compu muestra un **QR** que se escanea una vez para enlazar. **(usuario)** Plan B si algún wifi aísla dispositivos: relevo por la nube (enfoque B de Durable Objects). **(mía)**
- **Control:** solo **uno** controla a la vez y lo puede pasar. **(usuario)** Por omisión la compu; un Líder o Editor toca "Tomar control"; si lo tiene otro celular, se le pide y lo entrega con un toque; el Líder puede quitarlo sin pedirlo. Siempre se ve quién controla. Si el celular que controla se desconecta, el control vuelve a la compu a los pocos segundos. **(mía, aceptada)**
- **Vistas personalizables por dispositivo (usuario):** ① lo mismo que se proyecta; ② canción completa con la sección actual resaltada y scroll automático; ③ **ahora + siguiente** (recomendada). Barra con título, tono y mapa de secciones (tocar para saltar si se tiene el control). Tamaño de letra y tema por dispositivo. La pantalla no se apaga en vivo. Por omisión ③ para Líder y Editor, ② para Miembros. **(mía, aceptada)**
- **Avanzar:** tocar la pantalla principalmente (mitad derecha avanza, izquierda regresa) **(usuario + mía)** y soporte para **pedal Bluetooth** de pasar página (se comporta como teclado: flechas y avance o retroceso de página). **(usuario)**
- Diseñar ② y ③ dejando espacio para acordes sobre cada línea (fase C). La versión con acordes de la presentación en celular está anotada en `2026-11-13-fase-c-acordes-ideas.md`. **(usuario)**

## Criterios de aceptación (B1)

1. **Sábado sin compu:** el Líder, en su celular **sin señal**, arma un servicio de 6 canciones, cambia el tono de una y corrige una línea de otra. Al recuperar señal sube solo. El domingo, al abrir ALADO en la compu con internet, el servicio aparece listo con el tono y la letra nuevos, y el indicador dice "Sincronizado".
2. **Propuesta:** un Editor propone cambiar la letra de una canción; la canción no cambia en ningún dispositivo hasta que el Líder la aprueba; al aprobarla, llega a la compu en la siguiente sincronización. Una propuesta rechazada no cambia nada.
3. **Sin internet en la compu:** abrir ALADO sin red muestra el aviso con la hora de la última sincronización y la app funciona completa con lo que tenía.
4. **Cambios en la compu:** el pastor corrige una letra en la compu; aparece en el celular del Líder en la siguiente sincronización.
5. **Choque:** el mismo campo cambiado sin conexión en dos lados: gana el último en llegar y el otro lado ve un aviso con lo reemplazado. Campos distintos de la misma canción: se conservan los dos.
6. **Proyección:** un cambio aprobado durante la proyección no altera la letra que se proyecta hasta terminar o pulsar "Actualizar".
7. **Permisos:** un Miembro no puede cambiar nada aunque llame a la API directamente; un Editor no puede aplicar directo ni administrar usuarios.
8. **Fallas del templo:** al iniciar la proyección se ve la primera sección de la primera canción; con la pantalla en "duplicar", la app avisa y nunca queda tapada sin salida.
9. **Videos:** desde el editor se elige un video precargado con miniatura sin escribir rutas.
10. El `.alado` sigue exportando e importando igual.

## Lo que queda a quien construya

- Estructura del repo para el Worker y la PWA (carpetas, workspaces), rutas de la API, esquema exacto de D1 y librerías (por ejemplo, almacenamiento del navegador, service worker).
- El formato de la bandeja de salida y del número de secuencia, respetando la fusión por campo y los avisos.
- Cómo se ven los avisos, la bandeja de pendientes y el diff de letras, coherente con la app (Tailwind, paleta slate/indigo; etiqueta ámbar del tono).
- El intervalo de consulta con la app abierta ("cada pocos minutos").
- Pruebas: la lógica de fusión, permisos y diff va en funciones puras con pruebas en Vitest; la DB de escritorio no se prueba en Vitest (better-sqlite3 compilado para Electron). Las pruebas del Worker con la herramienta que elija.
- El orden de implementación. **Sugerencia:** 0 (fallas) → 1 (videos) → 3 identidad global y migración v6 → 7 + 2 (nube y cuentas) → 6 (sincronización de la compu) → 5 (PWA) → 4 (propuestas). Las fallas y los videos pueden salir solos si hace falta una versión antes.
- Pendientes de seguridad heredados para corregir de paso al tocar ese código: validar `repeat` en `assertSections` y `Number(s.repeat) || 1` en `lyricsSheet.ts`; normalizar `song_key` en `db:save-song`.
