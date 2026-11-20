import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const v = {
    primary: 'bg-indigo-600 active:bg-indigo-700 text-white',
    secondary: 'bg-slate-800 active:bg-slate-700 text-white border border-slate-700',
    ghost: 'text-slate-300 active:bg-slate-800',
    danger: 'bg-red-600/90 active:bg-red-700 text-white',
  }[variant]
  return <button {...p} className={`min-h-11 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${v} ${className}`} />
}

const field = 'w-full min-h-11 bg-slate-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 text-base placeholder:text-slate-500'

export const Input = ({ className = '', ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${field} ${className}`} />
export const Select = ({ className = '', ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${field} ${className}`} />
export const TextArea = ({ className = '', ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${field} ${className}`} />

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="block text-sm text-slate-400 mb-1.5">
      {children}{hint && <span className="text-slate-500"> · {hint}</span>}
    </span>
  )
}

/** Full-screen page with a back button (sub-screens of a tab). */
export function Page({ title, onBack, action, children }: { title: string; onBack?: () => void; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-2 py-2 flex items-center gap-2">
        {onBack && <button onClick={onBack} className="min-h-11 min-w-11 text-2xl text-slate-300" aria-label="Volver">‹</button>}
        <h1 className={`text-lg font-semibold flex-1 truncate ${onBack ? '' : 'pl-2'}`}>{title}</h1>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </div>
  )
}

export const Card = ({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) => (
  <div onClick={onClick} className={`rounded-2xl bg-slate-800 border border-slate-700 p-4 ${onClick ? 'active:bg-slate-750 cursor-pointer' : ''} ${className}`}>{children}</div>
)

export const Empty = ({ children }: { children: ReactNode }) => <p className="text-center text-slate-400 py-10 px-6">{children}</p>

/** Short Spanish date: "dom 22 nov". */
export function shortDate(iso: string | null): string {
  if (!iso) return 'Sin fecha'
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
}
