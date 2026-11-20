import { describe, it, expect, beforeEach } from 'vitest'
import { sqliteDb } from './sqliteDb'
import type { Ctx } from '../src/ctx'
import {
  setupChurch, login, loginMember, authenticate, createLinkCode, linkDevice,
  listUsers, createUser, updateUser, rotateChurchCode, recover, type Session,
} from '../src/auth'

let ctx: Ctx
let clock: number
const IP = '1.2.3.4'

async function setup() {
  const r = await setupChurch(ctx, { churchName: 'Iglesia', leaderName: 'Cris', pin: '1234', deviceName: 'Compu pastor' })
  if (!r.ok) throw new Error(r.error)
  return r
}
async function session(token: string): Promise<Session> {
  const s = await authenticate(ctx, token)
  if (!s) throw new Error('no session')
  return s
}

beforeEach(() => {
  clock = Date.parse('2026-11-21T10:00:00Z')
  ctx = { db: sqliteDb(), now: () => clock }
})

describe('setup', () => {
  it('setup creates church, leader and a desktop session', async () => {
    const r = await setup()
    expect(r.churchCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(r.recoveryCode).toHaveLength(16)
    const s = await session(r.deviceToken)
    expect(s.role).toBe('desktop')
    expect(s.name).toBe('Compu pastor')
    const l = await login(ctx, IP, { churchCode: r.churchCode, name: 'cris', pin: '1234' })
    expect(l.ok && l.role).toBe('leader')
  })

  it('setup twice returns 409', async () => {
    await setup()
    const again = await setupChurch(ctx, { churchName: 'Otra', leaderName: 'X', pin: '9999', deviceName: 'PC' })
    expect(again).toMatchObject({ ok: false, status: 409 })
  })

  it('rejects a PIN shorter than 4 digits', async () => {
    const r = await setupChurch(ctx, { churchName: 'Iglesia', leaderName: 'Cris', pin: '12', deviceName: 'PC' })
    expect(r).toMatchObject({ ok: false, status: 400 })
  })
})

describe('login', () => {
  it('login with right PIN returns a leader token', async () => {
    const { churchCode } = await setup()
    const l = await login(ctx, IP, { churchCode: churchCode.replace('-', '').toLowerCase(), name: ' Cris ', pin: '1234' })
    if (!l.ok) throw new Error(l.error)
    expect(l.role).toBe('leader')
    expect((await session(l.token)).role).toBe('leader')
  })

  it('wrong PIN 5 times locks even the right PIN', async () => {
    const { churchCode } = await setup()
    for (let i = 0; i < 5; i++) {
      expect(await login(ctx, IP, { churchCode, name: 'Cris', pin: '0000' })).toMatchObject({ ok: false, status: 401 })
    }
    expect(await login(ctx, IP, { churchCode, name: 'Cris', pin: '1234' })).toMatchObject({ ok: false, status: 429 })
    clock += 16 * 60_000
    expect((await login(ctx, IP, { churchCode, name: 'Cris', pin: '1234' })).ok).toBe(true)
  })

  it('member login with church code gives member role', async () => {
    const { churchCode } = await setup()
    const m = await loginMember(ctx, IP, { churchCode })
    if (!m.ok) throw new Error(m.error)
    expect((await session(m.token)).role).toBe('member')
    expect(await loginMember(ctx, IP, { churchCode: 'ZZZZ-ZZZZ' })).toMatchObject({ ok: false, status: 401 })
  })

  it('rotating the code invalidates member sessions but not leader ones', async () => {
    const { churchCode } = await setup()
    const m = await loginMember(ctx, IP, { churchCode })
    const l = await login(ctx, IP, { churchCode, name: 'Cris', pin: '1234' })
    if (!m.ok || !l.ok) throw new Error('login')
    const r = await rotateChurchCode(ctx, await session(l.token))
    if (!r.ok) throw new Error(r.error)
    expect(r.churchCode).not.toBe(churchCode)
    expect(await authenticate(ctx, m.token)).toBeNull()
    expect(await authenticate(ctx, l.token)).not.toBeNull()
    expect((await loginMember(ctx, IP, { churchCode: r.churchCode })).ok).toBe(true)
  })
})

describe('device linking', () => {
  it('link code works once and expires after 10 minutes', async () => {
    const { churchCode } = await setup()
    const l = await login(ctx, IP, { churchCode, name: 'Cris', pin: '1234' })
    if (!l.ok) throw new Error(l.error)
    const leader = await session(l.token)

    const c1 = await createLinkCode(ctx, leader)
    if (!c1.ok) throw new Error(c1.error)
    expect(c1.code).toMatch(/^\d{8}$/)
    const d = await linkDevice(ctx, IP, { code: c1.code, deviceName: 'Compu Cris' })
    if (!d.ok) throw new Error(d.error)
    expect((await session(d.deviceToken)).role).toBe('desktop')
    expect(await linkDevice(ctx, IP, { code: c1.code, deviceName: 'Otra' })).toMatchObject({ ok: false, status: 401 })

    const c2 = await createLinkCode(ctx, leader)
    if (!c2.ok) throw new Error(c2.error)
    clock += 11 * 60_000
    expect(await linkDevice(ctx, IP, { code: c2.code, deviceName: 'Tarde' })).toMatchObject({ ok: false, status: 401 })
  })
})

describe('users', () => {
  async function leaderSession() {
    const { churchCode } = await setup()
    const l = await login(ctx, IP, { churchCode, name: 'Cris', pin: '1234' })
    if (!l.ok) throw new Error(l.error)
    return { churchCode, leader: await session(l.token) }
  }

  it('cannot deactivate or demote the last active leader', async () => {
    const { leader } = await leaderSession()
    expect(await updateUser(ctx, leader, leader.userId!, { active: false })).toMatchObject({ ok: false, status: 409 })
    expect(await updateUser(ctx, leader, leader.userId!, { role: 'editor' })).toMatchObject({ ok: false, status: 409 })
  })

  it('a second leader can be named', async () => {
    const { churchCode, leader } = await leaderSession()
    const u = await createUser(ctx, leader, { name: 'Pastor', role: 'editor', pin: '5555' })
    if (!u.ok) throw new Error(u.error)
    expect((await updateUser(ctx, leader, u.id, { role: 'leader' })).ok).toBe(true)
    const p = await login(ctx, IP, { churchCode, name: 'Pastor', pin: '5555' })
    expect(p.ok && p.role).toBe('leader')
    // now the first leader can step down
    expect((await updateUser(ctx, leader, leader.userId!, { role: 'editor' })).ok).toBe(true)
    const list = await listUsers(ctx, leader)
    expect(list.ok && list.users.map(x => [x.name, x.role])).toEqual([['Cris', 'editor'], ['Pastor', 'leader']])
  })

  it('a deactivated user can no longer log in and loses sessions', async () => {
    const { churchCode, leader } = await leaderSession()
    const u = await createUser(ctx, leader, { name: 'Ana', role: 'editor', pin: '4444' })
    if (!u.ok) throw new Error(u.error)
    const a = await login(ctx, IP, { churchCode, name: 'Ana', pin: '4444' })
    if (!a.ok) throw new Error(a.error)
    await updateUser(ctx, leader, u.id, { active: false })
    expect(await authenticate(ctx, a.token)).toBeNull()
    expect(await login(ctx, IP, { churchCode, name: 'Ana', pin: '4444' })).toMatchObject({ ok: false, status: 401 })
  })

  it('duplicate names are rejected', async () => {
    const { leader } = await leaderSession()
    expect(await createUser(ctx, leader, { name: 'cris', role: 'editor', pin: '4444' })).toMatchObject({ ok: false, status: 409 })
  })

  it('editor cannot create users (403)', async () => {
    const { churchCode, leader } = await leaderSession()
    await createUser(ctx, leader, { name: 'Ana', role: 'editor', pin: '4444' })
    const a = await login(ctx, IP, { churchCode, name: 'Ana', pin: '4444' })
    if (!a.ok) throw new Error(a.error)
    expect(await createUser(ctx, await session(a.token), { name: 'Beto', role: 'editor', pin: '1111' }))
      .toMatchObject({ ok: false, status: 403 })
  })

  it('recovery code resets a leader PIN', async () => {
    const { churchCode, recoveryCode } = await setup()
    const r = await recover(ctx, IP, { churchCode, recoveryCode: recoveryCode.toLowerCase(), leaderName: 'Cris', newPin: '8888' })
    expect(r.ok).toBe(true)
    expect((await login(ctx, IP, { churchCode, name: 'Cris', pin: '8888' })).ok).toBe(true)
    expect(await recover(ctx, IP, { churchCode, recoveryCode: 'WRONGWRONGWRONG2', leaderName: 'Cris', newPin: '1' }))
      .toMatchObject({ ok: false })
  })
})

describe('security hardening', () => {
  it('recovery revokes the leader sessions and does not reactivate', async () => {
    const { churchCode, recoveryCode } = await setup()
    const l = await login(ctx, IP, { churchCode, name: 'Cris', pin: '1234' })
    if (!l.ok) throw new Error(l.error)
    expect((await recover(ctx, IP, { churchCode, recoveryCode, leaderName: 'Cris', newPin: '8888' })).ok).toBe(true)
    expect(await authenticate(ctx, l.token)).toBeNull()
  })

  it('link codes have 8 digits', async () => {
    const { churchCode } = await setup()
    const l = await login(ctx, IP, { churchCode, name: 'Cris', pin: '1234' })
    if (!l.ok) throw new Error(l.error)
    const c = await createLinkCode(ctx, await session(l.token))
    expect(c.ok && c.code).toMatch(/^\d{8}$/)
  })

  it('link guessing from many IPs is capped globally', async () => {
    const { churchCode } = await setup()
    const l = await login(ctx, IP, { churchCode, name: 'Cris', pin: '1234' })
    if (!l.ok) throw new Error(l.error)
    const c = await createLinkCode(ctx, await session(l.token))
    if (!c.ok) throw new Error(c.error)
    for (let i = 0; i < 20; i++) await linkDevice(ctx, `10.0.0.${i}`, { code: '00000000', deviceName: 'x' })
    expect(await linkDevice(ctx, '10.0.1.1', { code: c.code, deviceName: 'PC' })).toMatchObject({ ok: false, status: 429 })
  })

  it('wrong PINs from another IP do not lock the leader out on theirs', async () => {
    const { churchCode } = await setup()
    for (let i = 0; i < 5; i++) await login(ctx, '6.6.6.6', { churchCode, name: 'Cris', pin: '0000' })
    expect((await login(ctx, IP, { churchCode, name: 'Cris', pin: '1234' })).ok).toBe(true)
  })

  it('an account still locks after 20 failures across IPs', async () => {
    const { churchCode } = await setup()
    for (let i = 0; i < 20; i++) await login(ctx, `10.0.0.${i}`, { churchCode, name: 'Cris', pin: '0000' })
    expect(await login(ctx, IP, { churchCode, name: 'Cris', pin: '1234' })).toMatchObject({ ok: false, status: 429 })
  })
})

