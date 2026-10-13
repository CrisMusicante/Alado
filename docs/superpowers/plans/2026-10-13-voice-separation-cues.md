# Fase 2 — Separación de voz, cues y `.wfpack` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar una pista de audio, separarla con Demucs en instrumental y voz, reproducir ambas con volumen independiente, avanzar la letra en vivo con cues marcados tocando, y exportar/importar la canción como `.wfpack`.

**Architecture:** Un motor Python descargable (Demucs fijado + PyTorch CPU + ffmpeg) vive en `userData/audio-engine/` y se invoca como proceso hijo desde una cola en el proceso principal. El renderer de la ventana principal reproduce los stems con Web Audio y un `CueFollower` puro decide cuándo llamar a `useLiveStore.goToSection`. Toda la lógica decisoria (cues, cola, progreso, paquetes) vive en módulos puros con pruebas en Vitest; IPC y UI son capas delgadas encima.

**Tech Stack:** Electron 40, electron-vite, React 18, Zustand, better-sqlite3, Vitest 4, `fflate` (ZIP), `tar` (extraer Python), Demucs (fork `adefossez/demucs`), PyTorch CPU, `imageio-ffmpeg`.

**Spec:** `docs/superpowers/specs/2026-10-13-voice-separation-cues-design.md`

## Prerrequisito (antes de la Tarea 1)

El árbol de trabajo tiene cambios **sin commitear** de la función de carpetas en archivos que este plan también modifica (`electron/db/database.ts`, `electron/ipc/db.handlers.ts`, `electron/preload.ts`, `src/store/songs.store.ts`, `src/components/SongEditor/SongEditor.tsx`, `src/pages/Songs/SongsPage.tsx`, `CLAUDE.md`). Hay que commitear (o guardar con stash) ese trabajo **antes** de empezar; si no, los commits de este plan mezclarían ambos cambios. Es decisión del dueño del repo; el ejecutor debe preguntar, no decidir.

## Global Constraints

- Demucs: fork `adefossez/demucs`, **versión fijada** en `engine-manifest.json`; modo `--two-stems=vocals`, modelo `htdemucs`. Nunca `htdemucs_ft` en v1.
- Runtime en `userData/audio-engine/`, descargado en el primer uso; el instalador de la app **no** incluye Python ni PyTorch.
- Stems en `userData/stems/<songId>/`: `original.<ext>`, `instrumental.wav`, `vocals.wav` (o `.flac` si vinieron de un `.wfpack`).
- Formatos de entrada aceptados: `mp3`, `wav`, `flac`, `m4a`.
- Un solo trabajo de separación a la vez.
- Estados de pista: `pending`, `processing`, `ready`, `failed`, `cancelled`.
- Volumen por defecto: instrumental `1`, voz `0`. Adelanto de cues por defecto: `0.3` s. Ajuste fino de cue: `±0.1` s.
- La ventana live **no** reproduce audio; solo la ventana principal.
- Migración de base de datos: `user_version = 3`.
- Nuevos canales de empuje (`audio:progress`, `audio:status-changed`, `audio:engine-progress`) se agregan a la lista permitida de `window.api.on` en `electron/preload.ts`.
- Tipos duplicados a propósito entre `electron/` y `src/` (aislamiento de procesos, ver `CLAUDE.md`).
- Textos de UI en español, con el estilo Tailwind existente (`bg-slate-800`, `border-slate-700`, `rounded-xl`, acento `indigo-600`).
- Commits: solo `git add` de los archivos listados en la tarea. Si `git commit` falla por identidad, usar la del repo: `git -c user.name="CrisMusicante" -c user.email="mj.cristhian@gmail.com" commit ...`. Terminar cada mensaje con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Desviaciones conscientes respecto al spec

1. **Migración sin prueba unitaria:** `better-sqlite3` se compila para el ABI de Electron (`postinstall`), así que no carga bajo Vitest en Node. La migración se verifica manualmente en la Tarea 4.
2. **Al importar un `.wfpack` los stems se quedan en FLAC** (no se descomprimen a WAV). Chromium decodifica FLAC con `decodeAudioData`, y así una máquina que solo importa paquetes no necesita el motor ni ffmpeg.
3. **Sección "Audio" en el editor** en lugar de una pestaña: `SongEditor.tsx` es una sola página con scroll, sin pestañas.
4. **Sin volumen general propio en v1:** el spec menciona un volumen general aparte del de cada pista; se usa el volumen del sistema o de la consola de sonido. Se agrega si en las pruebas con iglesias hace falta.
5. **Tiempo estimado como texto** ("≈1.5× la duración de la canción") en lugar de una cuenta regresiva: la duración real no se conoce hasta decodificar el audio.
6. **Marcar cues:** además de Espacio (siguiente) y R (repetir actual), hacer clic en una sección durante la grabación marca esa sección. Es necesario para el patrón verso → coro → verso → coro, donde el coro vuelve después de otra sección.

## Review Focus

1. **Paquete `.wfpack` malicioso con rutas `../`** (zip-slip): se debe rechazar sin escribir nada fuera de la carpeta de la canción → prueba en Tarea 9.
2. **Rutas con espacios y acentos** (`C:\Users\José\Mis canciones\…`) al lanzar Demucs → prueba en Tarea 2 con un directorio `con espacios ñ`.
3. **Canción borrada mientras se procesa:** el trabajo se cancela y no deja estado colgado → prueba de cancelación en Tarea 2 + `purgeSongAudio` en Tarea 5.
4. **Secciones editadas después de marcar cues:** los cues quedan desactualizados y no mueven la letra en vivo → prueba en Tarea 1 y verificación en Tarea 7.
5. **Archivo corrupto o Demucs falla:** la pista queda `failed` con un mensaje legible (últimas líneas del log), nunca en `processing` para siempre → prueba en Tarea 2.

---

### Task 1: Infraestructura de pruebas + lógica pura de cues

**Files:**
- Create: `vitest.config.ts`
- Create: `src/audio/cues.ts`
- Test: `src/audio/cues.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface Cue { sectionIndex: number; time: number }`
  - `sectionsSignature(sections: { type: string }[]): string`
  - `cuesAreStale(cues: Cue[], savedSig: string | null, sections: { type: string }[]): boolean`
  - `sortCues(cues: Cue[]): Cue[]`
  - `cuePositionAt(cues: Cue[], time: number, lead?: number): number`
  - `sectionIndexAt(cues: Cue[], time: number, lead?: number): number | null`
  - `nudgeCue(cues: Cue[], index: number, delta: number): Cue[]`
  - `removeCue(cues: Cue[], index: number): Cue[]`
  - `upsertCueAt(cues: Cue[], sectionIndex: number, time: number): Cue[]`
  - `class CueRecorder { constructor(sectionCount: number); nextSection: number | null; result: Cue[]; tap(time): Cue | null; repeat(time): Cue | null; mark(sectionIndex, time): Cue }`
  - `class CueFollower { constructor(cues: Cue[], lead?: number); isManual: boolean; update(time): number | null; seek(time): number | null; markManual(): void; resumeAuto(time): number | null }`

- [ ] **Step 1: Configurar Vitest**

Crear `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts']
  }
})
```

- [ ] **Step 2: Escribir las pruebas que fallan**

Crear `src/audio/cues.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  Cue, sectionsSignature, cuesAreStale, sectionIndexAt, cuePositionAt,
  nudgeCue, removeCue, upsertCueAt, CueRecorder, CueFollower
} from './cues'

const cues: Cue[] = [
  { sectionIndex: 0, time: 10 },
  { sectionIndex: 1, time: 30 },
  { sectionIndex: 2, time: 50 },
  { sectionIndex: 1, time: 70 } // coro repetido
]

describe('sectionsSignature / cuesAreStale', () => {
  const sections = [{ type: 'verse' }, { type: 'chorus' }]
  it('builds a signature from count and types', () => {
    expect(sectionsSignature(sections)).toBe('2:verse,chorus')
  })
  it('is stale when sections changed after marking', () => {
    expect(cuesAreStale(cues, '2:verse,chorus', [...sections, { type: 'bridge' }])).toBe(true)
  })
  it('is not stale when signature matches', () => {
    expect(cuesAreStale(cues, '2:verse,chorus', sections)).toBe(false)
  })
  it('empty cues are never stale', () => {
    expect(cuesAreStale([], null, sections)).toBe(false)
  })
})

describe('sectionIndexAt', () => {
  it('returns null before the first cue', () => {
    expect(sectionIndexAt(cues, 5)).toBeNull()
  })
  it('returns the last crossed cue', () => {
    expect(sectionIndexAt(cues, 10)).toBe(0)
    expect(sectionIndexAt(cues, 45)).toBe(1)
    expect(sectionIndexAt(cues, 75)).toBe(1)
  })
  it('applies lead (fires earlier)', () => {
    expect(sectionIndexAt(cues, 29.8, 0.3)).toBe(1)
    expect(cuePositionAt(cues, 29.6, 0.3)).toBe(0)
  })
})

describe('editing helpers', () => {
  it('nudges without float noise and keeps order', () => {
    const out = nudgeCue(cues, 1, 0.1)
    expect(out[1].time).toBe(30.1)
  })
  it('nudge never goes below zero and re-sorts', () => {
    const out = nudgeCue([{ sectionIndex: 0, time: 0.05 }, { sectionIndex: 1, time: 0.1 }], 1, -1)
    expect(out.map(c => c.time)).toEqual([0, 0.05])
  })
  it('removes a cue', () => {
    expect(removeCue(cues, 0)).toHaveLength(3)
  })
  it('upsert replaces the single cue of that section', () => {
    const out = upsertCueAt(cues, 2, 52)
    expect(out.filter(c => c.sectionIndex === 2)).toEqual([{ sectionIndex: 2, time: 52 }])
  })
  it('upsert inserts when the section has 0 or several cues', () => {
    expect(upsertCueAt(cues, 1, 90)).toHaveLength(5)
    expect(upsertCueAt(cues, 3, 80)).toHaveLength(5)
  })
})

describe('CueRecorder', () => {
  it('taps advance through sections', () => {
    const r = new CueRecorder(3)
    r.tap(1); r.tap(2); r.tap(3)
    expect(r.result.map(c => c.sectionIndex)).toEqual([0, 1, 2])
    expect(r.nextSection).toBeNull()
    expect(r.tap(4)).toBeNull()
  })
  it('repeat re-marks the last section', () => {
    const r = new CueRecorder(3)
    r.tap(1); r.tap(2); r.repeat(3)
    expect(r.result.map(c => c.sectionIndex)).toEqual([0, 1, 1])
    expect(r.nextSection).toBe(2)
  })
  it('repeat before any tap does nothing', () => {
    expect(new CueRecorder(3).repeat(1)).toBeNull()
  })
  it('mark jumps to any section and continues after it', () => {
    const r = new CueRecorder(3)
    r.tap(1); r.tap(2); r.tap(3); r.mark(1, 4)
    expect(r.result.map(c => c.sectionIndex)).toEqual([0, 1, 2, 1])
    expect(r.nextSection).toBe(2)
  })
})

describe('CueFollower', () => {
  it('fires once per crossed cue', () => {
    const f = new CueFollower(cues)
    expect(f.update(5)).toBeNull()
    expect(f.update(10)).toBe(0)
    expect(f.update(11)).toBeNull()
    expect(f.update(30)).toBe(1)
  })
  it('fires again for a repeated section (new cue position)', () => {
    const f = new CueFollower(cues)
    f.update(50)
    expect(f.update(70)).toBe(1)
  })
  it('manual mode holds until the next cue is crossed', () => {
    const f = new CueFollower(cues)
    f.update(31)
    f.markManual()
    expect(f.isManual).toBe(true)
    expect(f.update(40)).toBeNull()
    expect(f.update(50)).toBe(2)
    expect(f.isManual).toBe(false)
  })
  it('seek jumps to the matching section and leaves manual mode', () => {
    const f = new CueFollower(cues)
    f.update(60)
    f.markManual()
    expect(f.seek(15)).toBe(0)
    expect(f.isManual).toBe(false)
  })
  it('seek before the first cue returns null', () => {
    const f = new CueFollower(cues)
    f.update(40)
    expect(f.seek(1)).toBeNull()
    expect(f.update(10)).toBe(0)
  })
  it('resumeAuto returns the section for the current time', () => {
    const f = new CueFollower(cues)
    f.update(40)
    f.markManual()
    expect(f.resumeAuto(40)).toBe(1)
    expect(f.isManual).toBe(false)
  })
  it('pausing (no time change) never re-fires', () => {
    const f = new CueFollower(cues)
    f.update(30)
    expect(f.update(30)).toBeNull()
    expect(f.update(30)).toBeNull()
  })
})
```

- [ ] **Step 3: Correr las pruebas y verificar que fallan**

Run: `npx vitest run src/audio/cues.test.ts`
Expected: FAIL, `Failed to resolve import "./cues"`.

- [ ] **Step 4: Implementar `src/audio/cues.ts`**

```ts
export interface Cue {
  sectionIndex: number
  time: number
}

const round = (t: number): number => Math.round(t * 1000) / 1000

export function sectionsSignature(sections: { type: string }[]): string {
  return `${sections.length}:${sections.map(s => s.type).join(',')}`
}

export function cuesAreStale(cues: Cue[], savedSig: string | null, sections: { type: string }[]): boolean {
  if (cues.length === 0) return false
  return savedSig !== sectionsSignature(sections)
}

export function sortCues(cues: Cue[]): Cue[] {
  return [...cues].sort((a, b) => a.time - b.time)
}

/** Index (into sorted cues) of the last cue whose effective time is <= time, or -1. */
export function cuePositionAt(cues: Cue[], time: number, lead = 0): number {
  let pos = -1
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].time - lead <= time + 1e-9) pos = i
    else break
  }
  return pos
}

export function sectionIndexAt(cues: Cue[], time: number, lead = 0): number | null {
  const pos = cuePositionAt(cues, time, lead)
  return pos < 0 ? null : cues[pos].sectionIndex
}

export function nudgeCue(cues: Cue[], index: number, delta: number): Cue[] {
  return sortCues(cues.map((c, i) =>
    i === index ? { ...c, time: Math.max(0, round(c.time + delta)) } : c))
}

export function removeCue(cues: Cue[], index: number): Cue[] {
  return cues.filter((_, i) => i !== index)
}

/** Replace the cue of `sectionIndex` if it has exactly one; otherwise insert a new cue. */
export function upsertCueAt(cues: Cue[], sectionIndex: number, time: number): Cue[] {
  const matches = cues.filter(c => c.sectionIndex === sectionIndex)
  if (matches.length === 1) {
    return sortCues(cues.map(c => c === matches[0] ? { sectionIndex, time: round(time) } : c))
  }
  return sortCues([...cues, { sectionIndex, time: round(time) }])
}

export class CueRecorder {
  private cues: Cue[] = []
  private next = 0
  private last = -1

  constructor(private readonly sectionCount: number) {}

  get nextSection(): number | null {
    return this.next < this.sectionCount ? this.next : null
  }

  get result(): Cue[] {
    return sortCues(this.cues)
  }

  tap(time: number): Cue | null {
    if (this.next >= this.sectionCount) return null
    return this.mark(this.next, time)
  }

  repeat(time: number): Cue | null {
    if (this.last < 0) return null
    const cue = { sectionIndex: this.last, time: round(time) }
    this.cues.push(cue)
    return cue
  }

  mark(sectionIndex: number, time: number): Cue {
    const cue = { sectionIndex, time: round(time) }
    this.cues.push(cue)
    this.last = sectionIndex
    this.next = sectionIndex + 1
    return cue
  }
}

export class CueFollower {
  private readonly cues: Cue[]
  private pos = -1
  private manual = false

  constructor(cues: Cue[], private readonly lead = 0) {
    this.cues = sortCues(cues)
  }

  get isManual(): boolean {
    return this.manual
  }

  /** Returns the section to show when a new cue is crossed, else null. */
  update(time: number): number | null {
    const pos = cuePositionAt(this.cues, time, this.lead)
    if (pos === this.pos) return null
    this.pos = pos
    if (pos < 0) return null
    this.manual = false
    return this.cues[pos].sectionIndex
  }

  seek(time: number): number | null {
    this.manual = false
    this.pos = -2
    return this.update(time)
  }

  markManual(): void {
    this.manual = true
  }

  resumeAuto(time: number): number | null {
    this.manual = false
    this.pos = cuePositionAt(this.cues, time, this.lead)
    return this.pos < 0 ? null : this.cues[this.pos].sectionIndex
  }
}
```

