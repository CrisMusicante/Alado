import { useEffect, useState } from 'react'
import { confirmDialog } from '../../store/dialog.store'
import { useSyncStore } from '../../store/sync.store'
import { whenText } from '../../components/SyncIndicator'

type Info = { linked: boolean; churchName: string | null; lastOk: string | null }
type Mode = 'choose' | 'setup' | 'link'

const input = 'w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 text-sm'
const primary = 'px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors'
const secondary = 'px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors border border-slate-600'

/** Configuración → "ALADO conectado": create the church, link with a code, or see the link. */
export default function CloudSection() {
  const [info, setInfo] = useState<Info | null>(null)
  const [mode, setMode] = useState<Mode>('choose')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codes, setCodes] = useState<{ churchCode: string; recoveryCode: string } | null>(null)
  const [linkResult, setLinkResult] = useState<string | null>(null)
  const status = useSyncStore(s => s.status)

  const refresh = () => window.api.syncInfo().then(setInfo)
  useEffect(() => { void refresh() }, [status.state, status.lastOk])

  // setup form
  const [churchName, setChurchName] = useState('')
  const [leaderName, setLeaderName] = useState('')
  const [pin, setPin] = useState('')
  const [setupKey, setSetupKey] = useState('')
  // link form
  const [code, setCode] = useState('')

  async function doSetup() {
    setBusy(true); setError(null)
    try {
      const r = await window.api.syncSetup({ churchName, leaderName, pin, setupKey })
      if (!r.ok) { setError(r.error); return }
      setCodes({ churchCode: r.churchCode, recoveryCode: r.recoveryCode })
      setPin(''); setSetupKey('')
      await refresh()
    } finally { setBusy(false) }
  }

  async function doLink() {
    setBusy(true); setError(null)
    try {
      const r = await window.api.syncLink({ code })
      if (!r.ok) { setError(r.error); return }
      const s = r.summary
      setLinkResult([
        `Vinculada a «${r.churchName}».`,
        `${s.adopted} canciones empatadas con la nube, ${s.uploaded} se subieron desde esta compu.`,
        s.replaced.length ? `La nube reemplazó la letra o el tono de: ${s.replaced.map(x => `«${x.title}»`).join(', ')}.` : '',
        s.backupFile ? `La versión anterior quedó respaldada en ${s.backupFile}.` : '',
      ].filter(Boolean).join(' '))
      setCode('')
      await refresh()
    } finally { setBusy(false) }
  }

  async function doUnlink() {
    const ok = await confirmDialog(
      'Esta compu dejará de sincronizarse. Las canciones y servicios se quedan aquí y en la nube.',
      { title: 'Desvincular de ALADO conectado', confirmLabel: 'Desvincular', danger: true })
    if (!ok) return
    await window.api.syncUnlink()
    setCodes(null); setLinkResult(null); setMode('choose')
    await refresh()
  }

  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-white mb-1">ALADO conectado</h2>
      <p className="text-sm text-slate-400 mb-4">
        Sincroniza canciones y servicios con la nube para prepararlos desde el celular.
      </p>

      {codes && (
        <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-200 mb-2">Imprime o anota estos códigos y guárdalos.</p>
          <p className="text-sm text-slate-200">Código de la iglesia (para entrar desde el celular): <span className="font-mono text-lg tracking-wider text-white">{codes.churchCode}</span></p>
          <p className="text-sm text-slate-200 mt-1">Código de recuperación (si olvidas tu PIN): <span className="font-mono text-white tracking-wider">{codes.recoveryCode}</span></p>
        </div>
      )}
      {linkResult && <p className="mb-4 text-sm text-emerald-300">{linkResult}</p>}
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {info?.linked ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">Vinculada a <span className="font-semibold">{info.churchName ?? 'tu iglesia'}</span></p>
            <p className="text-xs text-slate-400 mt-0.5">
              Última sincronización: {whenText(info.lastOk)}
              {status.state === 'error' && status.error ? ` · ${status.error}` : ''}
            </p>
          </div>
          <button className={secondary} onClick={() => void window.api.syncRun()} disabled={status.state === 'syncing'}>
            {status.state === 'syncing' ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
          <button className="text-sm text-slate-400 hover:text-red-400 px-2" onClick={doUnlink}>Desvincular</button>
        </div>
      ) : mode === 'choose' ? (
        <div className="flex gap-3">
          <button className={primary} onClick={() => { setMode('setup'); setError(null) }}>Crear la iglesia</button>
          <button className={secondary} onClick={() => { setMode('link'); setError(null) }}>Vincular con código</button>
        </div>
      ) : mode === 'setup' ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4 grid gap-3">
          <p className="text-sm text-slate-300">Hazlo una sola vez, desde la compu que proyecta. Esta compu subirá sus canciones y servicios.</p>
          <input className={input} placeholder="Nombre de la iglesia" value={churchName} onChange={e => setChurchName(e.target.value)} />
          <input className={input} placeholder="Tu nombre (líder)" value={leaderName} onChange={e => setLeaderName(e.target.value)} />
          <input className={input} placeholder="Tu PIN (4 a 8 números)" inputMode="numeric" type="password" value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
          <input className={input} placeholder="Clave de instalación" value={setupKey} onChange={e => setSetupKey(e.target.value)} />
          <div className="flex gap-3">
            <button className={primary} disabled={busy || !churchName.trim() || !leaderName.trim() || pin.length < 4 || !setupKey.trim()} onClick={doSetup}>
              {busy ? 'Creando…' : 'Crear y subir catálogo'}
            </button>
            <button className={secondary} onClick={() => setMode('choose')}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4 grid gap-3">
          <p className="text-sm text-slate-300">En el celular del líder: Ajustes → Compus → "Vincular una compu". Escribe aquí el código de 8 números.</p>
          <input className={`${input} font-mono tracking-widest`} placeholder="00000000" inputMode="numeric" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} />
          <div className="flex gap-3">
            <button className={primary} disabled={busy || code.length !== 8} onClick={doLink}>{busy ? 'Vinculando…' : 'Vincular'}</button>
            <button className={secondary} onClick={() => setMode('choose')}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  )
}
