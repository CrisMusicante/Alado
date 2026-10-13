# Fase 2 — Separación de voz (Demucs), reproducción con cues y paquetes `.wfpack`

**Fecha:** 2026-10-13
**Estado:** Diseño aprobado en conversación; pendiente de revisión del spec escrito.

## 1. Objetivo

Que un operador pueda importar una pista de audio de cualquier canción, separarla con Demucs en **instrumental** y **voz**, reproducirlas desde WorshipFlow con volumen independiente para cada una, y que la letra avance sola según **cues** (marcas de tiempo) que el operador grabó tocando. Así cualquier persona puede cantar la canción sin que se cambie la letra a mano. Las canciones procesadas se pueden exportar a un solo archivo para compartirlas con otras iglesias.

### Uso previsto
- El operador **prepara las canciones antes del servicio**. La separación corre una sola vez y tolera tardar varios minutos.
- Windows y macOS. Equipos normales, sin GPU garantizada. Todo corre en local, sin nube.

### Fuera de alcance de la v1
- Alineación automática de la letra con Whisper (**v1.1**).
- Línea de tiempo con forma de onda.
- Paquetes de **catálogo** y la interfaz para compartir entre iglesias. Solo se deja el formato preparado.
- Modelo `htdemucs_ft`, aceleración por GPU y procesamiento en la nube.
- Cambio de tono o de velocidad de la pista.

## 2. Decisiones fijas

| Tema | Decisión | Motivo |
|---|---|---|
| Resultado | Dos pistas (instrumental, voz) con volumen independiente. Por defecto voz = 0 e instrumental = 100 | Cubre karaoke y voz guía |
| Librería | Fork mantenido `adefossez/demucs` (MIT), **versión fijada**. El repo `facebookresearch/demucs` está archivado desde el 2025-01-01 | El original es solo lectura |
| Modo | `demucs --two-stems=vocals`, modelo `htdemucs` | Más rápido que `htdemucs_ft` (4×) |
| Entrega del runtime | **Motor descargable** en el primer uso, guardado en `userData/audio-engine/` | Instalador ligero y mismo flujo en Windows y Mac |
| Formato de stems | WAV 44.1 kHz estéreo en disco | Evita desfases al sincronizar cues |
| Original | Se conserva junto a los stems | Permite reprocesar sin pedir el archivo de nuevo |
| Cola | Un trabajo a la vez | No saturar la CPU |
| Sincronización | La ventana **principal** reproduce el audio y dirige la letra. La ventana live no reproduce audio | Es donde está el operador |

Rendimiento de referencia: en CPU, Demucs tarda aproximadamente **1.5 × la duración** de la pista.

## 3. Arquitectura

Sigue el patrón existente: `window.api` → IPC (`namespace:action`) → proceso principal.

### 3.1 Motor de audio — `electron/audio/` (proceso principal)
- **Instalador del motor:** descarga Python embebido, PyTorch CPU, Demucs (versión fijada) y el modelo, con verificación de checksum. Reanudable. Muestra tamaño y espacio necesarios antes de empezar.
- **Cola de trabajos:** lanza Demucs como proceso hijo, interpreta su progreso, permite cancelar. Estados por pista: `pending → processing → ready`, o `failed` / `cancelled`.
- **Salida:** `userData/stems/<songId>/{original.*, instrumental.wav, vocals.wav}`.
- **Reinicio de la app durante un trabajo:** al abrir se marca `failed` con motivo "interrumpida" y se ofrece reiniciar. No se retoma a la mitad.
- **Canales IPC invocables:** `audio:engine-status`, `audio:install-engine`, `audio:import-track`, `audio:enqueue`, `audio:cancel`, `audio:get-queue`, `audio:get-song-audio`, `audio:save-cues`, `audio:export-pack`, `audio:import-pack`.
- **Canales de empuje nuevos** (hay que agregarlos a la lista permitida de `window.api.on` en `electron/preload.ts`): `audio:progress`, `audio:status-changed`.