- [ ] **Step 5: Correr las pruebas y verificar que pasan**

Run: `npx vitest run src/audio/cues.test.ts`
Expected: PASS, todas las pruebas.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/audio/cues.ts src/audio/cues.test.ts
git commit -m "feat(audio): pure cue model, recorder and follower with tests"
```

---

### Task 2: Progreso de Demucs, cola de separación y runner

**Files:**
- Create: `electron/audio/types.ts`
- Create: `electron/audio/progress.ts`
- Create: `electron/audio/queue.ts`
- Create: `electron/audio/demucsRunner.ts`
- Create: `electron/audio/__fixtures__/fake-demucs.cjs`
- Test: `electron/audio/progress.test.ts`, `electron/audio/queue.test.ts`, `electron/audio/demucsRunner.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `electron/audio/types.ts`: `type AudioStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'cancelled'`; `interface Job { songId: number; inputPath: string; outDir: string }`; `interface Cue { sectionIndex: number; time: number }`.
  - `parseDemucsProgress(chunk: string): number | null`
  - `type RunFn = (job: Job, onProgress: (pct: number) => void, signal: AbortSignal) => Promise<void>`
  - `interface QueueEvents { onStatus(songId: number, status: AudioStatus, error?: string): void; onProgress(songId: number, pct: number): void }`
  - `class SeparationQueue { constructor(run: RunFn, events: QueueEvents); enqueue(job: Job): void; cancel(songId: number): void; snapshot(): { songId: number; status: AudioStatus; progress: number }[] }`
  - `interface DemucsCommand { file: string; baseArgs: string[]; env?: NodeJS.ProcessEnv }`
  - `buildDemucsArgs(input: string, outRoot: string): string[]`
  - `runDemucs(cmd: DemucsCommand, job: Job, onProgress: (pct: number) => void, signal: AbortSignal): Promise<void>` — al terminar deja `instrumental.wav` y `vocals.wav` en `job.outDir`.

- [ ] **Step 1: Tipos compartidos del proceso principal**

Crear `electron/audio/types.ts`:

```ts
export type AudioStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'cancelled'

export interface Job {
  songId: number
  inputPath: string
  outDir: string
}

export interface Cue {
  sectionIndex: number
  time: number
}
```

- [ ] **Step 2: Pruebas del parser de progreso (fallan)**

Crear `electron/audio/progress.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseDemucsProgress } from './progress'

describe('parseDemucsProgress', () => {
  it('reads a tqdm percentage', () => {
    expect(parseDemucsProgress(' 45%|████▌     | 121.5/270.0 [00:20<00:25,  5.9seconds/s]')).toBe(45)
  })
  it('takes the last value of a chunk with several \\r updates', () => {
    expect(parseDemucsProgress('  3%|▎ | 8/270\r 10%|█ | 27/270\r')).toBe(10)
  })
  it('returns null for unrelated output', () => {
    expect(parseDemucsProgress('Separated tracks will be stored in /tmp/htdemucs')).toBeNull()
  })
  it('caps at 100', () => {
    expect(parseDemucsProgress('100%|██████████| 270.0/270.0')).toBe(100)
  })
})
```

Run: `npx vitest run electron/audio/progress.test.ts`
Expected: FAIL, no se resuelve `./progress`.

- [ ] **Step 3: Implementar `electron/audio/progress.ts`**

```ts
/** Demucs reports progress with tqdm on stderr: " 45%|████ | 121/270 [...]". */
export function parseDemucsProgress(chunk: string): number | null {
  const matches = [...chunk.matchAll(/(\d{1,3})%\|/g)]
  if (matches.length === 0) return null
  return Math.min(100, Number(matches[matches.length - 1][1]))
}
```

Run: `npx vitest run electron/audio/progress.test.ts`
Expected: PASS.

- [ ] **Step 4: Pruebas de la cola (fallan)**

Crear `electron/audio/queue.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { SeparationQueue, RunFn } from './queue'
import { Job } from './types'

const job = (songId: number): Job => ({ songId, inputPath: `/in/${songId}.mp3`, outDir: `/out/${songId}` })
const flush = () => new Promise(r => setTimeout(r, 0))

function deferredRun() {
  const pending = new Map<number, { resolve: () => void; reject: (e: Error) => void; signal: AbortSignal; progress: (p: number) => void }>()
  const run: RunFn = (j, onProgress, signal) => new Promise<void>((resolve, reject) => {
    pending.set(j.songId, { resolve, reject, signal, progress: onProgress })
    signal.addEventListener('abort', () => reject(new Error('aborted')))
  })
  return { run, pending }
}

describe('SeparationQueue', () => {
  it('runs one job at a time in order', async () => {
    const { run, pending } = deferredRun()
    const onStatus = vi.fn()
    const q = new SeparationQueue(run, { onStatus, onProgress: vi.fn() })
    q.enqueue(job(1)); q.enqueue(job(2))
    await flush()
    expect([...pending.keys()]).toEqual([1])
    expect(q.snapshot().map(s => s.status)).toEqual(['processing', 'pending'])
    pending.get(1)!.resolve(); await flush()
    expect([...pending.keys()]).toEqual([1, 2])
    expect(onStatus).toHaveBeenCalledWith(1, 'ready')
  })

  it('reports progress', async () => {
    const { run, pending } = deferredRun()
    const onProgress = vi.fn()
    const q = new SeparationQueue(run, { onStatus: vi.fn(), onProgress })
    q.enqueue(job(1)); await flush()
    pending.get(1)!.progress(40)
    expect(onProgress).toHaveBeenCalledWith(1, 40)
    expect(q.snapshot()[0].progress).toBe(40)
  })

  it('marks failure with the error message and continues', async () => {
    const { run, pending } = deferredRun()
    const onStatus = vi.fn()
    const q = new SeparationQueue(run, { onStatus, onProgress: vi.fn() })
    q.enqueue(job(1)); q.enqueue(job(2)); await flush()
    pending.get(1)!.reject(new Error('Demucs terminó con código 1: archivo inválido'))
    await flush()
    expect(onStatus).toHaveBeenCalledWith(1, 'failed', 'Demucs terminó con código 1: archivo inválido')
    expect(pending.has(2)).toBe(true)
  })

  it('cancels a pending job without running it', async () => {
    const { run, pending } = deferredRun()
    const onStatus = vi.fn()
    const q = new SeparationQueue(run, { onStatus, onProgress: vi.fn() })
    q.enqueue(job(1)); q.enqueue(job(2)); await flush()
    q.cancel(2)
    pending.get(1)!.resolve(); await flush()
    expect(pending.has(2)).toBe(false)
    expect(onStatus).toHaveBeenCalledWith(2, 'cancelled')
  })

  it('cancels the running job via AbortSignal (e.g. song deleted)', async () => {
    const { run, pending } = deferredRun()
    const onStatus = vi.fn()
    const q = new SeparationQueue(run, { onStatus, onProgress: vi.fn() })
    q.enqueue(job(1)); await flush()
    q.cancel(1); await flush()
    expect(pending.get(1)!.signal.aborted).toBe(true)
    expect(onStatus).toHaveBeenCalledWith(1, 'cancelled')
    expect(q.snapshot()[0].status).toBe('cancelled')
  })

  it('ignores a duplicate enqueue while pending/processing', async () => {
    const { run } = deferredRun()
    const q = new SeparationQueue(run, { onStatus: vi.fn(), onProgress: vi.fn() })
    q.enqueue(job(1)); q.enqueue(job(1)); await flush()
    expect(q.snapshot()).toHaveLength(1)
  })
})
```

Run: `npx vitest run electron/audio/queue.test.ts`
Expected: FAIL, no se resuelve `./queue`.

- [ ] **Step 5: Implementar `electron/audio/queue.ts`**

```ts
import { AudioStatus, Job } from './types'

export type RunFn = (job: Job, onProgress: (pct: number) => void, signal: AbortSignal) => Promise<void>

export interface QueueEvents {
  onStatus: (songId: number, status: AudioStatus, error?: string) => void
  onProgress: (songId: number, pct: number) => void
}

interface Entry {
  job: Job
  status: AudioStatus
  progress: number
}

export class SeparationQueue {
  private entries: Entry[] = []
  private current: { songId: number; abort: AbortController } | null = null
  private running = false

  constructor(private readonly run: RunFn, private readonly events: QueueEvents) {}

  enqueue(job: Job): void {
    const active = this.entries.some(e =>
      e.job.songId === job.songId && (e.status === 'pending' || e.status === 'processing'))
    if (active) return
    this.entries = this.entries.filter(e => e.job.songId !== job.songId)
    this.entries.push({ job, status: 'pending', progress: 0 })
    this.events.onStatus(job.songId, 'pending')
    void this.drain()
  }

  cancel(songId: number): void {
    const entry = this.entries.find(e => e.job.songId === songId)
    if (!entry) return
    if (entry.status === 'pending') {
      entry.status = 'cancelled'
      this.events.onStatus(songId, 'cancelled')
    } else if (entry.status === 'processing' && this.current?.songId === songId) {
      this.current.abort.abort()
    }
  }

  snapshot(): { songId: number; status: AudioStatus; progress: number }[] {
    return this.entries.map(e => ({ songId: e.job.songId, status: e.status, progress: e.progress }))
  }

  private async drain(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      for (;;) {
        const entry = this.entries.find(e => e.status === 'pending')
        if (!entry) break
        const { songId } = entry.job
        const abort = new AbortController()
        this.current = { songId, abort }
        entry.status = 'processing'
        this.events.onStatus(songId, 'processing')
        try {
          await this.run(entry.job, pct => {
            entry.progress = pct
            this.events.onProgress(songId, pct)
          }, abort.signal)
          entry.status = 'ready'
          entry.progress = 100
          this.events.onStatus(songId, 'ready')
        } catch (e) {
          if (abort.signal.aborted) {
            entry.status = 'cancelled'
            this.events.onStatus(songId, 'cancelled')
          } else {
            entry.status = 'failed'
            this.events.onStatus(songId, 'failed', e instanceof Error ? e.message : String(e))
          }
        } finally {
          this.current = null
        }
      }
    } finally {
      this.running = false
    }
  }
}
```

Run: `npx vitest run electron/audio/queue.test.ts`
Expected: PASS.

- [ ] **Step 6: Demucs falso para pruebas**

Crear `electron/audio/__fixtures__/fake-demucs.cjs` (imita la CLI: lee `-o` y el archivo de entrada, emite progreso tqdm por stderr y escribe la estructura de salida de Demucs):

```js
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const outRoot = args[args.indexOf('-o') + 1]
const input = args[args.length - 1]

if (process.env.FAKE_DEMUCS_FAIL === '1') {
  process.stderr.write('Traceback (most recent call last):\nRuntimeError: Could not load file ' + input + '\n')
  process.exit(1)
}
if (!fs.existsSync(input)) {
  process.stderr.write('FileNotFoundError: ' + input + '\n')
  process.exit(1)
}

for (const pct of [0, 25, 50, 75, 100]) process.stderr.write(` ${pct}%|█ | ${pct}/100 [00:01<00:01]\r`)

const track = path.parse(input).name
const dir = path.join(outRoot, 'htdemucs', track)
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'vocals.wav'), 'VOCALS')
fs.writeFileSync(path.join(dir, 'no_vocals.wav'), 'INSTRUMENTAL')

if (process.env.FAKE_DEMUCS_HANG === '1') setInterval(() => {}, 1000)
```

- [ ] **Step 7: Pruebas del runner (fallan)**

Crear `electron/audio/demucsRunner.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { buildDemucsArgs, runDemucs, DemucsCommand } from './demucsRunner'

const fake = path.join(__dirname, '__fixtures__', 'fake-demucs.cjs')
const cmd = (env: NodeJS.ProcessEnv = {}): DemucsCommand => ({ file: process.execPath, baseArgs: [fake], env })

let outDir: string
let input: string
beforeEach(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-'))
  outDir = path.join(base, 'con espacios ñ', '12') // Review Focus #2
  fs.mkdirSync(outDir, { recursive: true })
  input = path.join(outDir, 'original.mp3')
  fs.writeFileSync(input, 'MP3')
})

describe('buildDemucsArgs', () => {
  it('uses two-stems vocals with htdemucs', () => {
    expect(buildDemucsArgs('/a/original.mp3', '/a/.tmp')).toEqual(
      ['--two-stems=vocals', '-n', 'htdemucs', '-o', '/a/.tmp', '/a/original.mp3'])
  })
})

describe('runDemucs', () => {
  it('produces instrumental.wav and vocals.wav and reports progress', async () => {
    const seen: number[] = []
    await runDemucs(cmd(), { songId: 12, inputPath: input, outDir }, p => seen.push(p), new AbortController().signal)
    expect(fs.readFileSync(path.join(outDir, 'instrumental.wav'), 'utf8')).toBe('INSTRUMENTAL')
    expect(fs.readFileSync(path.join(outDir, 'vocals.wav'), 'utf8')).toBe('VOCALS')
    expect(seen.at(-1)).toBe(100)
    expect(fs.existsSync(path.join(outDir, '.tmp-demucs'))).toBe(false)
  })

  it('rejects with the tail of stderr when Demucs fails', async () => { // Review Focus #5
    await expect(runDemucs(cmd({ FAKE_DEMUCS_FAIL: '1' }), { songId: 12, inputPath: input, outDir }, () => {}, new AbortController().signal))
      .rejects.toThrow(/código 1.*Could not load file/)
    expect(fs.existsSync(path.join(outDir, 'vocals.wav'))).toBe(false)
  })

  it('kills the process on abort', async () => {
    const abort = new AbortController()
    const p = runDemucs(cmd({ FAKE_DEMUCS_HANG: '1' }), { songId: 12, inputPath: input, outDir }, () => {}, abort.signal)
    setTimeout(() => abort.abort(), 200)
    await expect(p).rejects.toThrow()
  })

  it('rejects immediately when already aborted', async () => {
    const abort = new AbortController(); abort.abort()
    await expect(runDemucs(cmd(), { songId: 12, inputPath: input, outDir }, () => {}, abort.signal)).rejects.toThrow('cancelado')
  })
})
```

