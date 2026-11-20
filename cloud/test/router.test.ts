import { describe, it, expect, beforeEach } from 'vitest'
import { sqliteDb } from './sqliteDb'
import { route } from '../src/router'
import type { Ctx } from '../src/ctx'

let ctx: Ctx
const call = (method: string, path: string, body?: unknown, token?: string, raw?: string) =>
  route(ctx, new Request(`https://alado.test${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '1.2.3.4',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  }))

beforeEach(() => { ctx = { db: sqliteDb(), now: () => Date.now(), setupKey: 'k' } })

describe('router', () => {
  it('health is public', async () => {
    const r = await call('GET', '/api/health')
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
  })

  it('sync without token is 401', async () => {
    expect((await call('POST', '/api/sync/pull', { since: 0 })).status).toBe(401)
  })

  it('unknown route is 404 JSON', async () => {
    const r = await call('GET', '/api/nope')
    expect(r.status).toBe(404)
    expect(await r.json()).toMatchObject({ ok: false })
  })

  it('bad JSON is 400', async () => {
    expect((await call('POST', '/api/login', undefined, undefined, '{nope')).status).toBe(400)
  })

  it('answers CORS preflight for the desktop app', async () => {
    const r = await call('OPTIONS', '/api/sync/pull')
    expect(r.status).toBe(204)
    expect(r.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
  })

  it('full flow: setup → login → push setlist → pull → proposals → users', async () => {
    const setup = await (await call('POST', '/api/setup', { churchName: 'Iglesia', leaderName: 'Cris', pin: '1234', deviceName: 'PC', setupKey: 'k' })).json() as { churchCode: string; deviceToken: string }
    const pc = setup.deviceToken
    const login = await (await call('POST', '/api/login', { churchCode: setup.churchCode, name: 'Cris', pin: '1234' })).json() as { token: string }
    const me = await (await call('GET', '/api/me', undefined, login.token)).json()
    expect(me).toMatchObject({ ok: true, role: 'leader', name: 'Cris', church: { name: 'Iglesia', code: setup.churchCode }, pending: 0 })
    expect(typeof (me as { churchId: unknown }).churchId).toBe('string')

    const pushRes = await (await call('POST', '/api/sync/push', { changes: [
      { kind: 'song', uid: 'a', seen: {}, fields: { title: 'Uno', artist: null, sections: [], song_key: 'E', video_file: null, text_style: null, sheet_style: null, folder_uid: null } },
      { kind: 'setlist', uid: 's', seenSeq: 0, data: { name: 'Domingo', service_date: '2026-11-22', notes: null, items: [{ song_uid: 'a', custom_video_file: null }] } },
    ] }, pc)).json() as { results: unknown[] }
    expect(pushRes.results).toEqual([{ ok: true }, { ok: true }])

    const pulled = await (await call('POST', '/api/sync/pull', { since: 0 }, login.token)).json() as { setlists: { name: string }[] }
    expect(pulled.setlists.map(s => s.name)).toEqual(['Domingo'])

    const user = await call('POST', '/api/users', { name: 'Ana', role: 'editor', pin: '4444' }, login.token)
    expect(user.status).toBe(200)
    const ana = await (await call('POST', '/api/login', { churchCode: setup.churchCode, name: 'Ana', pin: '4444' })).json() as { token: string }
    const prop = await (await call('POST', '/api/proposals', { song_uid: 'a', fields: { song_key: 'G' }, seen: {} }, ana.token)).json() as { id: string }
    const list = await (await call('GET', '/api/proposals?status=pending', undefined, login.token)).json() as { proposals: { id: string }[] }
    expect(list.proposals.map(p => p.id)).toEqual([prop.id])
    const d = await call('POST', `/api/proposals/${prop.id}/decide`, { action: 'approve' }, login.token)
    expect(d.status).toBe(200)

    const users = await (await call('GET', '/api/users', undefined, login.token)).json() as { users: { name: string }[] }
    expect(users.users.map(u => u.name)).toEqual(['Ana', 'Cris'])
    const users403 = await call('GET', '/api/users', undefined, ana.token)
    expect(users403.status).toBe(403)
  })
})
