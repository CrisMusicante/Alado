# ALADO

App para proyectar alabanzas en la iglesia: letras sobre video, servicios (listas de canciones), tonos, PDF de letras para los músicos y stems de audio. Desde la versión 1.3.0 incluye **ALADO conectado**: preparas el servicio desde el celular y la compu del templo lo baja sola.

| Pieza | Qué es | Dónde vive |
|---|---|---|
| App de escritorio | Electron + React + SQLite. Proyecta en la pantalla del templo | `electron/`, `src/` |
| Nube | Un Worker de Cloudflare con base D1 (gratis) | `cloud/` → https://alado.mj-cristhian.workers.dev |
| App del celular | Página web instalable (PWA) que funciona sin señal | `mobile/` (se publica junto con la nube) |
| Código compartido | Tipos y reglas de mezcla de cambios | `shared/` |

---

## 1. Instalar en la compu del templo

1. Copia `Alado Setup 1.3.0.exe` a la compu y ábrelo. Si Windows muestra "Windows protegió su PC", da clic en **Más información → Ejecutar de todas formas** (el instalador no está firmado).
2. Si ya tenía ALADO 1.2, **no hay que desinstalar nada**: la 1.3.0 se instala encima y conserva canciones, servicios, videos y ajustes (la base se actualiza sola al abrir). Por precaución, antes de instalar copia la carpeta `%APPDATA%\alado` a la USB: ahí están la base, los videos y los respaldos.
3. Abre ALADO y revisa que estén tus canciones.

> Para llevarlo en USB: copia la carpeta `dist/USB-ALADO-1.3.0/` completa (instalador + `INSTRUCCIONES.txt` con el paso a paso, incluida la prueba de las fallas del templo).

## 2. Crear la iglesia (una sola vez, en la compu del pastor)

1. En ALADO: **Ajustes → ALADO conectado → Crear la iglesia**.
2. Llena:
   - **Nombre de la iglesia**
   - **Tu nombre (líder)**
   - **Tu PIN** (4 a 8 números; con él entras desde el celular)
   - **Clave de instalación**: está en `cloud/.setup-key` en la compu de desarrollo. Sirve una sola vez.
3. Da clic en **Crear y subir catálogo**. La compu sube todas las canciones y servicios a la nube.
4. Aparecen dos códigos. **Anótalos o tómales foto:**
   - **Código de la iglesia** (`XXXX-XXXX`): lo usan todos para entrar desde el celular.
   - **Código de recuperación**: por si olvidas tu PIN.

Desde ese momento, en la barra izquierda verás el indicador: ✅ *Sincronizado hace N min*, ⏸ *Cambios nuevos en espera* (llegaron mientras proyectabas; botón **Actualizar**) o ⚠️ *Sin sincronizar* (botón **Reintentar**). La compu sincroniza al abrir, sube sus cambios cada minuto y baja lo nuevo cada 3 minutos. **Mientras proyectas no aplica cambios que lleguen**: los aplica al terminar la proyección.

## 3. Entrar desde el celular

1. Abre **https://alado.mj-cristhian.workers.dev** en el navegador del celular.
2. Pestaña **Líder o editor** → código de la iglesia, tu nombre y tu PIN → **Entrar**.
3. Agrégala a la pantalla de inicio:
   - **Android (Chrome):** menú ⋮ → *Agregar a pantalla principal* / *Instalar app*.
   - **iPhone (Safari):** botón compartir → *Agregar a inicio*.
4. Funciona sin señal: lo que cambies se guarda en el celular y se sube solo cuando vuelve la conexión.

## 4. Roles

| Rol | Puede |
|---|---|
| **Líder** | Todo: servicios, letras, tonos, aprobar propuestas, dar de alta personas, nombrar a otro líder, vincular compus |
| **Editor** | Armar servicios. Las letras y tonos que cambie quedan como **propuesta** hasta que un líder la apruebe |
| **Miembro** (músicos, coristas) | Solo ver letras y servicios. Entra con la pestaña **Solo ver** y únicamente el código de la iglesia |
| **Compu** | La compu del templo vinculada; edita todo (incluido estilo, PDF y carpetas) |

**Dar de alta personas** (celular del líder): **Ajustes → Personas → Agregar persona** (nombre, PIN y si es editor o líder). Ahí mismo puedes **Hacer líder**, cambiar PIN o desactivar a alguien.

