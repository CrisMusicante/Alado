import { create } from 'zustand'

/**
 * In-app replacement for window.confirm / window.alert. In Electron on Windows a native
 * confirm/alert leaves the page without keyboard focus afterwards: text fields stop accepting the
 * caret and typing until the window is re-focused. Rendered by <DialogHost /> in App.tsx.
 */

export interface DialogAction {
  label: string
  value: string
  variant?: 'primary' | 'danger' | 'neutral'
}

export interface DialogRequest {
  title: string
  message?: string
  actions: DialogAction[]
}

interface PendingDialog extends DialogRequest {
  resolve: (value: string | null) => void
}

interface DialogState {
  current: PendingDialog | null
  queue: PendingDialog[]
  answer: (value: string | null) => void
}

export const useDialogStore = create<DialogState>((set, get) => ({
  current: null,
  queue: [],
  answer: (value) => {
    const { current, queue } = get()
    if (!current) return
    const [next = null, ...rest] = queue
    set({ current: next, queue: rest })
    current.resolve(value)
  }
}))

/** Shows a dialog; resolves with the chosen action's value, or null if dismissed (Esc / backdrop). */
export function ask(request: DialogRequest): Promise<string | null> {
  return new Promise(resolve => {
    const pending = { ...request, resolve }
    const { current, queue } = useDialogStore.getState()
    if (current) useDialogStore.setState({ queue: [...queue, pending] })
    else useDialogStore.setState({ current: pending })
  })
}

export async function confirmDialog(
  message: string,
  opts: { title?: string; confirmLabel?: string; danger?: boolean } = {}
): Promise<boolean> {
  const value = await ask({
    title: opts.title ?? 'Confirmar',
    message,
    actions: [
      { label: 'Cancelar', value: 'cancel', variant: 'neutral' },
      { label: opts.confirmLabel ?? 'Aceptar', value: 'confirm', variant: opts.danger ? 'danger' : 'primary' }
    ]
  })
  return value === 'confirm'
}

export async function alertDialog(message: string, title = 'Aviso'): Promise<void> {
  await ask({ title, message, actions: [{ label: 'Entendido', value: 'ok', variant: 'primary' }] })
}