Run: `npx vitest run electron/audio/demucsRunner.test.ts`
Expected: FAIL, no se resuelve `./demucsRunner`.

- [ ] **Step 8: Implementar `electron/audio/demucsRunner.ts`**

```ts
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { parseDemucsProgress } from './progress'
import { Job } from './types'

export interface DemucsCommand {
  file: string
  baseArgs: string[]
  env?: NodeJS.ProcessEnv
}

export function buildDemucsArgs(input: string, outRoot: string): string[] {
  return ['--two-stems=vocals', '-n', 'htdemucs', '-o', outRoot, input]
}

export async function runDemucs(
  cmd: DemucsCommand,
  job: Job,
  onProgress: (pct: number) => void,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) throw new Error('Trabajo cancelado')
  const outRoot = path.join(job.outDir, '.tmp-demucs')
  await fs.rm(outRoot, { recursive: true, force: true })
  await fs.mkdir(outRoot, { recursive: true })

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(cmd.file, [...cmd.baseArgs, ...buildDemucsArgs(job.inputPath, outRoot)], {
        env: { ...process.env, ...cmd.env },
        windowsHide: true
      })
      let tail = ''
      child.stderr.on('data', (d: Buffer) => {
        const s = d.toString()
        tail = (tail + s).slice(-4000)
        const pct = parseDemucsProgress(s)
        if (pct !== null) onProgress(pct)
      })
      const onAbort = () => child.kill()
      signal.addEventListener('abort', onAbort, { once: true })
      child.on('error', reject)
      child.on('close', code => {
        signal.removeEventListener('abort', onAbort)
        if (code === 0) return resolve()
        const lastLines = tail.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean).slice(-3).join(' | ')
        reject(new Error(`Demucs terminó con código ${code}: ${lastLines}`))
      })
    })

    const produced = path.join(outRoot, 'htdemucs', path.parse(job.inputPath).name)
    await fs.rename(path.join(produced, 'no_vocals.wav'), path.join(job.outDir, 'instrumental.wav'))
    await fs.rename(path.join(produced, 'vocals.wav'), path.join(job.outDir, 'vocals.wav'))
  } finally {
    await fs.rm(outRoot, { recursive: true, force: true })
  }
}
```

Run: `npx vitest run electron/audio`
Expected: PASS (progress, queue, demucsRunner).

- [ ] **Step 9: Commit**

```bash
git add electron/audio/types.ts electron/audio/progress.ts electron/audio/progress.test.ts electron/audio/queue.ts electron/audio/queue.test.ts electron/audio/demucsRunner.ts electron/audio/demucsRunner.test.ts electron/audio/__fixtures__/fake-demucs.cjs
git commit -m "feat(audio): separation queue and demucs runner with fake-cli tests"
```

---

### Task 3: Motor de audio — fijar versiones (spike) e instalador

Esta tarea empieza con un **spike** en Windows para obtener valores reales (URLs, sha256, versiones) y guardarlos en `electron/audio/engine-manifest.json`. El código del instalador solo lee ese manifiesto.

**Files:**
- Create: `electron/audio/engine-manifest.json`
- Create: `electron/audio/engine.ts`
- Create: `electron/audio/download.ts`
- Test: `electron/audio/download.test.ts`
- Modify: `package.json` (dependencia `tar`)

**Interfaces:**
- Consumes: `DemucsCommand` (Task 2).
- Produces:
  - `interface EngineManifest { version: string; python: Record<'win32-x64' | 'darwin-arm64' | 'darwin-x64', { url: string; sha256: string; sizeBytes: number }>; torchIndexUrl: string; pipRequirements: string[]; estimatedInstallBytes: number }`
  - `interface EngineStatus { installed: boolean; version?: string; platformSupported: boolean; estimatedInstallBytes: number }`
  - `type EngineProgress = { step: 'download' | 'extract' | 'pip' | 'ffmpeg' | 'selftest'; pct: number; message?: string }`
  - `getEngineStatus(): Promise<EngineStatus>`
  - `installEngine(onProgress: (p: EngineProgress) => void, signal: AbortSignal): Promise<void>`
  - `getDemucsCommand(): DemucsCommand` — `{ file: <python>, baseArgs: ['-m', 'demucs'], env: { TORCH_HOME, PATH } }`
  - `getFfmpegPath(): string | null`
  - `download.ts`: `sha256File(file: string): Promise<string>`; `downloadWithResume(url: string, dest: string, expectedSha256: string, onProgress: (pct: number) => void, signal: AbortSignal): Promise<void>`

- [ ] **Step 1: Spike — instalar el motor a mano en Windows y anotar versiones**

En una carpeta temporal (por ejemplo el scratchpad), fuera del repo:

1. Descargar el Python 3.11 "install_only" de `astral-sh/python-build-standalone` (Releases de GitHub) para `x86_64-pc-windows-msvc`. Anotar URL exacta, tamaño y `sha256` publicado en el release.
2. Extraer y ejecutar:
   ```bash
   ./python/python.exe -m pip install torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cpu
   ./python/python.exe -m pip install "demucs @ git+https://github.com/adefossez/demucs@<commit-o-tag v4.1.0>" imageio-ffmpeg soundfile
   ```
   Las versiones `torch/torchaudio 2.5.1` son candidatas: las versiones nuevas de torchaudio cambiaron la API de guardado y pueden romper Demucs. Si 2.5.1 falla, bajar hasta encontrar una combinación que funcione y anotarla.
3. Copiar el binario de ffmpeg de `imageio_ffmpeg` (`python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"`) a `bin/ffmpeg.exe`, poner `bin/` en `PATH` y separar una canción real de ~30 s:
   ```bash
   TORCH_HOME=./models ./python/python.exe -m demucs --two-stems=vocals -n htdemucs -o out "cancion corta.mp3"
   ```
   Verificar `out/htdemucs/cancion corta/{vocals,no_vocals}.wav`, el tiempo real y el tamaño total de la carpeta.
4. Anotar las URLs y `sha256` de Python para `aarch64-apple-darwin` y `x86_64-apple-darwin` (se prueban en la Tarea 11).

Expected: separación exitosa. Si falla, **detener el plan** y reportar: el resto depende de este resultado.

- [ ] **Step 2: Guardar el manifiesto con los valores reales del spike**

Crear `electron/audio/engine-manifest.json` con esta forma, usando **solo** valores verificados en el Step 1:

```json
{
  "version": "1",
  "python": {
    "win32-x64":    { "url": "<url verificada>", "sha256": "<sha256 verificado>", "sizeBytes": 0 },
    "darwin-arm64": { "url": "<url verificada>", "sha256": "<sha256 verificado>", "sizeBytes": 0 },
    "darwin-x64":   { "url": "<url verificada>", "sha256": "<sha256 verificado>", "sizeBytes": 0 }
  },
  "torchIndexUrl": "https://download.pytorch.org/whl/cpu",
  "pipRequirements": ["torch==2.5.1", "torchaudio==2.5.1", "demucs @ git+https://github.com/adefossez/demucs@<pin>", "imageio-ffmpeg==<pin>", "soundfile==<pin>"],
  "estimatedInstallBytes": 0
}
```

Los `<…>` y los `0` se reemplazan por lo medido; el manifiesto no se commitea con marcadores.

- [ ] **Step 3: Pruebas de descarga (fallan)**

Run: `npm install tar@^7` (y `npm install -D @types/node` si el tipado de `tar` lo pide).

Crear `electron/audio/download.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { downloadWithResume, sha256File } from './download'

const body = Buffer.alloc(200_000, 7)
const hash = crypto.createHash('sha256').update(body).digest('hex')
let server: http.Server
let url: string
let rangeRequests = 0

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const range = req.headers.range
    if (range) {
      rangeRequests++
      const start = Number(range.replace('bytes=', '').split('-')[0])
      res.writeHead(206, { 'Content-Length': body.length - start, 'Content-Range': `bytes ${start}-${body.length - 1}/${body.length}` })
      return res.end(body.subarray(start))
    }
    res.writeHead(200, { 'Content-Length': body.length })
    res.end(body)
  })
  await new Promise<void>(r => server.listen(0, r))
  url = `http://127.0.0.1:${(server.address() as any).port}/python.tar.gz`
})
afterAll(() => server.close())

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wf-dl-')), 'python.tar.gz')

describe('download', () => {
  it('downloads and verifies sha256', async () => {
    const dest = tmp()
    await downloadWithResume(url, dest, hash, () => {}, new AbortController().signal)
    expect(await sha256File(dest)).toBe(hash)
  })
  it('resumes from a partial file with a Range request', async () => {
    const dest = tmp()
    fs.writeFileSync(dest + '.part', body.subarray(0, 50_000))
    await downloadWithResume(url, dest, hash, () => {}, new AbortController().signal)
    expect(rangeRequests).toBeGreaterThan(0)
    expect(await sha256File(dest)).toBe(hash)
  })
  it('rejects and deletes the file on checksum mismatch', async () => {
    const dest = tmp()
    await expect(downloadWithResume(url, dest, 'deadbeef', () => {}, new AbortController().signal)).rejects.toThrow(/checksum/i)
    expect(fs.existsSync(dest)).toBe(false)
    expect(fs.existsSync(dest + '.part')).toBe(false)
  })
})
```

Run: `npx vitest run electron/audio/download.test.ts`
Expected: FAIL, no se resuelve `./download`.

- [ ] **Step 4: Implementar `electron/audio/download.ts`**

```ts
import fs from 'fs'
import crypto from 'crypto'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

export function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256')
    fs.createReadStream(file).on('data', d => h.update(d)).on('error', reject).on('end', () => resolve(h.digest('hex')))
  })
}

/** Downloads to `<dest>.part`, resuming with a Range request, then verifies sha256 and renames. */
export async function downloadWithResume(
  url: string, dest: string, expectedSha256: string,
  onProgress: (pct: number) => void, signal: AbortSignal
): Promise<void> {
  const part = dest + '.part'
  const already = fs.existsSync(part) ? fs.statSync(part).size : 0
  const res = await fetch(url, { headers: already ? { Range: `bytes=${already}-` } : {}, signal })
  if (!res.ok || !res.body) throw new Error(`Descarga falló: HTTP ${res.status}`)

  const resumed = res.status === 206
  const start = resumed ? already : 0
  const total = start + Number(res.headers.get('content-length') ?? 0)
  let received = start
  const body = Readable.fromWeb(res.body as any)
  body.on('data', (chunk: Buffer) => {
    received += chunk.length
    if (total > 0) onProgress(Math.round((received / total) * 100))
  })
  await pipeline(body, fs.createWriteStream(part, { flags: resumed ? 'a' : 'w' }))

  const actual = await sha256File(part)
  if (actual !== expectedSha256) {
    fs.rmSync(part, { force: true })
    throw new Error(`Checksum inválido: se esperaba ${expectedSha256} y se obtuvo ${actual}`)
  }
  fs.renameSync(part, dest)
}
```

Run: `npx vitest run electron/audio/download.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar `electron/audio/engine.ts`**

```ts
import { app } from 'electron'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import * as tar from 'tar'
import manifest from './engine-manifest.json'
import { downloadWithResume } from './download'
import { DemucsCommand } from './demucsRunner'

export interface EngineStatus {
  installed: boolean
  version?: string
  platformSupported: boolean
  estimatedInstallBytes: number
}

export type EngineProgress = {
  step: 'download' | 'extract' | 'pip' | 'ffmpeg' | 'selftest'
  pct: number
  message?: string
}

type PlatformKey = keyof typeof manifest.python

const platformKey = (): PlatformKey | null => {
  const key = `${process.platform}-${process.arch}`
  return key in manifest.python ? (key as PlatformKey) : null
}

export const engineDir = (): string => path.join(app.getPath('userData'), 'audio-engine')
const markerFile = () => path.join(engineDir(), 'engine.json')
const pythonPath = () => process.platform === 'win32'
  ? path.join(engineDir(), 'python', 'python.exe')
  : path.join(engineDir(), 'python', 'bin', 'python3')
const binDir = () => path.join(engineDir(), 'bin')

export async function getEngineStatus(): Promise<EngineStatus> {
  const base = { platformSupported: platformKey() !== null, estimatedInstallBytes: manifest.estimatedInstallBytes }
  try {
    const marker = JSON.parse(fs.readFileSync(markerFile(), 'utf8'))
    return { ...base, installed: marker.version === manifest.version, version: marker.version }
  } catch {
    return { ...base, installed: false }
  }
}

export function getFfmpegPath(): string | null {
  const p = path.join(binDir(), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  return fs.existsSync(p) ? p : null
}

export function getDemucsCommand(): DemucsCommand {
  return {
    file: pythonPath(),
    baseArgs: ['-m', 'demucs'],
    env: {
      TORCH_HOME: path.join(engineDir(), 'models'),
      PATH: `${binDir()}${path.delimiter}${process.env.PATH ?? ''}`
    }
  }
}

function runPython(args: string[], onLine: (line: string) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath(), args, { windowsHide: true, env: { ...process.env, ...getDemucsCommand().env } })
    let tail = ''
    const feed = (d: Buffer) => {
      const s = d.toString()
      tail = (tail + s).slice(-4000)
      s.split(/[\r\n]+/).filter(Boolean).forEach(onLine)
    }
    child.stdout.on('data', feed)
    child.stderr.on('data', feed)
    signal.addEventListener('abort', () => child.kill(), { once: true })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`python ${args.join(' ')} → código ${code}: ${tail.slice(-500)}`)))
  })
}

export async function installEngine(onProgress: (p: EngineProgress) => void, signal: AbortSignal): Promise<void> {
  const key = platformKey()
  if (!key) throw new Error(`Plataforma no soportada: ${process.platform}-${process.arch}`)
  const dir = engineDir()
  fs.mkdirSync(dir, { recursive: true })
  const { bavail, bsize } = fs.statfsSync(dir)
  if (bavail * bsize < manifest.estimatedInstallBytes) {
    const gb = (n: number) => (n / 1024 ** 3).toFixed(1)
    throw new Error(`Espacio insuficiente: se necesitan ~${gb(manifest.estimatedInstallBytes)} GB y hay ${gb(bavail * bsize)} GB libres`)
  }
  fs.rmSync(markerFile(), { force: true })

  const archive = path.join(dir, 'python.tar.gz')
  const py = manifest.python[key]
  if (!fs.existsSync(pythonPath())) {
    await downloadWithResume(py.url, archive, py.sha256, pct => onProgress({ step: 'download', pct }), signal)
    onProgress({ step: 'extract', pct: 0 })
    fs.rmSync(path.join(dir, 'python'), { recursive: true, force: true })
    await tar.x({ file: archive, cwd: dir })
    fs.rmSync(archive, { force: true })
    onProgress({ step: 'extract', pct: 100 })
  }

  let pipLines = 0
  await runPython(
    ['-m', 'pip', 'install', '--disable-pip-version-check', '--extra-index-url', manifest.torchIndexUrl, ...manifest.pipRequirements],
    line => onProgress({ step: 'pip', pct: Math.min(95, ++pipLines), message: line.slice(0, 120) }),
    signal
  )

  onProgress({ step: 'ffmpeg', pct: 0 })
  fs.mkdirSync(binDir(), { recursive: true })
  let ffmpegSrc = ''
  await runPython(['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], l => { ffmpegSrc = l.trim() }, signal)
  const ffmpegDest = path.join(binDir(), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  fs.copyFileSync(ffmpegSrc, ffmpegDest)
  if (process.platform !== 'win32') fs.chmodSync(ffmpegDest, 0o755)
  onProgress({ step: 'ffmpeg', pct: 100 })

  // Self-test: separates 1 s of silence; also downloads the htdemucs weights into TORCH_HOME.
  onProgress({ step: 'selftest', pct: 0 })
  const testDir = path.join(dir, 'selftest')
  fs.rmSync(testDir, { recursive: true, force: true })
  fs.mkdirSync(testDir, { recursive: true })
  const silence = path.join(testDir, 'silence.wav')
  await runPython(['-c',
    `import numpy as np, soundfile as sf; sf.write(r"${silence}", np.zeros((44100, 2), dtype="float32"), 44100)`], () => {}, signal)
  await runPython(['-m', 'demucs', '--two-stems=vocals', '-n', 'htdemucs', '-o', testDir, silence], () => {}, signal)
  if (!fs.existsSync(path.join(testDir, 'htdemucs', 'silence', 'vocals.wav'))) {
    throw new Error('La prueba del motor no produjo archivos de salida')
  }
  fs.rmSync(testDir, { recursive: true, force: true })

  fs.writeFileSync(markerFile(), JSON.stringify({ version: manifest.version, installedAt: new Date().toISOString() }))
  onProgress({ step: 'selftest', pct: 100 })
}
```

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos en `electron/audio/`. (`resolveJsonModule` ya está activo en `tsconfig.json`.)

