import { useState } from 'react'
import { useStore } from '../store'
import { call } from '../api'
import { Button, Input, Label } from '../ui'
import type { Me } from '../core/types'

/** Church code + name + PIN (leader/editor), or just the church code to follow along (member). */
export default function Login() {
  const { signIn, state } = useStore()
  const [mode, setMode] = useState<'user' | 'member'>('user')
  const [churchCode, setChurchCode] = useState(state.session?.churchCode ?? localStorage.getItem('alado.churchCode') ?? '')
  const [name, setName] = useState(localStorage.getItem('alado.name') ?? '')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const r = mode === 'user'
        ? await call<{ token: string }>(null, 'POST', '/api/login', { churchCode, name, pin })
        : await call<{ token: string }>(null, 'POST', '/api/login-member', { churchCode })
      if (!r.ok) { setError(r.error); return }
      const me = await call<Me>(r.data.token, 'GET', '/api/me')
      if (!me.ok) { setError(me.error); return }
      try {
        localStorage.setItem('alado.churchCode', churchCode)
        if (mode === 'user') localStorage.setItem('alado.name', name)
      } catch { /* private mode */ }
      const { role, name: myName, actor, church, pending } = me.data
      signIn({ token: r.data.token, churchCode: churchCode.toUpperCase() }, { role, name: myName, actor, church, pending })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-10 max-w-md mx-auto">
      <div className="text-center mb-8">
        <img src="/icon-192.png" alt="" className="w-20 h-20 mx-auto rounded-2xl mb-3" />
        <h1 className="text-2xl font-bold">ALADO</h1>
        <p className="text-slate-400 text-sm mt-1">Prepara el servicio desde tu celular</p>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-800 rounded-xl mb-6" role="tablist">
        {(['user', 'member'] as const).map(m => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null) }}
            className={`min-h-10 rounded-lg text-sm font-medium ${mode === m ? 'bg-indigo-600 text-white' : 'text-slate-300'}`}>
            {m === 'user' ? 'Líder o editor' : 'Solo ver'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 gap-4">
        <label>
          <Label>Código de la iglesia</Label>
          <Input value={churchCode} onChange={e => setChurchCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX"
            autoCapitalize="characters" autoComplete="off" className="font-mono tracking-widest" />
        </label>
        {mode === 'user' && (
          <>
            <label>
              <Label>Tu nombre</Label>
              <Input value={name} onChange={e => setName(e.target.value)} autoComplete="username" />
            </label>
            <label>
              <Label>PIN</Label>
              <Input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric"
                type="password" autoComplete="current-password" />
            </label>
          </>
        )}
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
        <Button type="submit" disabled={busy || !churchCode.trim() || (mode === 'user' && (!name.trim() || pin.length < 4))}>
          {busy ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      {mode === 'member' && <p className="text-xs text-slate-500 mt-4 text-center">Para ver letras y servicios. Pídele el código a tu líder.</p>}
    </div>
  )
}
