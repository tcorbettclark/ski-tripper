export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

type Listener = () => void

export const EXIT_DURATION = 500

let nextId = 0
let toasts: Toast[] = []
const listeners = new Set<Listener>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const exitTimers = new Map<string, ReturnType<typeof setTimeout>>()
const exitingIds = new Set<string>()

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
  if (exitingIds.has(id)) return
  if (!toasts.some((t) => t.id === id)) return
  exitingIds.add(id)
  toasts = [...toasts]
  emitChange()
  const timer = setTimeout(() => {
    exitTimers.delete(id)
    if (timers.has(id)) {
      clearTimeout(timers.get(id)!)
      timers.delete(id)
    }
    const len = toasts.length
    toasts = toasts.filter((t) => t.id !== id)
    exitingIds.delete(id)
    if (toasts.length !== len) emitChange()
  }, EXIT_DURATION)
  exitTimers.set(id, timer)
}

export function isExiting(id: string): boolean {
  return exitingIds.has(id)
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
  for (const timer of exitTimers.values()) clearTimeout(timer)
  timers.clear()
  exitTimers.clear()
  listeners.clear()
  toasts = []
  exitingIds.clear()
  nextId = 0
}