- [ ] **Step 6: Commit**

```bash
git add electron/audio/engine-manifest.json electron/audio/engine.ts electron/audio/download.ts electron/audio/download.test.ts package.json package-lock.json
git commit -m "feat(audio): downloadable demucs engine with pinned manifest and resumable download"
```

---

### Task 4: Base de datos — migración v3 y repositorio de audio

**Files:**
- Modify: `electron/db/database.ts` (función `runMigrations`)
- Create: `electron/audio/paths.ts`
- Create: `electron/audio/repo.ts`

**Interfaces:**
- Consumes: `getDb()`; `AudioStatus`, `Cue` (Task 2).
- Produces:
  - `paths.ts`: `stemsRoot(): string`; `stemsDir(songId: number): string`; `findStem(songId: number, stem: 'instrumental' | 'vocals'): string | null` (busca `.wav` y luego `.flac`); `findOriginal(songId: number): string | null`.
  - `repo.ts`: `interface SongAudio { song_id: number; status: AudioStatus; error: string | null; original_hash: string | null; duration_sec: number | null; vol_instrumental: number; vol_vocals: number; cues: Cue[]; cues_sections_sig: string | null }`; `getSongAudio(songId: number): SongAudio | null`; `upsertSongAudio(songId: number, patch: Partial<Omit<SongAudio, 'song_id'>>): SongAudio`; `markInterruptedJobs(): void`.

- [ ] **Step 1: Agregar la migración a `runMigrations` en `electron/db/database.ts`**

Después del bloque `if (version < 2) { ... }`:

```ts
  if (version < 3) {
    database.transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS song_audio (
          song_id           INTEGER PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
          status            TEXT NOT NULL DEFAULT 'pending',
          error             TEXT,
          original_hash     TEXT,
          duration_sec      REAL,
          vol_instrumental  REAL NOT NULL DEFAULT 1,
          vol_vocals        REAL NOT NULL DEFAULT 0,
          cues              TEXT NOT NULL DEFAULT '[]',
          cues_sections_sig TEXT,
          created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `)
      database.pragma('user_version = 3')
    })()
  }
```

- [ ] **Step 2: Crear `electron/audio/paths.ts`**

```ts
import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export const stemsRoot = (): string => path.join(app.getPath('userData'), 'stems')
export const stemsDir = (songId: number): string => path.join(stemsRoot(), String(songId))

export function findStem(songId: number, stem: 'instrumental' | 'vocals'): string | null {
  for (const ext of ['wav', 'flac']) {
    const p = path.join(stemsDir(songId), `${stem}.${ext}`)
    if (fs.existsSync(p)) return p
  }
  return null
}

export function findOriginal(songId: number): string | null {
  const dir = stemsDir(songId)
  if (!fs.existsSync(dir)) return null
  const f = fs.readdirSync(dir).find(n => n.startsWith('original.'))
  return f ? path.join(dir, f) : null
}
```

- [ ] **Step 3: Crear `electron/audio/repo.ts`**

```ts
import { getDb } from '../db/database'
import { AudioStatus, Cue } from './types'

export interface SongAudio {
  song_id: number
  status: AudioStatus
  error: string | null
  original_hash: string | null
  duration_sec: number | null
  vol_instrumental: number
  vol_vocals: number
  cues: Cue[]
  cues_sections_sig: string | null
}

function deserialize(row: any): SongAudio {
  return { ...row, cues: JSON.parse(row.cues || '[]') }
}

export function getSongAudio(songId: number): SongAudio | null {
  const row = getDb().prepare('SELECT * FROM song_audio WHERE song_id = ?').get(songId)
  return row ? deserialize(row) : null
}

const COLUMNS = ['status', 'error', 'original_hash', 'duration_sec', 'vol_instrumental', 'vol_vocals', 'cues', 'cues_sections_sig'] as const

export function upsertSongAudio(songId: number, patch: Partial<Omit<SongAudio, 'song_id'>>): SongAudio {
  const db = getDb()
  db.prepare('INSERT OR IGNORE INTO song_audio (song_id) VALUES (?)').run(songId)
  const keys = COLUMNS.filter(k => k in patch)
  if (keys.length > 0) {
    const values = keys.map(k => k === 'cues' ? JSON.stringify(patch.cues) : (patch as any)[k])
    db.prepare(`UPDATE song_audio SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE song_id = ?`)
      .run(...values, songId)
  }
  return getSongAudio(songId)!
}

/** Jobs cannot survive an app restart: mark them so the operator can retry. */
export function markInterruptedJobs(): void {
  getDb().prepare(
    `UPDATE song_audio SET status = 'failed', error = 'Interrumpida al cerrar la app' WHERE status IN ('pending', 'processing')`
  ).run()
}
```

- [ ] **Step 4: Verificación manual de la migración**

1. Cerrar la app. Hacer copia de `%APPDATA%\alado\worshipflow.db` (o la ruta `userData` real; se ve en `app.getPath('userData')`).
2. `npm run dev`. En la consola de DevTools del proceso principal no debe haber errores.
3. Con la app cerrada, abrir la DB con cualquier visor SQLite (`sqlite3` CLI o DB Browser) y ejecutar:
   ```sql
   PRAGMA user_version;          -- 3
   .schema song_audio            -- la tabla con las 11 columnas
   ```
4. Reabrir la app: las canciones y carpetas existentes siguen ahí.

Expected: `user_version = 3`, tabla creada, datos intactos.

- [ ] **Step 5: Commit**

```bash
git add electron/db/database.ts electron/audio/paths.ts electron/audio/repo.ts
git commit -m "feat(db): song_audio table (user_version 3) and audio repository"
```

---

### Task 5: IPC de audio, preload y limpieza al borrar canciones

**Files:**
- Create: `electron/ipc/audio.handlers.ts`
- Modify: `electron/main.ts` (registro)
- Modify: `electron/ipc/db.handlers.ts` (`db:delete-song` llama a `purgeSongAudio`)
- Modify: `electron/preload.ts`
- Create: `src/audio/types.ts`
- Modify: `src/store/songs.store.ts` (declaración global de `window.api`)

**Interfaces:**
- Consumes: `SeparationQueue` (T2), `runDemucs` (T2), `getEngineStatus`/`installEngine`/`getDemucsCommand` (T3), `repo.ts` y `paths.ts` (T4).
- Produces (renderer, `window.api`):
  - `audioEngineStatus(): Promise<EngineStatus>`
  - `audioInstallEngine(): Promise<{ ok: boolean; error?: string }>`
  - `audioCancelInstall(): Promise<void>`
  - `audioImportTrack(songId: number, filePath: string): Promise<SongAudio>`
  - `audioReprocess(songId: number): Promise<SongAudio>`
  - `audioCancel(songId: number): Promise<void>`
  - `audioGetQueue(): Promise<{ songId: number; status: AudioStatus; progress: number }[]>`
  - `audioGetSongAudio(songId: number): Promise<SongAudio | null>`
  - `audioReadStem(songId: number, stem: 'instrumental' | 'vocals'): Promise<Uint8Array>`
  - `audioUpdate(songId: number, patch: { cues?: Cue[]; cues_sections_sig?: string | null; vol_instrumental?: number; vol_vocals?: number; duration_sec?: number }): Promise<SongAudio>`
  - Eventos: `audio:progress` `{ songId, pct }`, `audio:status-changed` `{ songId, status, error? }`, `audio:engine-progress` `EngineProgress`.
  - Main: `registerAudioHandlers(getWindow: () => BrowserWindow | null): void`; `purgeSongAudio(songId: number): void`.

- [ ] **Step 1: Crear `electron/ipc/audio.handlers.ts`**

```ts
import { ipcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { SeparationQueue } from '../audio/queue'
import { runDemucs } from '../audio/demucsRunner'
import { getEngineStatus, installEngine, getDemucsCommand, EngineProgress } from '../audio/engine'
import { getSongAudio, upsertSongAudio, markInterruptedJobs } from '../audio/repo'
import { stemsRoot, stemsDir, findStem, findOriginal } from '../audio/paths'
import { sha256File } from '../audio/download'
import { Cue } from '../audio/types'

const SUPPORTED = ['.mp3', '.wav', '.flac', '.m4a']
let queue: SeparationQueue
let installAbort: AbortController | null = null

export function registerAudioHandlers(getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, payload: unknown) => getWindow()?.webContents.send(channel, payload)

  markInterruptedJobs()

  queue = new SeparationQueue(
    (job, onProgress, signal) => runDemucs(getDemucsCommand(), job, onProgress, signal),
    {
      onStatus: (songId, status, error) => {
        if (!getSongAudio(songId)) return // song deleted meanwhile
        upsertSongAudio(songId, { status, error: error ?? null })
        send('audio:status-changed', { songId, status, error })
      },
      onProgress: (songId, pct) => send('audio:progress', { songId, pct })
    }
  )

  ipcMain.handle('audio:engine-status', () => getEngineStatus())

  ipcMain.handle('audio:install-engine', async () => {
    installAbort = new AbortController()
    try {
      await installEngine((p: EngineProgress) => send('audio:engine-progress', p), installAbort.signal)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: installAbort.signal.aborted ? 'Instalación cancelada' : (e as Error).message }
    } finally {
      installAbort = null
    }
  })

  ipcMain.handle('audio:cancel-install', () => installAbort?.abort())

  ipcMain.handle('audio:import-track', async (_e, { songId, filePath }: { songId: number; filePath: string }) => {
    const ext = path.extname(filePath).toLowerCase()
    if (!SUPPORTED.includes(ext)) throw new Error(`Formato no soportado: ${ext}. Usa mp3, wav, flac o m4a.`)
    // Two 44.1 kHz stereo WAV stems ≈ 20 MB/min; a 10 min song plus the original fits in 300 MB.
    const { bavail, bsize } = fs.statfsSync(path.dirname(stemsRoot())) // userData always exists
    if (bavail * bsize < 300 * 1024 ** 2) throw new Error('Espacio insuficiente en disco: libera al menos 300 MB e inténtalo de nuevo.')
    const hash = await sha256File(filePath)
    const existing = getSongAudio(songId)
    if (existing?.original_hash === hash && existing.status === 'ready') return existing

    const dir = stemsDir(songId)
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const original = path.join(dir, `original${ext}`)
    fs.copyFileSync(filePath, original)

    const row = upsertSongAudio(songId, { status: 'pending', error: null, original_hash: hash, cues: [], cues_sections_sig: null })
    queue.enqueue({ songId, inputPath: original, outDir: dir })
    return row
  })

  ipcMain.handle('audio:reprocess', (_e, songId: number) => {
    const original = findOriginal(songId)
    if (!original) throw new Error('No se encontró el audio original; vuelve a importarlo.')
    const row = upsertSongAudio(songId, { status: 'pending', error: null })
    queue.enqueue({ songId, inputPath: original, outDir: stemsDir(songId) })
    return row
  })

  ipcMain.handle('audio:cancel', (_e, songId: number) => queue.cancel(songId))
  ipcMain.handle('audio:get-queue', () => queue.snapshot())
  ipcMain.handle('audio:get-song-audio', (_e, songId: number) => getSongAudio(songId))

  ipcMain.handle('audio:read-stem', (_e, { songId, stem }: { songId: number; stem: 'instrumental' | 'vocals' }) => {
    const p = findStem(songId, stem)
    if (!p) throw new Error(`No existe la pista ${stem} de la canción ${songId}`)
    return new Uint8Array(fs.readFileSync(p))
  })

  ipcMain.handle('audio:update', (_e, { songId, patch }: {
    songId: number
    patch: { cues?: Cue[]; cues_sections_sig?: string | null; vol_instrumental?: number; vol_vocals?: number; duration_sec?: number }
  }) => upsertSongAudio(songId, patch))
}

/** Called before a song row is deleted: stop any job and remove its files. */
export function purgeSongAudio(songId: number): void {
  queue?.cancel(songId)
  fs.rmSync(stemsDir(songId), { recursive: true, force: true })
}
```

- [ ] **Step 2: Registrar en `electron/main.ts`**

Agregar el import junto a los demás handlers y registrar dentro de `app.whenReady()` después de `registerLyricsHandlers()`:

```ts
import { registerAudioHandlers } from './ipc/audio.handlers'
// ...
  registerLyricsHandlers()
  registerAudioHandlers(() => mainWindow)
```

- [ ] **Step 3: Limpiar al borrar canción en `electron/ipc/db.handlers.ts`**

Importar `purgeSongAudio` y llamarlo en `db:delete-song` **después** de que el `DELETE` tenga éxito (si la canción está en un setlist, el `DELETE` lanza por `ON DELETE RESTRICT` y no se debe borrar el audio):

```ts
import { purgeSongAudio } from './audio.handlers'
// ...
  ipcMain.handle('db:delete-song', (_e, id: number) => {
    getDb().prepare('DELETE FROM songs WHERE id = ?').run(id)
    purgeSongAudio(id)
  })
```

(`song_audio` se borra solo por `ON DELETE CASCADE`.)

- [ ] **Step 4: Exponer en `electron/preload.ts`**

Dentro del objeto de `exposeInMainWorld`, antes de `// System`:

