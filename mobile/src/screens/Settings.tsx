import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../store'
import { call } from '../api'
import { Button, Card, Input, Label, Page, Select } from '../ui'

interface UserView { id: string; name: string; role: 'leader' | 'editor'; active: boolean }
interface DeviceView { id: string; name: string; created_at: string; revoked: boolean }

const ROLE: Record<string, string> = { leader: 'Líder', editor: 'Editor', member: 'Miembro', desktop: 'Compu' }

export default function Settings() {
  const { state, sync, syncing, signOut } = useStore()
  const me = state.me!
  const queued = state.outbox.length + state.pendingProposals.length

  async function out() {
    if (queued && !confirm(`Tienes ${queued} cambio(s) sin subir. Si sales ahora se pierden. ¿Salir de todos modos?`)) return
    await signOut()
  }

  return (
    <Page title="Ajustes">
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <p className="font-semibold">{me.church.name}</p>
          <p className="text-sm text-slate-400">{me.name} · {ROLE[me.role]}</p>
          <p className="text-xs text-slate-500 mt-2">
            Última sincronización: {state.lastSync ? new Date(state.lastSync).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'nunca'}
          </p>
          <Button variant="secondary" className="w-full mt-3" disabled={syncing} onClick={() => void sync()}>
            {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
          </Button>
        </Card>
        {me.role === 'leader' && <ChurchCode />}
        {me.role === 'leader' && <Users />}
        {me.role === 'leader' && <Devices />}
        <Button variant="ghost" className="text-red-400" onClick={() => void out()}>Salir</Button>
      </div>
    </Page>
  )
}

function ChurchCode() {
  const { state, sync, showToast } = useStore()
  const token = state.session!.token
  async function rotate() {
    if (!confirm('Los miembros tendrán que entrar con el código nuevo. Líderes y editores no se ven afectados. ¿Cambiar el código?')) return
    const r = await call<{ churchCode: string }>(token, 'POST', '/api/church/rotate-code')
    if (!r.ok) { showToast(r.error, 'error'); return }
    showToast(`Código nuevo: ${r.data.churchCode}`)
    await sync()
  }
  return (
    <Card>
      <Label>Código de la iglesia (para los miembros)</Label>
      <p className="font-mono text-2xl tracking-widest">{state.me?.church.code ?? '—'}</p>
      <Button variant="secondary" className="w-full mt-3" onClick={() => void rotate()}>Cambiar código</Button>
    </Card>
  )
}

function Users() {
  const { state, showToast } = useStore()
  const token = state.session!.token
  const [users, setUsers] = useState<UserView[] | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState<'editor' | 'leader'>('editor')
  const [pin, setPin] = useState('')

  const load = useCallback(async () => {
    const r = await call<{ users: UserView[] }>(token, 'GET', '/api/users')
    if (r.ok) setUsers(r.data.users); else showToast(r.error, 'error')
  }, [token, showToast])
  useEffect(() => { void load() }, [load])

  async function create() {
    const r = await call(token, 'POST', '/api/users', { name, role, pin })
    if (!r.ok) { showToast(r.error, 'error'); return }
    showToast(`${name} ya puede entrar con su PIN`)
    setName(''); setPin('')
    await load()
  }
  async function patch(u: UserView, body: object, done: string) {
    const r = await call(token, 'PATCH', `/api/users/${u.id}`, body)
    if (!r.ok) showToast(r.error, 'error'); else showToast(done)
    await load()
  }
  function resetPin(u: UserView) {
    const p = prompt(`PIN nuevo para ${u.name} (4 a 8 números):`)
    if (p) void patch(u, { pin: p.replace(/\D/g, '') }, 'PIN cambiado')
  }

  return (
    <Card>
      <h2 className="font-semibold mb-3">Personas</h2>
      <div className="grid gap-2 mb-4">
        {users?.map(u => (
          <div key={u.id} className={`rounded-xl bg-slate-900 p-3 ${u.active ? '' : 'opacity-50'}`}>
            <p className="font-medium">{u.name} <span className="text-xs text-slate-400">· {ROLE[u.role]}{u.active ? '' : ' · desactivado'}</span></p>
            <div className="flex flex-wrap gap-2 mt-2">
              {u.active && <Button variant="secondary" className="!min-h-9 !px-3 text-xs"
                onClick={() => void patch(u, { role: u.role === 'leader' ? 'editor' : 'leader' }, 'Rol cambiado')}>
                {u.role === 'leader' ? 'Hacer editor' : 'Hacer líder'}
              </Button>}
              {u.active && <Button variant="secondary" className="!min-h-9 !px-3 text-xs" onClick={() => resetPin(u)}>Cambiar PIN</Button>}
              <Button variant="ghost" className="!min-h-9 !px-3 text-xs" onClick={() => void patch(u, { active: !u.active }, u.active ? 'Desactivado' : 'Activado')}>
                {u.active ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <h3 className="text-sm text-slate-400 mb-2">Agregar persona</h3>
      <div className="grid grid-cols-1 gap-2">
        <Input placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Select value={role} onChange={e => setRole(e.target.value as 'editor' | 'leader')} aria-label="Rol">
            <option value="editor">Editor (propone)</option>
            <option value="leader">Líder</option>
          </Select>
          <Input placeholder="PIN" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
        </div>
        <Button disabled={!name.trim() || pin.length < 4} onClick={() => void create()}>Agregar</Button>
      </div>
    </Card>
  )
}

function Devices() {
  const { state, showToast } = useStore()
  const token = state.session!.token
  const [devices, setDevices] = useState<DeviceView[] | null>(null)
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null)

  const load = useCallback(async () => {
    const r = await call<{ devices: DeviceView[] }>(token, 'GET', '/api/devices')
    if (r.ok) setDevices(r.data.devices)
  }, [token])
  useEffect(() => { void load() }, [load])

  async function newCode() {
    const r = await call<{ code: string; expiresAt: string }>(token, 'POST', '/api/link-codes')
    if (r.ok) setCode(r.data); else showToast(r.error, 'error')
  }
  async function revoke(d: DeviceView) {
    if (!confirm(`«${d.name}» dejará de sincronizarse con la nube. ¿Quitar acceso?`)) return
    const r = await call(token, 'PATCH', `/api/devices/${d.id}`, { revoked: true })
    if (!r.ok) showToast(r.error, 'error')
    await load()
  }

  return (
    <Card>
      <h2 className="font-semibold mb-3">Compus</h2>
      <div className="grid gap-2 mb-3">
        {devices?.map(d => (
          <div key={d.id} className="flex items-center gap-2 rounded-xl bg-slate-900 p-3">
            <span className={`flex-1 ${d.revoked ? 'line-through text-slate-500' : ''}`}>💻 {d.name}</span>
            {!d.revoked && <Button variant="ghost" className="!min-h-9 text-xs text-red-400" onClick={() => void revoke(d)}>Quitar acceso</Button>}
          </div>
        ))}
      </div>
      {code ? (
        <div className="rounded-xl bg-indigo-600/20 border border-indigo-500/40 p-4 text-center">
          <p className="text-sm text-slate-300">En la compu: Ajustes → ALADO conectado → Vincular con código</p>
          <p className="font-mono text-3xl tracking-[0.3em] my-2">{code.code}</p>
          <p className="text-xs text-slate-400">Vence a las {new Date(code.expiresAt).toLocaleTimeString('es-MX', { timeStyle: 'short' })}</p>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => void newCode()}>Vincular una compu</Button>
      )}
    </Card>
  )
}
