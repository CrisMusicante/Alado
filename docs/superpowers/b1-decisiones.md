# Fase B1 — decisiones tomadas y pendientes menores

> Registro de la ejecución de B1 (2026-11-19 → 2026-11-20). Cada decisión dice qué se decidió, por qué y qué cuesta si estaba mal. Los "pendientes menores" son hallazgos de las revisiones que no se corrigieron (no afectan el flujo principal).

## B1a — Fallas del templo y selector de videos

### Decisiones
- Task 1: Ruling: Step 1 repro not done on temple hardware (slow-PC timing can't be reproduced here reliably) — shipped both covering fixes (replay-on-ready + blur) — if the real cause is a third one, bug persists; E2E in Task 5 checks first section arrives
- Task 2: Ruling: windowed warning uses alertDialog, not showToast — toasts vanish after 2.5 s and only have success/error kinds; a misconfigured display must be noticed — costs one extra click per presentation in duplicate mode
- Task 2: Ruling: Step 8 manual check folded into Task 5 E2E (Playwright Electron, single display)
- Task 3: Ruling: added tests 'reuses an identical earlier suffixed copy' and 'returns the file itself when already in the folder'; hashing is chunked sync reads, not streams — importVideo stays sync and memory-bounded — blocks main briefly on equal-size large files
- Task 4: Ruling: Step 6 in-app check folded into Task 5 E2E; VideoThumb exported from VideoPicker.tsx for the editor's current-video still (shares the thumb cache)
- Task 5: E2E (Playwright Electron, single display, copy of real DB + 3 videos in scratch userData): 10/10 PASS — first section projected, windowed live, warning, Esc closes + main resets, picker lists/thumbs/search/accents/pick. Ruling: live window title comes from live.html ('ALADO — En vivo'), BrowserWindow title option is overridden — harmless. Minor seen: 'Fondo 11.mp4' thumbnail is black (frame at 1 s is black).
- Final: Ruling: Minor#4 (closing frame during load throws) fixed incidentally by the null guard in live:open — no separate test — cost: none

### Corregido tras la revisión final
- Important#1 sync video import freezes app — 'copies a new video into the folder without blocking' RED→GREEN, suite 184/184; picker shows 'Copiando video…'
- Important#2 windowed projection steals focus/covers warning — e2e 'operator window keeps focus in windowed mode' RED→GREEN (show:false + showInactive + main focus)
- Minor#3 re-graded Important (temple slow PC double-click jumps projection back) — 'a second Presentar while the first is still opening is ignored' RED→GREEN

### Pendientes menores
- picker hangs on 'Cargando videos...' if listVideos throws (no .catch)
- transition setting dropped on close (clearLiveState) — not a regression
- failed thumbnail cached as null until restart
- import file dialog has no parent window
- 'Fondo 11.mp4' thumbnail is black (frame at 1 s)

## B1b — Nube (Worker + D1)

### Decisiones
- Task 1: Ruling: schema test written with the schema (scaffolding), not watched red — it asserts table list only — low cost. wrangler@4 added as devDependency for reproducible deploys.
- Task 2: Ruling: all cloud ops take ctx {db, now} instead of (db, ...) — injectable clock for lockout/expiry tests — none. Ruling: added tests 'rejects a PIN shorter than 4 digits', 'deactivated user loses sessions', 'duplicate names'; PIN = 4-8 digits; new PIN/deactivation revokes sessions; leader/editor role read live per request.
- Task 3: Ruling: sync tests were not run red separately (module absent = red by construction); added tests 'different fields both kept', 'setlist LWW notice', 'rejects invalid song data', 'folders + second computer'. Notices to 'leaders' delivered once per leader (delivered JSON list). Validation: video_file must be a bare name; sections shape checked; uid [A-Za-z0-9_-]{1,64}; cross-church uid writes rejected. permissions.ts is a pass-through stub until Task 4.
- Security review (automated) on auth.ts/merge.ts: fixed all 5 with tests RED→GREEN (recovery revokes sessions; 8-digit link codes + global cap 20; per-IP 5 + per-account 20 login limits; atomic upsert counter; seen validated). Ruling: merge.ts 'client-controlled seen suppresses notices' — only leader/desktop can write songs directly, they are trusted to overwrite anyway; validation bounds it — cost: a leader could still suppress a courtesy notice.
- Task 5: Ruling: leaders may also propose (not only editors) — harmless, lets a leader draft — none. Approval writes as the leader with seen=current versions, no conflict notice. Added test 'new song proposal needs title and only lyric fields'.
- Security review #2: fixed link global DoS (cap 200, tests RED→GREEN) and shared-IP member lockout (20/IP). Ruling: login unknown-church IP limit stays 20 (not 5) — phones share the church wifi IP; brute-forcing an 8-char code at 20/15min is infeasible — cost: slower detection. Ruling: seen bounded by church seq, not per-session last pull — only trusted writers (leader/desktop) can suppress a courtesy notice — cost: a leader could hide a conflict notice.
- Task 6: deployed https://alado.mj-cristhian.workers.dev (D1 alado 8edbef70…, migration 0001 applied). Smoke: health 200 {ok:true}, pull without token 401, / 200, SPA route 200. Ruling: URL is <name>.<account>.workers.dev (account subdomain mj-cristhian) — free per user's choice.
- Security review #3: fixed first-boot takeover — /api/setup requires SETUP_KEY Worker secret (test RED→GREEN); key stored locally in cloud/.setup-key (gitignored) and given to the user. Ruling: CF-Connecting-IP is set by Cloudflare's edge and can't be spoofed by clients on workers.dev — no change. Ruling: no global cap on member logins — 8-char code space ~8.5e11 at 20/IP/15min — cost: none practical.
- Security review #4: Ruling: keep LINK_GLOBAL=200 — previous review flagged a low global cap as a DoS; 200 guesses vs 1e8 codes alive 10 min ≈ 2e-6 — cost: tiny. Ruling: member login stays per-IP 20 without global counter — church code space 8.5e11 — cost: none practical.
- Security review #5: Ruling: no rate limit on setup key — 16 chars of a 31-symbol alphabet (~7e23) is not brute-forceable; endpoint only works once — cost: none.
- Final: Ruling: I1 member can lock the leader's phone login (per-account 20/15min) — kept: desktop unaffected, 15-min window, abuse needs the church code and is visible; alternative (device-bound exemptions) is larger work — cost: a malicious member can annoy the leader.
- Final: Ruling: I2 PBKDF2 100k on free plan — measured with a throwaway worker: 2×100k per request, 26/26 requests 200 (no 1102); count stored in hash to change later — cost: if Cloudflare tightens, lower iterations.

### Corregido tras la revisión final
- C1 setup open when SETUP_KEY missing — 'refuses setup when the server has no install key configured'
- C2 seq/row not atomic — 'a failed write does not advance the change number' (stamped batches)
- C3 lost concurrent field updates — 'concurrent writes to different fields…' + '…same field notify…' (optimistic seq check, retry)
- C4 D1 50-query budget — push cap 30 (too-many), preload, one-statement notice delivery, proposals limit 50 + bulk song load
- C5 parallel PIN guesses — 'parallel wrong PINs cannot get past the per-IP limit' (takeAttempt reserve-first)
- I3 editor-controlled seen — 'stored seen comes from the server'
- I4 approve over unseen change — 'approving with an out-of-date view is refused (409)' (decide takes seen)
- I5 double approval — 'two approvals at once create one song' (claim 'approving')
- I6 duplicate-label diff — 'a dropped duplicate chorus is shown as removed'
- I7 no revoke/logout — 'a leader can list and revoke a linked computer', 'logout ends only that session'
- M4 (re-graded: clients would trip) setlist normalization — 'items are normalized…'
- M1 login timing (dummy hash) — no test (timing)

### Pendientes menores
- M3 concurrent pulls may duplicate a notice
- M5 style objects capped at 4000 chars (done partially)
- M6 attempts table never pruned
- M7 partial push on thrown error (clients replay idempotently)
- M8 'unknown' IP key in dev
- M9 church code rotation collision → 500

## B1c — Sincronización en la compu

### Decisiones
- Task 1: Ruling: SCHEMA moved to electron/db/schemaSql.ts (pure) so node:sqlite tests can build a v5 DB — database.ts imports it — none. uid = 32 hex chars via trigger.
- Task 2: Ruling: services are a unit — a locally edited service is kept whole over the incoming one (pushed next, server LWW + notice). Link matches setlists by name+date and folders by name too. A video already present with the same file name keeps its local path. Added tests for folders-first, deletes, kept local setlist.
- Task 3: Ruling: while live, run() only peeks (pull without applying, seq not advanced) and still pushes; state 'held' when something waits — cost: few minutes of delay.
- Task 3: Ruling: refused changes other than song-in-use become a notice "No se pudo subir…" and are retried next run — cost: repeated notice each run if data is invalid.
- Task 3: Ruling: cloud/src/db.ts declares a local D1Like type so the desktop tsc (which sees cloud code via engine tests) needs no Workers types.
- Task 4: Ruling: token stored as 'safe:<base64>' via safeStorage (DPAPI) or 'plain:' fallback; deviceName = os.hostname(); run() calls are coalesced; pushOnly skipped while a run is in flight. Added tests: wrong install key, link adopts, unlink.
- Task 5: E2E (Electron + Playwright vs wrangler dev --local, copy of real DB): 7/7 PASS — create church from Settings, codes shown, sidebar 'Sincronizado', 101/101 songs + 4 services uploaded, phone key change + phone service reach computer, computer edit reaches cloud. Ruling: notices shown as 'error' toasts (2.5 s) — toast store has only success/error — cost: short-lived.
- Security review #7 (applyRemote restore): Ruling: restoring a song a cloud service uses is the spec'd behavior (delete refused when in a service) and comes with a notice; the cloud is the church's source of truth — cost: a compromised cloud could re-insert songs (it could already push any song).

### Corregido tras la revisión final
- I1 edit during push lost — 'an edit saved while its push is in flight is not lost'
- I2 pushOnly echo resurrects delete — 'a song deleted here after pushOnly uploaded it stays deleted' (songs/setlists/folders)
- I3 cloud service vs local delete in same run — 'a service from the phone that uses a song deleted here restores it in the same run'
- I4 link snapshots before uid rewrite — 'an adopted service with adopted songs is not seen as edited here'
- I5 stale renderer — draft reconcile tests (reload/warn/forget) + mergeEdits tests for SongEditor
- I6 timers after unlink/relink — 'timers start after setup…'
- I7 foreign/seed uids — 'setup gives every row fresh ids…' + make-seed.py strips sync state and re-mints uids
- Minor1 duplicated notices — 'a syncing message never repeats old notices'
- Minor4 apply after push while live (one-line guard, covered by held test)

### Pendientes menores
- run() may overlap an in-flight pushOnly (duplicate pushes, harmless)
- unlink during a run can leave stale seq/snapshot (setup now clears them)
- held changes may wait up to 3 min after projection closes if a peek is in flight
- own echoes can show "cambios en espera" while projecting
- successful pushOnly after offline keeps 'error' until next run
- song-in-use restore uses userData/videos path and new id (stems lost)
- remote song deletes don't purge stem folders
- service custom videos lose non-userData local path on apply

## B1d — App del celular (PWA)

### Decisiones
- Task 2+3: Ruling: built shell and screens together (App imports every screen) and verified with one E2E — cost: none.
- Ruling: cloud/public is build output → gitignored; cloud:deploy builds the PWA first.
- Ruling: native confirm()/prompt() used in the PWA (the no-native-dialogs rule is for the Electron renderer) — cost: plain browser dialogs on the phone.
- Final: Ruling: client validates cloud limits before saving (validateSong test) — cost: limits duplicated in two places

### Corregido tras la revisión final
- C1 sync drops edits made meanwhile — 'edits made while a sync runs survive it' (outbox id+rev, mergeSyncResult)
- C2 refused change stays on screen — 'a refused change disappears from the screen' (base + replay)
- I1 service pushed before new song — 'a later setlist edit moves after songs created meanwhile'
- I2 stale editors revert others — SongEdit/ServiceEditor snapshot at open; 'leader song edit … versions seen when the editor opened'
- I3 approve with wrong seen — cloud returns current_versions (cloud test RED→GREEN), Pending sends them
- I4 other church/person data kept — owner {churchId, actor} kept after 401; /api/me churchId (test RED→GREEN)
- I5 sign-out during sync — mergeSyncResult ignores results for another token
- I6/I7 SW — pre-caches first-load assets via postMessage, 3 s nav timeout, never caches HTML under /assets or error pages (verified by prod smoke)
- I8 — 4xx batch dropped with notice and pull continues ('a 4xx answer to a push drops that batch'); busy stays queued; 5xx retried
- M1 (vanished service view + error boundary), M3 (re-run sync flag), M4 (one IDB connection, save errors toast, storage.persist), M5 (local date), M7 (offline logout told)

### Pendientes menores
- M2 proposals not idempotent (a lost response can duplicate a proposal)
- M6 some 36–40 px touch targets; clickable cards lack role=button/keyboard
- no React-level store tests (core merge logic is tested)