```ts
  // Audio (stems, engine, cues)
  audioEngineStatus: () => ipcRenderer.invoke('audio:engine-status'),
  audioInstallEngine: () => ipcRenderer.invoke('audio:install-engine'),
  audioCancelInstall: () => ipcRenderer.invoke('audio:cancel-install'),
  audioImportTrack: (songId: number, filePath: string) => ipcRenderer.invoke('audio:import-track', { songId, filePath }),
  audioReprocess: (songId: number) => ipcRenderer.invoke('audio:reprocess', songId),
  audioCancel: (songId: number) => ipcRenderer.invoke('audio:cancel', songId),
  audioGetQueue: () => ipcRenderer.invoke('audio:get-queue'),
  audioGetSongAudio: (songId: number) => ipcRenderer.invoke('audio:get-song-audio', songId),
  audioReadStem: (songId: number, stem: string) => ipcRenderer.invoke('audio:read-stem', { songId, stem }),
  audioUpdate: (songId: number, patch: unknown) => ipcRenderer.invoke('audio:update', { songId, patch }),
```

Y ampliar la lista permitida de `on`:

```ts
    const allowed = ['live:show-section', 'live:set-video', 'live:blackout', 'live:whiteout', 'live:transition', 'live:closed',
      'audio:progress', 'audio:status-changed', 'audio:engine-progress']
```

- [ ] **Step 5: Tipos del renderer — crear `src/audio/types.ts`**

```ts
import type { Cue } from './cues'

export type AudioStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'cancelled'
export type Stem = 'instrumental' | 'vocals'

export interface SongAudio {
  song_id: number
  status: AudioStatus
  error: string | null
  original_hash: string | null
  duration_sec: number | null
  vol_instrumental: number
  vol_vocals: number
  cues: Cue[]
  cues_sections_sig: string | null
}

export interface EngineStatus {
  installed: boolean
  version?: string
  platformSupported: boolean
  estimatedInstallBytes: number
}

export interface EngineProgress {
  step: 'download' | 'extract' | 'pip' | 'ffmpeg' | 'selftest'
  pct: number
  message?: string
}

export interface QueueItem {
  songId: number
  status: AudioStatus
  progress: number
}

export type SongAudioPatch = Partial<Pick<SongAudio, 'cues' | 'cues_sections_sig' | 'vol_instrumental' | 'vol_vocals' | 'duration_sec'>>
```

- [ ] **Step 6: Declarar `window.api` en `src/store/songs.store.ts`**

Agregar el import al inicio y las firmas dentro de `api: { ... }`, antes de `on:`:

```ts
import type { SongAudio, EngineStatus, QueueItem, Stem, SongAudioPatch } from '../audio/types'
```

```ts
      audioEngineStatus: () => Promise<EngineStatus>
      audioInstallEngine: () => Promise<{ ok: boolean; error?: string }>
      audioCancelInstall: () => Promise<void>
      audioImportTrack: (songId: number, filePath: string) => Promise<SongAudio>
      audioReprocess: (songId: number) => Promise<SongAudio>
      audioCancel: (songId: number) => Promise<void>
      audioGetQueue: () => Promise<QueueItem[]>
      audioGetSongAudio: (songId: number) => Promise<SongAudio | null>
      audioReadStem: (songId: number, stem: Stem) => Promise<Uint8Array>
      audioUpdate: (songId: number, patch: SongAudioPatch) => Promise<SongAudio>
```

- [ ] **Step 7: Verificar compilación y pruebas**

Run: `npx tsc --noEmit -p tsconfig.json` y `npx vitest run`
Expected: sin errores de tipos nuevos; todas las pruebas PASS.

Run: `npm run dev` y en DevTools de la ventana principal: `await window.api.audioEngineStatus()`
Expected: `{ installed: false, platformSupported: true, ... }`.

- [ ] **Step 8: Commit**

```bash
git add electron/ipc/audio.handlers.ts electron/main.ts electron/ipc/db.handlers.ts electron/preload.ts src/audio/types.ts src/store/songs.store.ts
git commit -m "feat(audio): IPC handlers, preload API and purge on song delete"
```

---

### Task 6: Store de audio y sección "Audio" del editor (importar, motor, progreso)

**Files:**
- Create: `src/store/audio.store.ts`
- Create: `src/components/SongEditor/AudioPanel.tsx`
- Modify: `src/components/SongEditor/SongEditor.tsx` (renderizar `<AudioPanel>` entre "Video de fondo" y "Estilo del texto")

**Interfaces:**
- Consumes: `window.api.audio*` (T5), tipos de `src/audio/types.ts`.
- Produces:
  - `useAudioStore`: `{ engine: EngineStatus | null; engineProgress: EngineProgress | null; installing: boolean; byId: Record<number, SongAudio>; progress: Record<number, number>; init(): void; refreshEngine(): Promise<void>; installEngine(): Promise<string | null>; load(songId): Promise<SongAudio | null>; importTrack(songId, filePath): Promise<void>; reprocess(songId): Promise<void>; cancel(songId): Promise<void>; update(songId, patch: SongAudioPatch): Promise<void> }`
  - `<AudioPanel songId={number | undefined} sections={Section[]} />` — los hijos de cues y reproducción se agregan en Tareas 7 y 8.

- [ ] **Step 1: Crear `src/store/audio.store.ts`**

```ts
import { create } from 'zustand'
import type { SongAudio, EngineStatus, EngineProgress, SongAudioPatch, AudioStatus } from '../audio/types'

interface AudioState {
  engine: EngineStatus | null
  engineProgress: EngineProgress | null
  installing: boolean
  byId: Record<number, SongAudio>
  progress: Record<number, number>
  init: () => void
  refreshEngine: () => Promise<void>
  installEngine: () => Promise<string | null>
  load: (songId: number) => Promise<SongAudio | null>
  importTrack: (songId: number, filePath: string) => Promise<void>
  reprocess: (songId: number) => Promise<void>
  cancel: (songId: number) => Promise<void>
  update: (songId: number, patch: SongAudioPatch) => Promise<void>
}

let initialized = false

export const useAudioStore = create<AudioState>((set, get) => ({
  engine: null,
  engineProgress: null,
  installing: false,
  byId: {},
  progress: {},

  init: () => {
    if (initialized) return
    initialized = true
    window.api.on('audio:progress', ({ songId, pct }: { songId: number; pct: number }) =>
      set(s => ({ progress: { ...s.progress, [songId]: pct } })))
    window.api.on('audio:status-changed', ({ songId, status, error }: { songId: number; status: AudioStatus; error?: string }) =>
      set(s => s.byId[songId]
        ? { byId: { ...s.byId, [songId]: { ...s.byId[songId], status, error: error ?? null } } }
        : s))
    window.api.on('audio:engine-progress', (p: EngineProgress) => set({ engineProgress: p }))
    void get().refreshEngine()
  },

  refreshEngine: async () => set({ engine: await window.api.audioEngineStatus() }),

  installEngine: async () => {
    set({ installing: true, engineProgress: null })
    const res = await window.api.audioInstallEngine()
    set({ installing: false })
    await get().refreshEngine()
    return res.ok ? null : (res.error ?? 'Error desconocido')
  },

  load: async (songId) => {
    const row = await window.api.audioGetSongAudio(songId)
    if (row) set(s => ({ byId: { ...s.byId, [songId]: row } }))
    return row
  },

  importTrack: async (songId, filePath) => {
    const row = await window.api.audioImportTrack(songId, filePath)
    set(s => ({ byId: { ...s.byId, [songId]: row }, progress: { ...s.progress, [songId]: 0 } }))
  },

  reprocess: async (songId) => {
    const row = await window.api.audioReprocess(songId)
    set(s => ({ byId: { ...s.byId, [songId]: row }, progress: { ...s.progress, [songId]: 0 } }))
  },

  cancel: async (songId) => window.api.audioCancel(songId),

  update: async (songId, patch) => {
    const row = await window.api.audioUpdate(songId, patch)
    set(s => ({ byId: { ...s.byId, [songId]: row } }))
  }
}))
```

- [ ] **Step 2: Crear `src/components/SongEditor/AudioPanel.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useAudioStore } from '../../store/audio.store'
import type { Section } from '../../store/songs.store'

const STEP_LABEL = { download: 'Descargando', extract: 'Extrayendo', pip: 'Instalando librerías', ffmpeg: 'Preparando ffmpeg', selftest: 'Probando el motor' }
const gb = (b: number) => (b / 1024 ** 3).toFixed(1)

export default function AudioPanel({ songId, sections }: { songId?: number; sections: Section[] }) {
  const { engine, engineProgress, installing, byId, progress, init, installEngine, load, importTrack, reprocess, cancel } = useAudioStore()
  const [error, setError] = useState<string | null>(null)
  const audio = songId ? byId[songId] : undefined

  useEffect(() => { init() }, [])
  useEffect(() => { if (songId) void load(songId) }, [songId])

  if (!songId) {
    return <Box><p className="text-sm text-slate-400">Guarda la canción primero para poder agregarle audio.</p></Box>
  }

  async function pickAndImport() {
    setError(null)
    const file = await window.api.openFileDialog([{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'm4a'] }])
    if (!file) return
    try { await importTrack(songId!, file) } catch (e) { setError((e as Error).message) }
  }

  async function install() {
    setError(null)
    const err = await installEngine()
    if (err) setError(err)
  }

  const needsEngine = engine && !engine.installed

  return (
    <Box>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {needsEngine && !engine.platformSupported && (
        <p className="text-sm text-amber-400">Esta computadora no es compatible con el motor de separación.</p>
      )}

      {needsEngine && engine.platformSupported && !installing && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-300 flex-1">
            Para separar la voz hay que preparar el motor de audio una sola vez
            (~{gb(engine.estimatedInstallBytes)} GB de descarga y espacio en disco).
          </p>
          <Btn onClick={install}>Preparar motor de audio</Btn>
        </div>
      )}

      {installing && (
        <div className="flex items-center gap-3">
          <Progress pct={engineProgress?.pct ?? 0} label={engineProgress ? STEP_LABEL[engineProgress.step] : 'Iniciando'} />
          <Btn onClick={() => window.api.audioCancelInstall()}>Cancelar</Btn>
        </div>
      )}

      {engine?.installed && !audio && <Btn onClick={pickAndImport}>Importar pista</Btn>}

      {audio && (audio.status === 'pending' || audio.status === 'processing') && (
        <div className="flex items-center gap-3">
          <Progress pct={progress[songId] ?? 0} label={audio.status === 'pending' ? 'En espera' : 'Separando voz e instrumental (tarda ≈1.5× la duración de la canción)'} />
          <Btn onClick={() => cancel(songId)}>Cancelar</Btn>
        </div>
      )}

      {audio && (audio.status === 'failed' || audio.status === 'cancelled') && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-red-400 flex-1">
            {audio.status === 'cancelled' ? 'Separación cancelada.' : `Falló la separación: ${audio.error ?? ''}`}
          </p>
          {engine?.installed && <Btn onClick={() => reprocess(songId)}>Reintentar</Btn>}
          {engine?.installed && <Btn onClick={pickAndImport}>Otra pista</Btn>}
        </div>
      )}

      {audio?.status === 'ready' && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-emerald-400 flex-1">Pista lista: instrumental y voz separadas.</p>
          {engine?.installed && <Btn onClick={pickAndImport}>Reemplazar pista</Btn>}
          {/* Task 7: <StemMixer/> · Task 8: <CueEditor/> · Task 10: export */}
        </div>
      )}
    </Box>
  )
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 bg-slate-800 rounded-2xl p-4 border border-slate-700">
      <h2 className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-widest">Audio</h2>
      {children}
    </div>
  )
}

export function Btn({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm transition-colors border border-slate-600 shrink-0">
      {children}
    </button>
  )
}

function Progress({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs text-slate-400 mb-1"><span>{label}</span><span>{pct}%</span></div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
```

Nota: `sections` se usa a partir de la Tarea 8; en esta tarea solo se recibe.

- [ ] **Step 3: Montar en `SongEditor.tsx`**

Importar `import AudioPanel from './AudioPanel'` y colocar justo antes del comentario `{/* Text Style Panel */}`:

```tsx
      <AudioPanel songId={song.id} sections={sections} />
```

- [ ] **Step 4: Verificación manual**

1. `npm run dev`. Abrir una canción **nueva** sin guardar → la sección Audio dice "Guarda la canción primero".
2. Abrir una canción guardada → "Preparar motor de audio" con el tamaño estimado. Pulsar, ver pasos y porcentaje; probar "Cancelar" a la mitad y luego volver a instalar (la descarga se reanuda).
3. Con el motor instalado, "Importar pista" con un mp3 cuya ruta tenga espacios y acentos → "En espera" → "Separando…" con porcentaje → "Pista lista".
4. Verificar en disco `userData/stems/<id>/{original.mp3, instrumental.wav, vocals.wav}`.
5. Importar un archivo `.txt` renombrado a `.mp3` → queda en "Falló la separación" con mensaje legible.
6. Cerrar la app durante una separación y reabrir → la pista aparece como fallida ("Interrumpida…") con "Reintentar".

- [ ] **Step 5: Commit**

```bash
git add src/store/audio.store.ts src/components/SongEditor/AudioPanel.tsx src/components/SongEditor/SongEditor.tsx
git commit -m "feat(audio): audio section in song editor with engine install and separation progress"
```

---

### Task 7: Reproductor de stems y sincronización en vivo

**Files:**
- Create: `src/audio/player.ts`
- Create: `src/audio/playback.store.ts`
- Create: `src/audio/PlaybackController.tsx`
- Create: `src/components/LiveControls/AudioTransport.tsx`
- Create: `src/components/SongEditor/StemMixer.tsx`
- Modify: `src/App.tsx` (montar `<PlaybackController />`)
- Modify: `src/components/LiveControls/LiveControlsPanel.tsx` (mostrar `<AudioTransport />`)
- Modify: `src/components/SongEditor/AudioPanel.tsx` (mostrar `<StemMixer />` cuando `status === 'ready'`)

**Interfaces:**
- Consumes: `CueFollower`, `cuesAreStale` (T1); `useAudioStore` (T6); `useLiveStore.goToSection`, `currentSong`, `currentSectionIndex`.
- Produces:
  - `class StemPlayer { load(data: Record<Stem, ArrayBuffer>): Promise<void>; play(): void; pause(): void; seek(t: number): void; setVolume(stem: Stem, v: number): void; currentTime: number; duration: number; playing: boolean; onEnded: (() => void) | null; dispose(): void }`
  - `usePlaybackStore`: `{ songId: number | null; status: 'idle' | 'loading' | 'ready' | 'error'; error: string | null; playing: boolean; time: number; duration: number; volumes: Record<Stem, number>; manual: boolean; recording: boolean; lead: number; loadSong(songId: number): Promise<void>; toggle(): void; seek(t: number): void; setVolume(stem: Stem, v: number): void; resumeAuto(): void; unload(): void; setRecording(r: boolean): void }`
  - `getPlayer(): StemPlayer` (singleton para la Tarea 8).
  - `setFollowerCues(cues: Cue[] | null): void` (exportado desde `playback.store.ts`).