**Cambiar el código de la iglesia** (si se filtró): **Ajustes → Cambiar código**. Los miembros tendrán que entrar con el nuevo.

## 5. Vincular otra compu (por ejemplo la de tu casa)

1. Celular del líder: **Ajustes → Compus → Vincular una compu**. Te da un código de 8 números (dura 10 minutos).
2. En la otra compu: **Ajustes → ALADO conectado → Vincular con código**.
3. Al vincular, se respalda cada canción local y, si choca con la nube, gana la nube.

Para quitarle el acceso a una compu: **Ajustes → Compus → Quitar acceso** desde el celular del líder.

## 6. Flujo de un fin de semana

- **Sábado (celular):** armas el servicio, cambias tonos o letras, apruebas propuestas de los editores. Aunque no haya señal, se guarda y se sube después.
- **Domingo (templo):** abres ALADO en la compu. Al abrir sincroniza y el servicio ya aparece. Si el indicador dice ⚠️ *Sin sincronizar*, da clic en **Reintentar** antes de empezar.

## 7. Si algo falla

| Problema | Qué hacer |
|---|---|
| El indicador dice ⚠️ *Sin sincronizar* | Revisa el internet y da clic en **Reintentar** (o **Ajustes → ALADO conectado → Sincronizar ahora**). Puedes proyectar igual con lo que ya tiene |
| La proyección tapa la app (Windows en modo "Duplicar") | Ya no debería pasar en 1.3.0: con una sola pantalla se abre en ventana normal. Si hace falta, **Esc** cierra la proyección |
| Olvidé mi PIN | Otro líder te lo cambia en **Ajustes → Personas**. Si no hay otro líder, el código de recuperación permite restablecerlo (pídeselo al desarrollador) |
| Un cambio del celular "se descartó" | El celular muestra el motivo (sin permiso, canción borrada, etc.). Vuelve a hacerlo si aplica |
| Dos personas editaron la misma canción | Gana el último cambio en cada campo; a quien le reemplazaron el cambio le llega un aviso |

---

## Para desarrollo

Requisitos: Node 20+, npm, Windows o macOS. Para la nube, una cuenta de Cloudflare con `wrangler` autenticado (`npx wrangler login`).

```bash
npm install          # instala dependencias (recompila better-sqlite3 para Electron)
npm run dev          # app de escritorio con recarga en vivo
npm run test         # pruebas (Vitest): escritorio, nube, celular y shared
npm run lint
```

### Generar el instalador

```bash
npm run build        # compila a out/  (obligatorio: dist:win NO compila)
npm run dist:win     # → dist/Alado Setup <versión>.exe
npm run dist:mac
```

Detalles del icono y del caché de `winCodeSign` en `CLAUDE.md`.

### Nube y celular

```bash
npm run mobile:dev   # app del celular con recarga (redirige /api a :8787)
npm run cloud:dev    # Worker local en :8787 (necesita --var SETUP_KEY:<clave>)
npm run cloud:deploy # compila el celular y publica Worker + PWA
```

- Cambios de esquema: agrega una migración en `cloud/migrations/` y aplica con `npx wrangler d1 migrations apply alado --remote` (desde `cloud/`).
- La clave de instalación es el secreto `SETUP_KEY` del Worker; la copia local está en `cloud/.setup-key` (ignorada por git). Para cambiarla: `npx wrangler secret put SETUP_KEY`.
- **Nunca** llames `/api/setup` contra producción desde pruebas: la iglesia real se crea desde la compu del pastor.
- Para probar la app de escritorio contra la nube local: `ALADO_CLOUD_URL=http://localhost:8787 npm run dev` (solo funciona sin empaquetar).

### Documentación de diseño

- `docs/superpowers/specs/2026-11-19-fase-b-alado-conectado-design.md`: diseño de la fase B.
- `docs/superpowers/b1-decisiones.md`: decisiones tomadas y pendientes menores de B1.
- `docs/superpowers/plans/`: planes de implementación.
- `CLAUDE.md`: arquitectura detallada.

### Hoja de ruta

- **A** (hecha): proyección, servicios, tono, PDF para músicos, stems.
- **B1** (1.3.0): nube, app del celular, sincronización de la compu, propuestas y roles, selector de videos.
- **B2** (pendiente): controlar la proyección en vivo desde el celular por el wifi del templo (QR, pedal, vista "ahora + siguiente").
- **C**: acordes y vista para músicos (incluida una vista con acordes en el celular).
