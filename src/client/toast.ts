export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

type Listener = () => void

let nextId = 0
let toasts: Toast[] = []
const listeners = new Set<Listener>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  info: 3000,
}

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

export function toast(message: string, type: ToastType = 'info') {
  const id = String(nextId++)
  const entry: Toast = { id, message, type }
  toasts = [...toasts, entry]
  emitChange()
  const duration = DEFAULT_DURATION[type]
  const timer = setTimeout(() => {
    timers.delete(id)
    dismissToast(id)
  }, duration)
  timers.set(id, timer)
}

export function dismissToast(id: string) {
  if (timers.has(id)) {
    clearTimeout(timers.get(id)!)
    timers.delete(id)
  }
  const len = toasts.length
  toasts = toasts.filter((t) => t.id !== id)
  if (toasts.length !== len) emitChange()
}

export function getToasts(): readonly Toast[] {
  return toasts
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function _resetForTesting() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  listeners.clear()
  toasts = []
  nextId = 0
}