- [ ] **Step 1: Crear `src/audio/player.ts`**

```ts
import type { Stem } from './types'

const STEMS: Stem[] = ['instrumental', 'vocals']

/** Plays both stems sample-aligned on one AudioContext clock, each through its own gain. */
export class StemPlayer {
  private ctx = new AudioContext()
  private gains: Record<Stem, GainNode>
  private buffers: Partial<Record<Stem, AudioBuffer>> = {}
  private sources: AudioBufferSourceNode[] = []
  private startedAt = 0
  private offset = 0
  playing = false
  onEnded: (() => void) | null = null

  constructor() {
    this.gains = {
      instrumental: this.ctx.createGain(),
      vocals: this.ctx.createGain()
    }
    STEMS.forEach(s => this.gains[s].connect(this.ctx.destination))
  }

  async load(data: Record<Stem, ArrayBuffer>): Promise<void> {
    this.stopSources()
    this.playing = false
    this.offset = 0
    const decoded = await Promise.all(STEMS.map(s => this.ctx.decodeAudioData(data[s])))
    STEMS.forEach((s, i) => { this.buffers[s] = decoded[i] })
  }

  get duration(): number {
    return this.buffers.instrumental?.duration ?? 0
  }

  get currentTime(): number {
    if (!this.playing) return this.offset
    return Math.min(this.ctx.currentTime - this.startedAt, this.duration)
  }

  play(): void {
    if (this.playing || !this.buffers.instrumental) return
    void this.ctx.resume()
    const when = this.ctx.currentTime + 0.05
    this.sources = STEMS.map(s => {
      const src = this.ctx.createBufferSource()
      src.buffer = this.buffers[s]!
      src.connect(this.gains[s])
      src.start(when, this.offset)
      return src
    })
    const first = this.sources[0]
    first.onended = () => {
      if (this.sources[0] !== first || !this.playing) return // stopped by pause/seek
      this.playing = false
      this.offset = 0
      this.sources = []
      this.onEnded?.()
    }
    this.startedAt = when - this.offset
    this.playing = true
  }

  pause(): void {
    if (!this.playing) return
    this.offset = this.currentTime
    this.playing = false
    this.stopSources()
  }

  seek(t: number): void {
    const wasPlaying = this.playing
    if (wasPlaying) { this.playing = false; this.stopSources() }
    this.offset = Math.max(0, Math.min(t, this.duration))
    if (wasPlaying) this.play()
  }

  setVolume(stem: Stem, v: number): void {
    this.gains[stem].gain.value = Math.max(0, Math.min(1, v))
  }

  dispose(): void {
    this.stopSources()
    void this.ctx.close()
  }

  private stopSources(): void {
    this.sources.forEach(s => { s.onended = null; try { s.stop() } catch { /* not started */ } })
    this.sources = []
  }
}
```

- [ ] **Step 2: Crear `src/audio/playback.store.ts`**

```ts
import { create } from 'zustand'
import { StemPlayer } from './player'
import { CueFollower, Cue } from './cues'
import type { Stem } from './types'

let player: StemPlayer | null = null
export const getPlayer = (): StemPlayer => (player ??= new StemPlayer())

let follower: CueFollower | null = null
export const getFollower = (): CueFollower | null => follower
export function setFollowerCues(cues: Cue[] | null): void {
  follower = cues && cues.length > 0 ? new CueFollower(cues, usePlaybackStore.getState().lead) : null
}

interface PlaybackState {
  songId: number | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  playing: boolean
  time: number
  duration: number
  volumes: Record<Stem, number>
  manual: boolean
  recording: boolean
  lead: number
  loadSong: (songId: number) => Promise<void>
  toggle: () => void
  seek: (t: number) => void
  setVolume: (stem: Stem, v: number) => void
  resumeAuto: () => void
  unload: () => void
  setRecording: (r: boolean) => void
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  songId: null,
  status: 'idle',
  error: null,
  playing: false,
  time: 0,
  duration: 0,
  volumes: { instrumental: 1, vocals: 0 },
  manual: false,
  recording: false,
  lead: 0.3,

  loadSong: async (songId) => {
    if (get().songId === songId && get().status === 'ready') return
    const p = getPlayer()
    p.pause()
    set({ songId, status: 'loading', error: null, playing: false, time: 0, manual: false })
    try {
      const [instrumental, vocals, meta] = await Promise.all([
        window.api.audioReadStem(songId, 'instrumental'),
        window.api.audioReadStem(songId, 'vocals'),
        window.api.audioGetSongAudio(songId)
      ])
      if (get().songId !== songId) return // another song was requested meanwhile
      // Copy into fresh ArrayBuffers: decodeAudioData detaches its input.
      await p.load({ instrumental: instrumental.slice().buffer, vocals: vocals.slice().buffer })
      const volumes = { instrumental: meta?.vol_instrumental ?? 1, vocals: meta?.vol_vocals ?? 0 }
      p.setVolume('instrumental', volumes.instrumental)
      p.setVolume('vocals', volumes.vocals)
      p.onEnded = () => set({ playing: false, time: 0 })
      set({ status: 'ready', duration: p.duration, volumes })
      if (meta && !meta.duration_sec) void window.api.audioUpdate(songId, { duration_sec: p.duration })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  toggle: () => {
    const p = getPlayer()
    if (get().status !== 'ready') return
    if (p.playing) p.pause(); else p.play()
    set({ playing: p.playing, time: p.currentTime })
  },

  seek: (t) => {
    getPlayer().seek(t)
    set({ time: getPlayer().currentTime })
  },

  setVolume: (stem, v) => {
    getPlayer().setVolume(stem, v)
    const volumes = { ...get().volumes, [stem]: v }
    set({ volumes })
    const id = get().songId
    if (id) void window.api.audioUpdate(id, stem === 'instrumental' ? { vol_instrumental: v } : { vol_vocals: v })
  },

  resumeAuto: () => set({ manual: false }),

  unload: () => {
    getPlayer().pause()
    follower = null
    set({ songId: null, status: 'idle', playing: false, time: 0, duration: 0, manual: false })
  },

  setRecording: (recording) => set({ recording })
}))
```

- [ ] **Step 3: Crear `src/audio/PlaybackController.tsx`**

Sin UI propia. Carga el audio de la canción en vivo, avanza la letra según los cues y detecta cuando el operador cambia de sección a mano.

```tsx
import { useEffect, useRef } from 'react'
import { useLiveStore } from '../store/live.store'
import { useAudioStore } from '../store/audio.store'
import { usePlaybackStore, getPlayer, getFollower, setFollowerCues } from './playback.store'
import { cuesAreStale } from './cues'

export default function PlaybackController() {
  const currentSong = useLiveStore(s => s.currentSong)
  const isLive = useLiveStore(s => s.isLive)
  const pendingAuto = useRef<number | null>(null)

  // Load audio + cues whenever the live song changes.
  useEffect(() => {
    if (!isLive || !currentSong?.id) {
      if (usePlaybackStore.getState().songId !== null && !usePlaybackStore.getState().recording) usePlaybackStore.getState().unload()
      return
    }
    const id = currentSong.id
    void (async () => {
      const audio = await useAudioStore.getState().load(id)
      if (audio?.status !== 'ready') { usePlaybackStore.getState().unload(); return }
      await usePlaybackStore.getState().loadSong(id)
      const stale = cuesAreStale(audio.cues, audio.cues_sections_sig, currentSong.sections)
      setFollowerCues(stale ? null : audio.cues)
    })()
  }, [isLive, currentSong?.id])

  // Operator pressed a section by hand → manual mode until the next cue.
  useEffect(() => useLiveStore.subscribe((state, prev) => {
    if (state.currentSectionIndex === prev.currentSectionIndex) return
    if (pendingAuto.current === state.currentSectionIndex) { pendingAuto.current = null; return }
    const f = getFollower()
    if (f && usePlaybackStore.getState().playing) {
      f.markManual()
      usePlaybackStore.setState({ manual: true })
    }
  }), [])

  // Clock loop: publish time and fire cues.
  useEffect(() => {
    let raf = 0
    let lastPublished = 0
    const tick = () => {
      const pb = usePlaybackStore.getState()
      const p = getPlayer()
      if (pb.status === 'ready') {
        const t = p.currentTime
        if (Math.abs(t - lastPublished) > 0.1 || p.playing !== pb.playing) {
          lastPublished = t
          usePlaybackStore.setState({ time: t, playing: p.playing })
        }
        const f = getFollower()
        if (f && p.playing && !pb.recording) fire(f.update(t))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Seek and "volver a automático" both re-sync the lyrics.
  useEffect(() => usePlaybackStore.subscribe((state, prev) => {
    const f = getFollower()
    if (!f || state.recording) return
    if (prev.manual && !state.manual && !f.isManual) return // follower already left manual on its own
    if (prev.manual && !state.manual) fire(f.resumeAuto(getPlayer().currentTime))
    else if (Math.abs(state.time - prev.time) > 1.5 && !state.playing) fire(f.seek(state.time))
  }), [])

  function fire(sectionIndex: number | null) {
    if (sectionIndex === null) return
    const live = useLiveStore.getState()
    if (sectionIndex === live.currentSectionIndex) return
    pendingAuto.current = sectionIndex
    if (usePlaybackStore.getState().manual) usePlaybackStore.setState({ manual: false })
    void live.goToSection(sectionIndex)
  }

  return null
}
```

Nota para el implementador: el salto con la barra mientras suena también debe re-sincronizar. Para eso, `AudioTransport` llama a `getFollower()?.seek(t)` directamente después de `seek(t)` (Step 4), en lugar de depender de la heurística de tiempo.

- [ ] **Step 4: Crear `src/components/LiveControls/AudioTransport.tsx`**

```tsx
import { usePlaybackStore, getFollower } from '../../audio/playback.store'
import { useLiveStore } from '../../store/live.store'

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

export default function AudioTransport() {
  const { status, playing, time, duration, volumes, manual, toggle, seek, setVolume, resumeAuto } = usePlaybackStore()
  if (status === 'idle') return null
  if (status === 'loading') return <span className="text-xs text-slate-400">Cargando audio…</span>
  if (status === 'error') return <span className="text-xs text-red-400">No se pudo cargar el audio</span>

  function onSeek(t: number) {
    seek(t)
    const idx = getFollower()?.seek(t)
    if (idx !== null && idx !== undefined) void useLiveStore.getState().goToSection(idx)
  }

  return (
    <div className="flex items-center gap-3 bg-slate-900 rounded-xl px-3 py-2 border border-slate-800">
      <button onClick={toggle} className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm">
        {playing ? '❚❚' : '▶'}
      </button>
      <span className="text-xs text-slate-400 tabular-nums w-20">{fmt(time)} / {fmt(duration)}</span>
      <input type="range" min={0} max={duration || 0} step={0.1} value={time}
        onChange={e => onSeek(Number(e.target.value))} className="w-40 accent-indigo-500" />
      <Vol label="Inst." value={volumes.instrumental} onChange={v => setVolume('instrumental', v)} />
      <Vol label="Voz" value={volumes.vocals} onChange={v => setVolume('vocals', v)} />
      {getFollower() && (manual
        ? <button onClick={resumeAuto} className="text-xs px-2 py-1 rounded-lg bg-amber-600 text-white">Manual · volver a auto</button>
        : <span className="text-xs px-2 py-1 rounded-lg bg-emerald-700 text-white">Automático</span>)}
    </div>
  )
}

function Vol({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-400">
      {label}
      <input type="range" min={0} max={1} step={0.05} value={value}
        onChange={e => onChange(Number(e.target.value))} className="w-20 accent-indigo-500" />
    </label>
  )
}
```

- [ ] **Step 5: Crear `src/components/SongEditor/StemMixer.tsx`** (vista previa en el editor)

```tsx
import { useEffect } from 'react'
import { usePlaybackStore } from '../../audio/playback.store'
import { useLiveStore } from '../../store/live.store'
import AudioTransport from '../LiveControls/AudioTransport'
import { Btn } from './AudioPanel'

export default function StemMixer({ songId }: { songId: number }) {
  const { songId: loaded, loadSong, unload } = usePlaybackStore()
  const isLive = useLiveStore(s => s.isLive)

  useEffect(() => () => { if (!useLiveStore.getState().isLive) unload() }, [])

  if (isLive) {
    return <p className="text-sm text-slate-400">Hay un servicio en vivo. Termínalo para escuchar o marcar cues aquí.</p>
  }
  if (loaded !== songId) return <Btn onClick={() => loadSong(songId)}>Escuchar / mezclar</Btn>
  return <AudioTransport />
}
```

En `AudioPanel.tsx`, dentro del bloque `audio?.status === 'ready'`, cambiar el contenedor para que la mezcla quede debajo del mensaje:

```tsx
      {audio?.status === 'ready' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm text-emerald-400 flex-1">Pista lista: instrumental y voz separadas.</p>
            {engine?.installed && <Btn onClick={pickAndImport}>Reemplazar pista</Btn>}
          </div>
          <StemMixer songId={songId} />
          {/* Task 8: <CueEditor/> · Task 10: export */}
        </div>
      )}
```

con `import StemMixer from './StemMixer'`.

- [ ] **Step 6: Montar en `App.tsx` y `LiveControlsPanel.tsx`**

En `src/App.tsx`: `import PlaybackController from './audio/PlaybackController'` y renderizar `<PlaybackController />` como primer hijo del `<div className="flex h-screen ...">`.

En `src/components/LiveControls/LiveControlsPanel.tsx`: `import AudioTransport from './AudioTransport'` y renderizar `<AudioTransport />` justo después del bloque `{/* Section quick-jump */}` (antes de los botones de blackout/whiteout).

Además, en el `onKey` de `LiveControlsPanel`, la barra espaciadora ya avanza sección: no cambiarla. El play/pausa se hace con el botón.

- [ ] **Step 7: Verificación manual (con una canción ya separada y con cues de prueba)**

Antes de la Tarea 8 no hay UI para cues; para probar, en DevTools:
```js
const s = (await window.api.getSongs()).find(x => x.title === '<canción>')
await window.api.audioUpdate(s.id, { cues: [{sectionIndex:0,time:2},{sectionIndex:1,time:8},{sectionIndex:0,time:14}],
  cues_sections_sig: `${s.sections.length}:${s.sections.map(x=>x.type).join(',')}` })
```
1. Editor → "Escuchar / mezclar": suena el instrumental; subir "Voz" → se escucha la voz; volúmenes persisten al reabrir.
2. Iniciar servicio en vivo con esa canción: aparece el transporte. Play → la ventana live cambia de sección en ~1.7 s, ~7.7 s y ~13.7 s (adelanto 0.3 s).
3. Durante la reproducción pulsar otra sección a mano → indicador "Manual"; al cruzar el siguiente cue vuelve a "Automático".
4. Pausar → la letra no cambia. Arrastrar la barra a 10 s → la letra salta a la sección del cue de 8 s.
5. Blackout/whiteout funcionan igual con audio sonando.
6. **Review Focus #4:** agregar una sección a la canción y guardar; reiniciar el servicio → el audio suena pero la letra **no** se mueve sola (cues desactualizados).

