# Fase C — Acordes y vista de músicos (ideas, sin diseñar)

> Estado: **solo ideas** capturadas el 2026-11-13. Falta brainstorm y spec. Va después del proyecto B (ALADO conectado).

## La idea

Integrar en una sola fuente las dos letras que se usan en un servicio:

- **La letra de la congregación**: la que ya proyecta ALADO, solo texto.
- **La letra con acordes para los músicos**: la misma canción, con los acordes colocados sobre las sílabas donde cambian.

Los músicos deben poder verla **en tiempo real**, siguiendo la sección que está en pantalla.

## Lo que ya quedó listo (2026-11-13)

- **Tono por canción** (`songs.song_key`, migración `user_version = 4`). Se elige de una lista fija en notación americana (`C`, `F#`, `Bb`, `Em`…, en `src/utils/songKeys.ts`) para que la biblioteca sea coherente y coincida con la notación de los acordes. Se ve en la biblioteca, en el armado del servicio y en el PDF, y viaja en `.alado` y `.wfpack`.
- **PDF de letras para músicos/coristas** (Exportar ▾ → PDF de letras, `electron/setlist/lyricsSheet.ts`). Trae el orden del servicio con tonos y una página por canción. Es el lugar natural para añadir los acordes cuando existan.

## Ideas a resolver en el brainstorm

- **Dónde viven los acordes.** Lo más probable es dentro de cada línea de `sections[].lines`, en formato ChordPro (`[G]Santo, [D/F#]santo`). La proyección para la congregación quitaría los `[...]`. Así hay una sola letra y nunca dos copias que se desincronicen.
- **Captura.** Editor con acordes sobre la letra. Importar desde texto con acordes "encima" (formato de LaCuerda/Ultimate Guitar) y convertirlo a ChordPro.
- **Transposición.** Si la canción está en `G` y se toca en `A`, transponer todos los acordes. ¿El tono del servicio puede ser distinto al tono guardado de la canción (por ejemplo, otra voz líder)?
- **Vista en tiempo real para músicos.** Pantalla/tablet/celular que sigue la sección actual. Encaja con el proyecto B: control y seguimiento por wifi local entre celular y compu.
- **Presentación en celular con acordes** (anotado el 2026-11-19, a pedido del usuario). La vista en vivo del celular de B2 (modos "canción completa" y "ahora + siguiente") debe tener una versión con los acordes sobre cada línea. B2 deja ese espacio reservado.
- **PDF con acordes.** Opción en el mismo exportador: "Letras" (coristas) o "Letras + acordes" (músicos).
- **Notación.** Mostrar los acordes en americano (`C D E`) o latino (`Do Re Mi`) como preferencia de visualización, guardándolos siempre en americano.