### 3.2 Reproductor — `src/audio/` (renderer, ventana principal)
- Web Audio API: ambas pistas se cargan en memoria (≈80 MB por canción), se arrancan en el mismo instante y cada una pasa por su propio `GainNode`.
- El tiempo actual sale de `AudioContext.currentTime`.
- Controles: reproducir/pausar, salto a cualquier punto, volumen y silencio por pista. El volumen se guarda por canción y existe un volumen general aparte.

### 3.3 Servicio de cues — `src/audio/cueService.ts` (renderer)
- Observa el tiempo del reproductor (intervalo de ~50 ms o `requestAnimationFrame`) y llama a `useLiveStore.goToSection(i)` al cruzar cada cue. No exporta ni modifica `sendSection`, que es privada en `live.store.ts`.
- Un cue no se dispara dos veces seguidas. Al saltar a otro punto, la letra pasa a la sección que corresponde a ese tiempo.

### 3.4 Modelo de datos
Migración **`user_version = 3`** en `electron/db/database.ts` (`runMigrations`), con el mismo patrón que la migración a la versión 2:

```sql
CREATE TABLE IF NOT EXISTS song_audio (
  song_id        INTEGER PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending',
  error          TEXT,
  original_hash  TEXT,
  duration_sec   REAL,
  vol_instrumental REAL NOT NULL DEFAULT 1,
  vol_vocals       REAL NOT NULL DEFAULT 0,
  cues           TEXT NOT NULL DEFAULT '[]',
  cues_sections_sig TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- `cues` es JSON, como `sections`: `[{ "sectionIndex": 0, "time": 12.4 }, ...]`, ordenado por `time`.
- **Una sección puede aparecer en varios cues.** `Section.repeat` es un contador y no una entrada repetida, así que un coro cantado tres veces se representa con tres cues que apuntan al mismo `sectionIndex`.
- `cues_sections_sig` guarda una firma de las secciones al momento de marcar (cantidad y tipos). Si no coincide con las secciones actuales, los cues se muestran como **desactualizados** y no se aplican en vivo.
- Se deserializa en el handler igual que `deserializeSong()`.

Tipos nuevos: se duplican en `electron/ipc/` y `src/store/` siguiendo la convención del proyecto (procesos aislados). Un store nuevo `useAudioStore` en `src/store/`.

## 4. Experiencia del operador

### 4.1 Importar y separar (pestaña **Audio** del editor de canción)
1. Botón "Importar pista" (`mp3`, `wav`, `flac`, `m4a`) usando el diálogo existente de `system:*`. Se copia el archivo y se calcula su hash. Si el hash ya fue procesado, no se repite.
2. **Primera vez:** "Preparar motor de audio", con tamaño de descarga y espacio necesario, barra de progreso, cancelar y reintentar.
3. Separación en segundo plano, con barra de progreso y tiempo estimado. El operador puede seguir usando la app, incluida la ventana live.
4. Al terminar aparece el reproductor con los dos volúmenes y el botón "Marcar cues".

### 4.2 Marcar cues tocando
1. Modo "Marcar": el operador da play y pulsa **Espacio** cuando debe entrar la siguiente sección. La primera pulsación fija el inicio de la sección 1, la siguiente el de la sección 2, y así.
2. Tecla **R** para "repetir la sección actual" (un coro cantado otra vez). Añade un cue con el mismo `sectionIndex`.
3. La pantalla muestra las secciones con la actual resaltada y la siguiente a marcar.
4. Al terminar se guardan los cues. Se puede rehacer todo desde cero.

### 4.3 Edición básica de cues (v1)
- Lista de cues con su tiempo. Ajuste **±0.1 s**, reproducir desde ese punto, borrar.
- "Marcar aquí" inserta o corrige un solo cue.
- **Adelanto configurable** (por defecto 0.3 s) que se resta a todos los cues al reproducir en vivo, para compensar la reacción humana. No altera lo guardado.

### 4.4 Reproducción en vivo
- **El operador siempre manda.** Si pulsa manualmente otra sección, esa tiene prioridad hasta que se cruce el siguiente cue. Se muestra un indicador **Automático / Manual** y un botón para volver a automático.
- Pausar el audio no cambia la letra. Blackout y whiteout funcionan como hoy y no los afecta el reproductor.
- Sin cues: el reproductor funciona igual y la letra se cambia a mano.
- Al cambiar de canción en vivo (`changeSong`), se carga el audio de la nueva canción, si lo tiene.

## 5. Paquetes `.wfpack` (v1: una canción por paquete)

ZIP con extensión propia:

```
cancion.wfpack
├── manifest.json   { packVersion, kind: "song", appVersion, id }
├── song.json       título, artista, sections, text_style, cues, volúmenes
├── audio/          instrumental.flac, vocals.flac
└── video/          opcional (video de fondo)
```

- **Exportar:** los stems se comprimen a **FLAC** (sin pérdida). Se muestra un aviso recordando que compartir audio comercial requiere licencia (por ejemplo CCLI o equivalente); no bloquea la exportación.
- **Importar:** valida `manifest.json` y `packVersion`. Los FLAC se descomprimen a WAV. La canción queda lista sin descargar el motor ni reprocesar.
- **Duplicados** (mismo título y artista, o mismo hash): preguntar si crear copia, reemplazar u omitir.
- **Video:** se copia dentro de la carpeta de la app y se reescribe la ruta, porque las rutas absolutas de otra computadora no sirven.
- **Evolución:** `kind: "catalog"` (varias canciones y carpetas) se añadirá sin romper el formato.

## 6. Errores

| Caso | Comportamiento |
|---|---|
| Sin espacio en disco | Aviso antes de empezar, con estimación |
| Descarga del motor interrumpida | Reanudar o reintentar, verificando checksum |
| Archivo corrupto o formato no soportado | Falla rápido con mensaje claro |
| Demucs termina con error | Se guarda el log recortado en `song_audio.error` y se ofrece reintentar |
| macOS bloquea el binario descargado | Se detecta y se explica qué hacer |
| Se editan las secciones después de marcar cues | Cues marcados como desactualizados; no se aplican en vivo hasta volver a marcar |
| `.wfpack` con versión de formato desconocida | Se rechaza con mensaje claro |

## 7. Pruebas

- **Unitarias (Vitest):** servicio de cues (disparo correcto, saltos, sin repetir, modo manual, `sectionIndex` repetido), parser del progreso de Demucs, migración 2 → 3, validación del manifiesto, firma de secciones.
- **Integración:** motor de audio contra un **ejecutable falso** de Demucs que emite progreso y archivos de prueba (no depende de PyTorch en CI); exportar e importar un `.wfpack` y comprobar que el resultado es idéntico.
- **Manual en Windows y Mac:** instalación del motor, una separación real de una canción corta, reproducción con cues en la ventana live con segundo monitor.

## 8. Riesgos

1. **macOS (Gatekeeper / notarización)** puede bloquear un Python descargado y ejecutado. Hay que probarlo al inicio, antes de construir el resto sobre ese supuesto. Alternativa: binario firmado.
2. **Demucs en modo mantenimiento:** se fija la versión del fork y se cachea el modelo.
3. **Tamaño de la descarga del motor** en conexiones lentas: mostrar tamaño, permitir reanudar y cancelar.
4. **Memoria:** dos WAV en RAM por canción en reproducción. Aceptable para una canción a la vez; se descarga al cambiar de canción.

## 9. Roadmap

- **v1:** motor de audio, reproductor con dos volúmenes, marcar cues tocando con edición básica, `.wfpack` de una canción.
- **v1.1:** alineación automática con Whisper (open source), usando la pista de voz separada para sugerir tiempos que el operador corrige.
- **Después:** línea de tiempo con forma de onda, catálogos compartibles, calidad alta (`htdemucs_ft`), GPU.