- [ ] **Step 8: Commit**

```bash
git add src/audio/player.ts src/audio/playback.store.ts src/audio/PlaybackController.tsx src/components/LiveControls/AudioTransport.tsx src/components/SongEditor/StemMixer.tsx src/components/SongEditor/AudioPanel.tsx src/App.tsx src/components/LiveControls/LiveControlsPanel.tsx
git commit -m "feat(audio): stem player with per-stem volume and cue-driven live lyrics"
```

---

### Task 8: Marcar cues tocando y edición básica

**Files:**
- Create: `src/components/SongEditor/CueEditor.tsx`
- Modify: `src/components/SongEditor/AudioPanel.tsx` (renderizar `<CueEditor>` bajo `<StemMixer>`)

**Interfaces:**
- Consumes: `CueRecorder`, `nudgeCue`, `removeCue`, `upsertCueAt`, `sectionsSignature`, `cuesAreStale` (T1); `usePlaybackStore`, `getPlayer` (T7); `useAudioStore.update` (T6).
- Produces: `<CueEditor songId={number} sections={Section[]} />`.

- [ ] **Step 1: Crear `src/components/SongEditor/CueEditor.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { CueRecorder, Cue, nudgeCue, removeCue, upsertCueAt, sectionsSignature, cuesAreStale } from '../../audio/cues'
import { usePlaybackStore, getPlayer } from '../../audio/playback.store'
import { useAudioStore } from '../../store/audio.store'
import type { Section } from '../../store/songs.store'
import { Btn } from './AudioPanel'

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`

export default function CueEditor({ songId, sections }: { songId: number; sections: Section[] }) {
  const audio = useAudioStore(s => s.byId[songId])
  const update = useAudioStore(s => s.update)
  const { songId: loaded, recording, setRecording, seek, toggle } = usePlaybackStore()
  const recorder = useRef<CueRecorder | null>(null)
  const [draft, setDraft] = useState<Cue[]>([])
  const [selected, setSelected] = useState(0)

  const cues = recording ? draft : (audio?.cues ?? [])
  const stale = audio ? cuesAreStale(audio.cues, audio.cues_sections_sig, sections) : false
  const save = (next: Cue[]) => update(songId, { cues: next, cues_sections_sig: sectionsSignature(sections) })

  useEffect(() => {
    if (!recording) return
    function onKey(e: KeyboardEvent) {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
      const t = getPlayer().currentTime
      if (e.key === ' ') { e.preventDefault(); recorder.current?.tap(t) }
      else if (e.key === 'r' || e.key === 'R') recorder.current?.repeat(t)
      else return
      setDraft(recorder.current!.result)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [recording])

  if (loaded !== songId || sections.length === 0) return null

  function start() {
    recorder.current = new CueRecorder(sections.length)
    setDraft([])
    setRecording(true)
    seek(0)
    if (!getPlayer().playing) toggle()
  }

  async function finish() {
    if (getPlayer().playing) toggle()
    setRecording(false)
    await save(recorder.current?.result ?? [])
    recorder.current = null
  }

  function markSection(i: number) {
    if (!recording || !recorder.current) return
    recorder.current.mark(i, getPlayer().currentTime)
    setDraft(recorder.current.result)
  }

  const next = recorder.current?.nextSection ?? null

  return (
    <div className="mt-2 border-t border-slate-700 pt-4">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold flex-1">Cues ({cues.length})</h3>
        {!recording && <Btn onClick={start}>{cues.length ? 'Volver a marcar' : 'Marcar cues'}</Btn>}
        {recording && <Btn onClick={finish}>Terminar y guardar</Btn>}
      </div>

      {stale && !recording && (
        <p className="text-sm text-amber-400 mb-3">
          Las secciones cambiaron después de marcar los cues. No se usarán en vivo hasta que los vuelvas a marcar.
        </p>
      )}

      {recording && (
        <p className="text-sm text-slate-300 mb-3">
          <b>Espacio</b>: siguiente sección{next !== null ? ` (${sections[next].label})` : ' (no quedan)'} ·
          <b> R</b>: repetir la actual · <b>clic</b> en una sección: marcarla ahora
        </p>
      )}

      {recording && (
        <div className="flex gap-1 flex-wrap mb-3">
          {sections.map((s, i) => (
            <button key={i} onClick={() => markSection(i)}
              className={`px-2.5 py-1 rounded-lg text-xs border ${i === next ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'}`}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <ol className="flex flex-col gap-1">
        {cues.map((c, i) => (
          <li key={`${c.sectionIndex}-${c.time}-${i}`}
            className={`flex items-center gap-2 text-sm rounded-lg px-2 py-1 ${i === selected && !recording ? 'bg-slate-700' : ''}`}
            onClick={() => setSelected(i)}>
            <span className="tabular-nums text-slate-400 w-16">{fmt(c.time)}</span>
            <span className="flex-1">{sections[c.sectionIndex]?.label ?? `Sección ${c.sectionIndex + 1}`}</span>
            {!recording && <>
              <SmallBtn onClick={() => save(nudgeCue(cues, i, -0.1))}>−0.1</SmallBtn>
              <SmallBtn onClick={() => save(nudgeCue(cues, i, 0.1))}>+0.1</SmallBtn>
              <SmallBtn onClick={() => { seek(Math.max(0, c.time - 2)); if (!getPlayer().playing) toggle() }}>▶</SmallBtn>
              <SmallBtn onClick={() => save(upsertCueAt(cues, c.sectionIndex, getPlayer().currentTime))}>Marcar aquí</SmallBtn>
              <SmallBtn onClick={() => save(removeCue(cues, i))}>✕</SmallBtn>
            </>}
          </li>
        ))}
      </ol>
    </div>
  )
}

function SmallBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }}
      className="text-xs px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 border border-slate-600">
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Montar en `AudioPanel.tsx`**

`import CueEditor from './CueEditor'` y reemplazar el comentario `{/* Task 8: <CueEditor/> · Task 10: export */}` por:

```tsx
          <CueEditor songId={songId} sections={sections} />
          {/* Task 10: export */}
```

- [ ] **Step 3: Verificación manual**

1. Canción separada → "Escuchar / mezclar" → "Marcar cues": arranca desde 0. Pulsar Espacio en cada cambio; R en un coro repetido seguido; clic en "Coro" cuando vuelve después del verso 2.
2. "Terminar y guardar" → la lista muestra los cues en orden con etiqueta y tiempo.
3. `+0.1` / `−0.1` cambian el tiempo y se mantienen al cerrar y abrir el editor.
4. `▶` reproduce desde 2 s antes del cue; "Marcar aquí" corrige ese cue con el tiempo actual; `✕` lo borra.
5. Con un campo de texto enfocado (título), Espacio escribe un espacio y no marca.
6. Iniciar el servicio en vivo con esa canción → la letra avanza sola con los cues recién marcados.
7. Agregar una sección y guardar → aparece el aviso amarillo de cues desactualizados.

- [ ] **Step 4: Commit**

```bash
git add src/components/SongEditor/CueEditor.tsx src/components/SongEditor/AudioPanel.tsx
git commit -m "feat(audio): tap-to-mark cue recording with basic cue editing"
```

---

### Task 9: Formato `.wfpack` (puro, con protección zip-slip)

**Files:**
- Create: `electron/audio/pack.ts`
- Test: `electron/audio/pack.test.ts`
- Modify: `package.json` (dependencia `fflate`)

**Interfaces:**
- Consumes: `Cue` (T2).
- Produces:
  - `PACK_VERSION = 1`
  - `interface PackManifest { packVersion: number; kind: 'song'; appVersion: string; id: string }`
  - `interface PackSong { title: string; artist?: string; sections: unknown[]; text_style: Record<string, unknown>; cues: Cue[]; cues_sections_sig: string | null; vol_instrumental: number; vol_vocals: number; video?: string }`
  - `interface PackContents { manifest: PackManifest; song: PackSong; files: Record<string, Uint8Array> }` — `files` usa claves `audio/instrumental.flac` etc.
  - `buildPack(contents: PackContents): Uint8Array`
  - `parsePack(data: Uint8Array): PackContents` — lanza `Error` con mensaje en español si el paquete es inválido.
  - `isAllowedEntry(name: string): boolean`

- [ ] **Step 1: Instalar `fflate`**

Run: `npm install fflate@^0.8`

- [ ] **Step 2: Pruebas que fallan**

Crear `electron/audio/pack.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { buildPack, parsePack, isAllowedEntry, PACK_VERSION, PackContents } from './pack'

const contents = (): PackContents => ({
  manifest: { packVersion: PACK_VERSION, kind: 'song', appVersion: '1.0.0', id: 'abc' },
  song: {
    title: 'Cuán grande es Él', artist: 'Tradicional', sections: [{ type: 'verse', label: 'Verso 1', lines: ['a'] }],
    text_style: {}, cues: [{ sectionIndex: 0, time: 1.5 }], cues_sections_sig: '1:verse', vol_instrumental: 1, vol_vocals: 0
  },
  files: {
    'audio/instrumental.flac': new Uint8Array([1, 2, 3]),
    'audio/vocals.flac': new Uint8Array([4, 5, 6])
  }
})

const rawZip = (entries: Record<string, string | Uint8Array>) =>
  zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v])))

describe('pack round trip', () => {
  it('parses what it builds', () => {
    const out = parsePack(buildPack(contents()))
    expect(out.song.title).toBe('Cuán grande es Él')
    expect(out.song.cues).toEqual([{ sectionIndex: 0, time: 1.5 }])
    expect([...out.files['audio/vocals.flac']]).toEqual([4, 5, 6])
  })
})

describe('isAllowedEntry', () => {
  it.each([
    'manifest.json', 'song.json', 'audio/instrumental.flac', 'audio/vocals.wav', 'video/fondo con espacios.mp4'
  ])('allows %s', n => expect(isAllowedEntry(n)).toBe(true))

  it.each([
    '../evil.exe', 'audio/../../evil', '/etc/passwd', 'C:\\Windows\\evil.dll', 'video/sub/dir.mp4',
    'audio\\vocals.flac', 'audio/other.flac', 'video/..', 'run.bat'
  ])('rejects %s', n => expect(isAllowedEntry(n)).toBe(false))
})

describe('parsePack validation', () => {
  const manifest = JSON.stringify({ packVersion: PACK_VERSION, kind: 'song', appVersion: '1', id: 'x' })
  const song = JSON.stringify(contents().song)

  it('rejects zip-slip entries without extracting anything', () => { // Review Focus #1
    const zip = rawZip({ 'manifest.json': manifest, 'song.json': song, 'audio/instrumental.flac': 'x', 'audio/vocals.flac': 'y', '../../evil.exe': 'boom' })
    expect(() => parsePack(zip)).toThrow(/no permitido/)
  })
  it('rejects unknown packVersion', () => {
    const zip = rawZip({ 'manifest.json': JSON.stringify({ packVersion: 99, kind: 'song', appVersion: '1', id: 'x' }), 'song.json': song })
    expect(() => parsePack(zip)).toThrow(/versión/)
  })
  it('rejects missing stems', () => {
    const zip = rawZip({ 'manifest.json': manifest, 'song.json': song, 'audio/vocals.flac': 'y' })
    expect(() => parsePack(zip)).toThrow(/instrumental/)
  })
  it('rejects a non-zip file', () => {
    expect(() => parsePack(new Uint8Array([1, 2, 3, 4]))).toThrow(/no es un paquete/)
  })
  it('rejects song.json without title', () => {
    const zip = rawZip({ 'manifest.json': manifest, 'song.json': JSON.stringify({ sections: [] }), 'audio/instrumental.flac': 'x', 'audio/vocals.flac': 'y' })
    expect(() => parsePack(zip)).toThrow(/título/)
  })
})
```

Run: `npx vitest run electron/audio/pack.test.ts`
Expected: FAIL, no se resuelve `./pack`.

- [ ] **Step 3: Implementar `electron/audio/pack.ts`**

```ts
import { zipSync, unzipSync, strToU8, strFromU8, Zippable } from 'fflate'
import { Cue } from './types'

export const PACK_VERSION = 1

export interface PackManifest {
  packVersion: number
  kind: 'song'
  appVersion: string
  id: string
}

export interface PackSong {
  title: string
  artist?: string
  sections: unknown[]
  text_style: Record<string, unknown>
  cues: Cue[]
  cues_sections_sig: string | null
  vol_instrumental: number
  vol_vocals: number
  video?: string
}

export interface PackContents {
  manifest: PackManifest
  song: PackSong
  files: Record<string, Uint8Array>
}

const AUDIO_ENTRY = /^audio\/(instrumental|vocals)\.(flac|wav)$/
const VIDEO_ENTRY = /^video\/[^/\\]+\.(mp4|webm|mov)$/i

export function isAllowedEntry(name: string): boolean {
  if (name.includes('\\') || name.includes('..') || name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return false
  return name === 'manifest.json' || name === 'song.json' || AUDIO_ENTRY.test(name) || VIDEO_ENTRY.test(name)
}

export function buildPack(contents: PackContents): Uint8Array {
  const entries: Zippable = {
    'manifest.json': strToU8(JSON.stringify(contents.manifest, null, 2)),
    'song.json': strToU8(JSON.stringify(contents.song, null, 2))
  }
  for (const [name, data] of Object.entries(contents.files)) {
    if (!isAllowedEntry(name)) throw new Error(`Archivo no permitido en el paquete: ${name}`)
    entries[name] = [data, { level: 0 }] // audio/video are already compressed
  }
  return zipSync(entries)
}

export function parsePack(data: Uint8Array): PackContents {
  let raw: Record<string, Uint8Array>
  try {
    raw = unzipSync(data)
  } catch {
    throw new Error('El archivo no es un paquete .wfpack válido')
  }
  for (const name of Object.keys(raw)) {
    if (name.endsWith('/')) continue // directory entries
    if (!isAllowedEntry(name)) throw new Error(`Archivo no permitido en el paquete: ${name}`)
  }

  const manifest = readJson(raw, 'manifest.json') as PackManifest
  if (manifest.packVersion !== PACK_VERSION) {
    throw new Error(`Este paquete usa la versión ${manifest.packVersion} del formato; esta app solo entiende la versión ${PACK_VERSION}. Actualiza WorshipFlow.`)
  }
  if (manifest.kind !== 'song') throw new Error(`Tipo de paquete no soportado: ${manifest.kind}`)

  const song = readJson(raw, 'song.json') as PackSong
  if (typeof song.title !== 'string' || !song.title.trim()) throw new Error('El paquete no tiene título de canción')
  if (!Array.isArray(song.sections)) throw new Error('El paquete no tiene secciones válidas')

  const files: Record<string, Uint8Array> = {}
  for (const [name, bytes] of Object.entries(raw)) {
    if (name.startsWith('audio/') || name.startsWith('video/')) files[name] = bytes
  }
  for (const stem of ['instrumental', 'vocals']) {
    if (!Object.keys(files).some(n => n.startsWith(`audio/${stem}.`))) throw new Error(`Al paquete le falta la pista ${stem}`)
  }
  return { manifest, song: { ...song, cues: Array.isArray(song.cues) ? song.cues : [] }, files }
}

function readJson(raw: Record<string, Uint8Array>, name: string): unknown {
  if (!raw[name]) throw new Error(`Al paquete le falta ${name}`)
  try {
    return JSON.parse(strFromU8(raw[name]))
  } catch {
    throw new Error(`${name} está dañado`)
  }
}
```

Run: `npx vitest run electron/audio/pack.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add electron/audio/pack.ts electron/audio/pack.test.ts package.json package-lock.json
git commit -m "feat(audio): .wfpack format with manifest validation and zip-slip protection"
```

---

### Task 10: Exportar e importar `.wfpack` (IPC + UI)

**Files:**
- Create: `electron/ipc/pack.handlers.ts`
- Modify: `electron/main.ts` (registro)
- Modify: `electron/preload.ts`, `src/store/songs.store.ts` (API)
- Modify: `src/components/SongEditor/AudioPanel.tsx` (botón exportar)
- Modify: `src/pages/Songs/SongsPage.tsx` (botón importar)

**Interfaces:**
- Consumes: `buildPack`, `parsePack`, `PACK_VERSION` (T9); `getFfmpegPath` (T3); `getSongAudio`, `upsertSongAudio` (T4); `stemsDir`, `findStem` (T4); `getDb`.
- Produces (`window.api`):
  - `packExport(songId: number): Promise<{ path: string } | null>` (null si el usuario cancela el diálogo)
  - `packInspect(): Promise<{ path: string; title: string; artist?: string; duplicateOf: number | null } | null>`
  - `packImport(path: string, mode: 'copy' | 'replace'): Promise<number>` (id de la canción)

- [ ] **Step 1: Crear `electron/ipc/pack.handlers.ts`**

```ts
import { ipcMain, dialog, app } from 'electron'
import { spawn } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getDb } from '../db/database'
import { buildPack, parsePack, PACK_VERSION, PackSong } from '../audio/pack'
import { getFfmpegPath } from '../audio/engine'
import { getSongAudio, upsertSongAudio } from '../audio/repo'
import { stemsDir, findStem } from '../audio/paths'
import { purgeSongAudio } from './audio.handlers'

function toFlac(wav: string): Promise<Uint8Array> {
  const ffmpeg = getFfmpegPath()
  if (!ffmpeg) return Promise.resolve(new Uint8Array(fs.readFileSync(wav)))
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wfpack-')), 'out.flac')
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'flac', out], { windowsHide: true })
    child.on('error', reject)
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`ffmpeg falló al comprimir (${code})`))
      const data = new Uint8Array(fs.readFileSync(out))
      fs.rmSync(path.dirname(out), { recursive: true, force: true })
      resolve(data)
    })
  })
}

async function stemEntry(songId: number, stem: 'instrumental' | 'vocals'): Promise<[string, Uint8Array]> {
  const p = findStem(songId, stem)
  if (!p) throw new Error(`Falta la pista ${stem}`)
  if (p.endsWith('.flac')) return [`audio/${stem}.flac`, new Uint8Array(fs.readFileSync(p))]
  const data = await toFlac(p)
  const isFlac = getFfmpegPath() !== null
  return [`audio/${stem}.${isFlac ? 'flac' : 'wav'}`, data]
}

export function registerPackHandlers(): void {
  ipcMain.handle('pack:export', async (_e, songId: number) => {
    const song = getDb().prepare('SELECT * FROM songs WHERE id = ?').get(songId) as any
    const audio = getSongAudio(songId)
    if (!song || audio?.status !== 'ready') throw new Error('La canción no tiene audio listo para exportar')

    const safeName = song.title.replace(/[<>:"/\\|?*]/g, '').trim() || 'cancion'
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${safeName}.wfpack`,
      filters: [{ name: 'Paquete WorshipFlow', extensions: ['wfpack'] }]
    })
    if (canceled || !filePath) return null

    const files: Record<string, Uint8Array> = Object.fromEntries(
      await Promise.all([stemEntry(songId, 'instrumental'), stemEntry(songId, 'vocals')]))

    let video: string | undefined
    if (song.video_path && fs.existsSync(song.video_path)) {
      video = path.basename(song.video_path)
      files[`video/${video}`] = new Uint8Array(fs.readFileSync(song.video_path))
    }

    const packSong: PackSong = {
      title: song.title,
      artist: song.artist ?? undefined,
      sections: JSON.parse(song.sections),
      text_style: JSON.parse(song.text_style),
      cues: audio.cues,
      cues_sections_sig: audio.cues_sections_sig,
      vol_instrumental: audio.vol_instrumental,
      vol_vocals: audio.vol_vocals,
      video
    }
    const data = buildPack({
      manifest: { packVersion: PACK_VERSION, kind: 'song', appVersion: app.getVersion(), id: crypto.randomUUID() },
      song: packSong,
      files
    })
    fs.writeFileSync(filePath, data)
    return { path: filePath }
  })

  ipcMain.handle('pack:inspect', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Paquete WorshipFlow', extensions: ['wfpack'] }]
    })
    if (canceled || !filePaths[0]) return null
    const { song } = parsePack(new Uint8Array(fs.readFileSync(filePaths[0])))
    const dup = getDb().prepare(
      `SELECT id FROM songs WHERE title = ? COLLATE NOCASE AND IFNULL(artist, '') = IFNULL(?, '') COLLATE NOCASE LIMIT 1`
    ).get(song.title, song.artist ?? null) as { id: number } | undefined
    return { path: filePaths[0], title: song.title, artist: song.artist, duplicateOf: dup?.id ?? null }
  })

  ipcMain.handle('pack:import', (_e, { path: packPath, mode }: { path: string; mode: 'copy' | 'replace' }) => {
    const { song, files } = parsePack(new Uint8Array(fs.readFileSync(packPath)))
    const db = getDb()

    let songId: number
    const dup = db.prepare(
      `SELECT id FROM songs WHERE title = ? COLLATE NOCASE AND IFNULL(artist, '') = IFNULL(?, '') COLLATE NOCASE LIMIT 1`
    ).get(song.title, song.artist ?? null) as { id: number } | undefined

    if (mode === 'replace' && dup) {
      songId = dup.id
      purgeSongAudio(songId)
      db.prepare('UPDATE songs SET sections = ?, text_style = ? WHERE id = ?')
        .run(JSON.stringify(song.sections), JSON.stringify(song.text_style), songId)
    } else {
      const title = dup ? `${song.title} (importada)` : song.title
      songId = Number(db.prepare('INSERT INTO songs (title, artist, sections, text_style) VALUES (?,?,?,?)')
        .run(title, song.artist ?? null, JSON.stringify(song.sections), JSON.stringify(song.text_style)).lastInsertRowid)
    }

    // Every name in `files` already passed isAllowedEntry; path.basename is a second guard.
    const dir = stemsDir(songId)
    fs.mkdirSync(dir, { recursive: true })
    for (const [name, bytes] of Object.entries(files)) {
      if (name.startsWith('audio/')) fs.writeFileSync(path.join(dir, path.basename(name)), bytes)
    }
    if (song.video && files[`video/${song.video}`]) {
      const mediaDir = path.join(app.getPath('userData'), 'media', String(songId))
      fs.mkdirSync(mediaDir, { recursive: true })
      const videoPath = path.join(mediaDir, path.basename(song.video))
      fs.writeFileSync(videoPath, files[`video/${song.video}`])
      db.prepare('UPDATE songs SET video_path = ? WHERE id = ?').run(videoPath, songId)
    }

    upsertSongAudio(songId, {
      status: 'ready', error: null, original_hash: null,
      cues: song.cues, cues_sections_sig: song.cues_sections_sig,
      vol_instrumental: song.vol_instrumental, vol_vocals: song.vol_vocals
    })
    return songId
  })
}
```

Registrar en `electron/main.ts`: `import { registerPackHandlers } from './ipc/pack.handlers'` y `registerPackHandlers()` después de `registerAudioHandlers(...)`.

- [ ] **Step 2: Exponer la API**

`electron/preload.ts`, junto a los métodos de audio:

```ts
  packExport: (songId: number) => ipcRenderer.invoke('pack:export', songId),
  packInspect: () => ipcRenderer.invoke('pack:inspect'),
  packImport: (path: string, mode: 'copy' | 'replace') => ipcRenderer.invoke('pack:import', { path, mode }),
