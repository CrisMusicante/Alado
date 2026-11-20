import type { Role } from '../../shared/types'
import { type Ctx, type Result, fail, iso } from './ctx'
import { CODE_ALPHABET, hashSecret, randomCode, randomId, randomToken, sha256, verifySecret } from './crypto'

export interface Session {
  churchId: string
  role: Role
  userId?: string
  deviceId?: string
  name: string
  /** Who wrote a change: `user:<id>`, `device:<id>` or `member`. */
  actor: string
}

const MAX_ATTEMPTS = 5
const LOCK_MS = 15 * 60_000
const LINK_CODE_MS = 10 * 60_000
const LINK_CODE_DIGITS = 8
const PIN_RE = /^\d{4,8}$/

/** Church and recovery codes are typed by hand: ignore case, spaces and dashes. */
export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')
export const formatChurchCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`
const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ')

interface ChurchRow { id: string; name: string; code: string; code_version: number; recovery_hash: string }
interface UserRow { id: string; church_id: string; name: string; role: 'leader' | 'editor'; pin_hash: string; active: number }

// ---------- Brute-force protection ----------

/** Per (IP, target) limit, and a looser per-target limit so one attacker can't lock someone out from afar. */
const PER_IP = 5
const PER_TARGET = 20
/** Phones on one church wifi share an IP: allow a few more typos per IP for the shared codes. */
const PER_SHARED_IP = 20
/** All link attempts together; high enough that a few strangers can't block linking (8-digit codes, 10 min). */
const LINK_GLOBAL = 200

async function isLocked(ctx: Ctx, key: string, limit: number): Promise<boolean> {
  const row = await ctx.db.first<{ count: number; window_start: string }>('SELECT count, window_start FROM attempts WHERE key = ?', key)
  return !!row && row.count >= limit && ctx.now() - Date.parse(row.window_start) < LOCK_MS
}

/** Atomic: one upsert restarts an expired window or increments the current one. */
async function recordFailure(ctx: Ctx, key: string): Promise<void> {
  const now = iso(ctx.now())
  const expired = iso(ctx.now() - LOCK_MS)
  await ctx.db.run(
    `INSERT INTO attempts (key, count, window_start) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN attempts.window_start <= ? THEN 1 ELSE attempts.count + 1 END,
       window_start = CASE WHEN attempts.window_start <= ? THEN excluded.window_start ELSE attempts.window_start END`,
    key, now, expired, expired)
}

const clearFailures = (ctx: Ctx, key: string) => ctx.db.run('DELETE FROM attempts WHERE key = ?', key)

const locked = () => fail(429, 'Demasiados intentos. Espera 15 minutos.')

// ---------- Sessions ----------

async function newSession(ctx: Ctx, churchId: string, role: Role, ids: { userId?: string; deviceId?: string; codeVersion?: number }) {
  const token = randomToken()
  await ctx.db.run(
    'INSERT INTO sessions (token_hash, church_id, user_id, device_id, role, code_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    await sha256(token), churchId, ids.userId ?? null, ids.deviceId ?? null, role, ids.codeVersion ?? null, iso(ctx.now())
  )
  return token
}

/** The session behind a bearer token, or null if unknown, revoked or no longer valid. */
export async function authenticate(ctx: Ctx, token: string | null | undefined): Promise<Session | null> {
  if (!token) return null
  const s = await ctx.db.first<{ church_id: string; user_id: string | null; device_id: string | null; role: Role; code_version: number | null; revoked: number }>(
    'SELECT church_id, user_id, device_id, role, code_version, revoked FROM sessions WHERE token_hash = ?', await sha256(token)
  )
  if (!s || s.revoked) return null

  if (s.role === 'member') {
    const church = await ctx.db.first<{ code_version: number }>('SELECT code_version FROM churches WHERE id = ?', s.church_id)
    if (!church || church.code_version !== s.code_version) return null
    return { churchId: s.church_id, role: 'member', name: 'Miembro', actor: 'member' }
  }
  if (s.role === 'desktop') {
    const d = await ctx.db.first<{ name: string; revoked: number }>('SELECT name, revoked FROM devices WHERE id = ?', s.device_id)
    if (!d || d.revoked) return null
    return { churchId: s.church_id, role: 'desktop', deviceId: s.device_id!, name: d.name, actor: `device:${s.device_id}` }
  }
  // Leader/editor: the role is read live, so promotions and deactivations apply at once.
  const u = await ctx.db.first<UserRow>('SELECT * FROM users WHERE id = ?', s.user_id)
  if (!u || !u.active) return null
  return { churchId: s.church_id, role: u.role, userId: u.id, name: u.name, actor: `user:${u.id}` }
}

const churchByCode = (ctx: Ctx, code: string) =>
  ctx.db.first<ChurchRow>('SELECT * FROM churches WHERE code = ?', normalizeCode(code))

// ---------- Setup, login, linking ----------

/** Constant-time comparison via hashes of equal length. */
async function sameSecret(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)])
  let diff = 0
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i)
  return diff === 0
}

export async function setupChurch(ctx: Ctx, p: { churchName: string; leaderName: string; pin: string; deviceName: string; setupKey?: string }):
  Promise<Result<{ churchCode: string; recoveryCode: string; deviceToken: string; churchName: string }>> {
  if (ctx.setupKey && !(await sameSecret(String(p.setupKey ?? ''), ctx.setupKey))) {
    return fail(403, 'Clave de instalación incorrecta.')
  }
  const churchName = normalizeName(p.churchName ?? '')
  const leaderName = normalizeName(p.leaderName ?? '')
  const deviceName = normalizeName(p.deviceName ?? '') || 'Compu'
  if (!churchName || !leaderName) return fail(400, 'Faltan el nombre de la iglesia o del líder.')
  if (!PIN_RE.test(p.pin ?? '')) return fail(400, 'El PIN debe tener de 4 a 8 números.')
  // One church for now (spec): the first setup wins.
  if (await ctx.db.first('SELECT id FROM churches LIMIT 1')) return fail(409, 'Ya existe una iglesia configurada.')

  const churchId = randomId()
  const userId = randomId()
  const deviceId = randomId()
  const code = randomCode(8)
  const recoveryCode = randomCode(16)
  const now = iso(ctx.now())
  await ctx.db.batch([
    { sql: 'INSERT INTO churches (id, name, code, recovery_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      params: [churchId, churchName, code, await hashSecret(recoveryCode), now] },
    { sql: 'INSERT INTO users (id, church_id, name, role, pin_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      params: [userId, churchId, leaderName, 'leader', await hashSecret(p.pin), now] },
    { sql: 'INSERT INTO devices (id, church_id, name, created_at) VALUES (?, ?, ?, ?)',
      params: [deviceId, churchId, deviceName, now] },
  ])
  const deviceToken = await newSession(ctx, churchId, 'desktop', { deviceId })
  return { ok: true, churchCode: formatChurchCode(code), recoveryCode, deviceToken, churchName }
}

export async function login(ctx: Ctx, ip: string, p: { churchCode: string; name: string; pin: string }):
  Promise<Result<{ token: string; role: Role; userId: string; name: string; churchName: string }>> {
  const ipKey = `ip:${ip}:login`
  if (await isLocked(ctx, ipKey, PER_SHARED_IP)) return locked()
  const church = await churchByCode(ctx, p.churchCode ?? '')
  if (!church) {
    await recordFailure(ctx, ipKey)
    return fail(401, 'Código de iglesia, nombre o PIN incorrectos.')
  }
  const name = normalizeName(p.name ?? '')
  const account = `${church.id}:${name.toLowerCase()}`
  const ipAccountKey = `login:${ip}:${account}`
  const accountKey = `login:*:${account}`
  if (await isLocked(ctx, ipAccountKey, PER_IP) || await isLocked(ctx, accountKey, PER_TARGET)) return locked()
  const user = await ctx.db.first<UserRow>('SELECT * FROM users WHERE church_id = ? AND name = ? COLLATE NOCASE', church.id, name)
  if (!user || !user.active || !(await verifySecret(p.pin ?? '', user.pin_hash))) {
    await recordFailure(ctx, ipAccountKey)
    await recordFailure(ctx, accountKey)
    return fail(401, 'Código de iglesia, nombre o PIN incorrectos.')
  }
  await clearFailures(ctx, ipAccountKey)
  const token = await newSession(ctx, church.id, user.role, { userId: user.id })
  return { ok: true, token, role: user.role, userId: user.id, name: user.name, churchName: church.name }
}

export async function loginMember(ctx: Ctx, ip: string, p: { churchCode: string }):
  Promise<Result<{ token: string; role: 'member'; churchName: string }>> {
  const key = `ip:${ip}:member`
  if (await isLocked(ctx, key, PER_SHARED_IP)) return locked()
  const church = await churchByCode(ctx, p.churchCode ?? '')
  if (!church) {
    await recordFailure(ctx, key)
    return fail(401, 'Código de iglesia incorrecto.')
  }
  const token = await newSession(ctx, church.id, 'member', { codeVersion: church.code_version })
  return { ok: true, token, role: 'member', churchName: church.name }
}

const requireLeader = (s: Session) => (s.role === 'leader' ? null : fail(403, 'Solo un líder puede hacer esto.'))

export async function createLinkCode(ctx: Ctx, s: Session): Promise<Result<{ code: string; expiresAt: string }>> {
  const denied = requireLeader(s)
  if (denied) return denied
  const code = randomCode(LINK_CODE_DIGITS, '0123456789')
  const expiresAt = iso(ctx.now() + LINK_CODE_MS)
  await ctx.db.run('INSERT INTO link_codes (code_hash, church_id, expires_at) VALUES (?, ?, ?)', await sha256(code), s.churchId, expiresAt)
  return { ok: true, code, expiresAt }
}

export async function linkDevice(ctx: Ctx, ip: string, p: { code: string; deviceName: string }):
  Promise<Result<{ deviceToken: string; churchName: string }>> {
  const key = `ip:${ip}:link`
  // Codes are short-lived but guessable from many IPs: cap failures globally too.
  const globalKey = 'link:*'
  if (await isLocked(ctx, key, PER_IP) || await isLocked(ctx, globalKey, LINK_GLOBAL)) return locked()
  const hash = await sha256(String(p.code ?? '').replace(/\D/g, ''))
  const row = await ctx.db.first<{ church_id: string; expires_at: string; used: number }>('SELECT * FROM link_codes WHERE code_hash = ?', hash)
  if (!row || row.used || Date.parse(row.expires_at) <= ctx.now()) {
    await recordFailure(ctx, key)
    await recordFailure(ctx, globalKey)
    return fail(401, 'Código de vinculación inválido o vencido.')
  }
  const used = await ctx.db.run('UPDATE link_codes SET used = 1 WHERE code_hash = ? AND used = 0', hash)
  if (!used.changes) return fail(401, 'Código de vinculación inválido o vencido.')
  const deviceId = randomId()
  await ctx.db.run('INSERT INTO devices (id, church_id, name, created_at) VALUES (?, ?, ?, ?)',
    deviceId, row.church_id, normalizeName(p.deviceName ?? '') || 'Compu', iso(ctx.now()))
  const church = await ctx.db.first<ChurchRow>('SELECT * FROM churches WHERE id = ?', row.church_id)
  return { ok: true, deviceToken: await newSession(ctx, row.church_id, 'desktop', { deviceId }), churchName: church!.name }
}

export async function recover(ctx: Ctx, ip: string, p: { churchCode: string; recoveryCode: string; leaderName: string; newPin: string }):
  Promise<Result> {
  const key = `ip:${ip}:recover`
  if (await isLocked(ctx, key, PER_IP)) return locked()
  const church = await churchByCode(ctx, p.churchCode ?? '')
  const ok = church && await verifySecret(normalizeCode(p.recoveryCode ?? ''), church.recovery_hash)
  if (!church || !ok) {
    await recordFailure(ctx, key)
    return fail(401, 'Código de iglesia o de recuperación incorrecto.')
  }
  if (!PIN_RE.test(p.newPin ?? '')) return fail(400, 'El PIN debe tener de 4 a 8 números.')
  const leader = await ctx.db.first<UserRow>(
    "SELECT * FROM users WHERE church_id = ? AND name = ? COLLATE NOCASE AND role = 'leader'", church.id, normalizeName(p.leaderName ?? ''))
  if (!leader) return fail(404, 'No hay un líder con ese nombre.')
  // New PIN, and every old session of that leader is logged out.
  await ctx.db.batch([
    { sql: 'UPDATE users SET pin_hash = ? WHERE id = ?', params: [await hashSecret(p.newPin), leader.id] },
    { sql: 'UPDATE sessions SET revoked = 1 WHERE user_id = ?', params: [leader.id] },
  ])
  await clearFailures(ctx, key)
  return { ok: true }
}

// ---------- Church and users (leader only) ----------

export async function churchInfo(ctx: Ctx, s: Session): Promise<{ name: string; code: string | null }> {
  const c = await ctx.db.first<ChurchRow>('SELECT * FROM churches WHERE id = ?', s.churchId)
  // Only leaders see the members' code (they hand it out).
  return { name: c!.name, code: s.role === 'leader' ? formatChurchCode(c!.code) : null }
}

export async function rotateChurchCode(ctx: Ctx, s: Session): Promise<Result<{ churchCode: string }>> {
  const denied = requireLeader(s)
  if (denied) return denied
  const code = randomCode(8)
  await ctx.db.run('UPDATE churches SET code = ?, code_version = code_version + 1 WHERE id = ?', code, s.churchId)
  return { ok: true, churchCode: formatChurchCode(code) }
}

export interface UserView { id: string; name: string; role: 'leader' | 'editor'; active: boolean }

export async function listUsers(ctx: Ctx, s: Session): Promise<Result<{ users: UserView[] }>> {
  const denied = requireLeader(s)
  if (denied) return denied
  const rows = await ctx.db.all<UserRow>('SELECT * FROM users WHERE church_id = ? ORDER BY name COLLATE NOCASE', s.churchId)
  return { ok: true, users: rows.map(u => ({ id: u.id, name: u.name, role: u.role, active: !!u.active })) }
}

export async function createUser(ctx: Ctx, s: Session, p: { name: string; role: 'leader' | 'editor'; pin: string }):
  Promise<Result<{ id: string }>> {
  const denied = requireLeader(s)
  if (denied) return denied
  const name = normalizeName(p.name ?? '')
  if (!name) return fail(400, 'Falta el nombre.')
  if (p.role !== 'leader' && p.role !== 'editor') return fail(400, 'Rol inválido.')
  if (!PIN_RE.test(p.pin ?? '')) return fail(400, 'El PIN debe tener de 4 a 8 números.')
  if (await ctx.db.first('SELECT id FROM users WHERE church_id = ? AND name = ? COLLATE NOCASE', s.churchId, name)) {
    return fail(409, 'Ya existe alguien con ese nombre.')
  }
  const id = randomId()
  await ctx.db.run('INSERT INTO users (id, church_id, name, role, pin_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id, s.churchId, name, p.role, await hashSecret(p.pin), iso(ctx.now()))
  return { ok: true, id }
}

export async function updateUser(ctx: Ctx, s: Session, id: string, p: { role?: 'leader' | 'editor'; pin?: string; active?: boolean }):
  Promise<Result> {
  const denied = requireLeader(s)
  if (denied) return denied
  const user = await ctx.db.first<UserRow>('SELECT * FROM users WHERE id = ? AND church_id = ?', id, s.churchId)
  if (!user) return fail(404, 'No existe ese usuario.')
  if (p.role !== undefined && p.role !== 'leader' && p.role !== 'editor') return fail(400, 'Rol inválido.')
  if (p.pin !== undefined && !PIN_RE.test(p.pin)) return fail(400, 'El PIN debe tener de 4 a 8 números.')

  const losesLeadership = user.role === 'leader' && user.active && (p.role === 'editor' || p.active === false)
  if (losesLeadership) {
    const others = await ctx.db.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM users WHERE church_id = ? AND role = 'leader' AND active = 1 AND id <> ?", s.churchId, id)
    if (!others || others.n === 0) return fail(409, 'Debe quedar al menos un líder activo.')
  }

  const stmts: { sql: string; params: unknown[] }[] = []
  if (p.role !== undefined) stmts.push({ sql: 'UPDATE users SET role = ? WHERE id = ?', params: [p.role, id] })
  if (p.active !== undefined) stmts.push({ sql: 'UPDATE users SET active = ? WHERE id = ?', params: [p.active ? 1 : 0, id] })
  if (p.pin !== undefined) {
    stmts.push({ sql: 'UPDATE users SET pin_hash = ? WHERE id = ?', params: [await hashSecret(p.pin), id] })
  }
  // A new PIN or deactivation logs the person out everywhere.
  if (p.pin !== undefined || p.active === false) {
    stmts.push({ sql: 'UPDATE sessions SET revoked = 1 WHERE user_id = ?', params: [id] })
  }
  if (stmts.length) await ctx.db.batch(stmts)
  return { ok: true }
}

export { CODE_ALPHABET }
