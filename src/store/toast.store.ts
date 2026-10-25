import { create } from 'zustand'

/** Non-blocking notices ("Servicio guardado"). Rendered by <ToastHost /> in App.tsx. */

export interface Toast {
  id: number
  message: string
  kind: 'success' | 'error'
}

interface ToastState {
  toasts: Toast[]
}

const TOAST_MS = 2500
let seq = 0

export const useToastStore = create<ToastState>(() => ({ toasts: [] }))

export function showToast(message: string, kind: Toast['kind'] = 'success'): void {
  const id = ++seq
  useToastStore.setState(s => ({ toasts: [...s.toasts, { id, message, kind }] }))
  setTimeout(() => useToastStore.setState(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), TOAST_MS)
}