```

`src/store/songs.store.ts`, dentro de `api`:

```ts
      packExport: (songId: number) => Promise<{ path: string } | null>
      packInspect: () => Promise<{ path: string; title: string; artist?: string; duplicateOf: number | null } | null>
      packImport: (path: string, mode: 'copy' | 'replace') => Promise<number>
```

- [ ] **Step 3: Botón "Exportar paquete" en `AudioPanel.tsx`**

Reemplazar `{/* Task 10: export */}` por:

```tsx
          <div>
            <Btn onClick={async () => {
              const ok = window.confirm(
                'Compartir el audio de canciones comerciales puede requerir licencia (por ejemplo CCLI o equivalente). ' +
                'Es responsabilidad de tu iglesia contar con ella. ¿Exportar el paquete?')
              if (!ok) return
              try {
                const res = await window.api.packExport(songId)
                if (res) setError(null)
              } catch (e) { setError((e as Error).message) }
            }}>Exportar paquete (.wfpack)</Btn>
          </div>
```

- [ ] **Step 4: Botón "Importar paquete" en `SongsPage.tsx`**

Leer primero el encabezado de la página (donde está el botón de nueva canción, `openNew`) y añadir al lado un botón con el mismo estilo que llame a:

```tsx
  async function importPack() {
    try {
      const info = await window.api.packInspect()
      if (!info) return
      let mode: 'copy' | 'replace' = 'copy'
      if (info.duplicateOf !== null) {
        const replace = window.confirm(`"${info.title}" ya existe. Aceptar = reemplazar la existente · Cancelar = elegir otra opción`)
        if (replace) mode = 'replace'
        else if (!window.confirm('¿Crear una copia como canción nueva? (Cancelar = no importar)')) return
      }
      await window.api.packImport(info.path, mode)
      await fetchSongs()
      await refreshSongsInView()
    } catch (e) {
      window.alert((e as Error).message)
    }
  }
```

Botón: `<button onClick={importPack} className="…mismas clases que el botón secundario existente…">Importar paquete</button>`.

- [ ] **Step 5: Verificación manual**

1. Exportar una canción separada, con cues y video → aviso de licencia → guardar `X.wfpack`. Abrir el archivo con un descompresor: `manifest.json`, `song.json`, `audio/instrumental.flac`, `audio/vocals.flac`, `video/…`.
2. Importar ese paquete → pregunta por duplicado → "copia" crea "X (importada)" con audio listo, cues y video funcionando.
3. Repetir y elegir "reemplazar" → no se crea canción nueva; la existente tiene el audio del paquete.
4. **Máquina sin motor instalado** (o renombrando temporalmente `userData/audio-engine`): importar funciona, el reproductor suena (FLAC) y los cues mueven la letra en vivo.
5. Importar un `.zip` cualquiera renombrado a `.wfpack` → mensaje claro, ninguna canción creada.

- [ ] **Step 6: Commit**

```bash
git add electron/ipc/pack.handlers.ts electron/main.ts electron/preload.ts src/store/songs.store.ts src/components/SongEditor/AudioPanel.tsx src/pages/Songs/SongsPage.tsx
git commit -m "feat(audio): export and import songs as .wfpack"
```

---

### Task 11: Build, documentación y verificación por plataforma

**Files:**
- Modify: `CLAUDE.md`
- Modify (solo si el build lo pide): `electron-builder.yml`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: documentación y checklist firmada en el PR.

- [ ] **Step 1: Pruebas, tipos, lint y build**

Run:
```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
npm run lint
npm run build
```
Expected: todas las pruebas PASS; sin errores de tipos ni de lint nuevos; `out/` generado sin error. Confirmar que `fflate` y `tar` aparecen en `dependencies` de `package.json` (electron-builder solo empaqueta `dependencies`).

- [ ] **Step 2: Instalador de Windows**

Run: `npm run dist:win`
Verificar en una instalación limpia: el instalador **no** creció por PyTorch (sigue en el orden de magnitud previo), el motor se descarga desde la app, se separa una canción, se marcan cues y el servicio en vivo con segundo monitor sigue la letra.

- [ ] **Step 3: macOS (riesgo #1 del spec)**

En una Mac (Apple Silicon y, si hay, Intel):
1. `npm run dist:mac`, instalar la app.
2. "Preparar motor de audio" → completa. Si macOS bloquea el Python o `ffmpeg` descargados: anotar el mensaje exacto. Los archivos bajados con `fetch` desde la app normalmente no llevan el atributo `com.apple.quarantine`; si aun así se bloquea, probar `xattr -dr com.apple.quarantine <userData>/audio-engine` y reportar el resultado antes de cerrar la fase.
3. Separar una canción, marcar cues, exportar `.wfpack`, importarlo en Windows (y viceversa).

Expected: todo funciona en ambas plataformas, o un reporte escrito del bloqueo exacto en Mac.

- [ ] **Step 4: Actualizar `CLAUDE.md`**

Agregar una sección después de "Lyrics Import":

```markdown
### Audio: stems, cues y paquetes

- **Motor:** `electron/audio/engine.ts` descarga en el primer uso Python embebido + PyTorch CPU + Demucs (fork `adefossez/demucs`, versión fijada en `engine-manifest.json`) a `userData/audio-engine/`. `getDemucsCommand()` arma el comando con `TORCH_HOME` y `bin/ffmpeg` en `PATH`.
- **Cola:** `SeparationQueue` (`electron/audio/queue.ts`) corre un trabajo a la vez usando `runDemucs` (`--two-stems=vocals -n htdemucs`). Stems en `userData/stems/<songId>/` (`instrumental` y `vocals`, `.wav` o `.flac`).
- **DB:** tabla `song_audio` (migración `user_version = 3`), con `cues` como JSON y `cues_sections_sig` para detectar cues desactualizados.
- **IPC:** `audio:*` y `pack:*`. Canales de empuje: `audio:progress`, `audio:status-changed`, `audio:engine-progress` (en la lista permitida de `preload.ts`).
- **Renderer:** `src/audio/cues.ts` (lógica pura con pruebas), `StemPlayer` (Web Audio), `usePlaybackStore`, y `PlaybackController` montado en `App.tsx`, que llama a `useLiveStore.goToSection` al cruzar cues. La ventana live no reproduce audio.
- **Paquetes:** `.wfpack` = ZIP con `manifest.json`, `song.json`, `audio/*.flac`, `video/*`. `electron/audio/pack.ts` valida entradas (anti zip-slip) y versión del formato.
- **Pruebas:** `npx vitest run` (Node). `better-sqlite3` está compilado para Electron, así que la DB no se prueba en Vitest. `electron/audio/__fixtures__/fake-demucs.cjs` reemplaza a Demucs en las pruebas.
```

Y corregir la línea de comandos que menciona `npx vitest run src/utils/lyricsParser` (ese archivo de pruebas no existe) por `npx vitest run src/audio/cues.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document audio engine, cues and .wfpack architecture"
```
