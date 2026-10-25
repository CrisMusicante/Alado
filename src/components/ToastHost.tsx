import { useToastStore } from '../store/toast.store'

/** Renders the notices requested through showToast. Mounted once in App. */
export default function ToastHost() {
  const toasts = useToastStore(s => s.toasts)
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[250] flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border
            ${t.kind === 'error'
              ? 'bg-red-950 border-red-700 text-red-100'
              : 'bg-slate-800 border-emerald-600 text-white'}`}
        >
          {t.kind === 'error' ? '⚠ ' : '✓ '}{t.message}
        </div>
      ))}
    </div>
  )
}
