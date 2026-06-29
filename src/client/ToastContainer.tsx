import { X } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { colors, fontSizes, fonts } from './theme'
import type { ToastType } from './toast'
import { dismissToast, getToasts, subscribe } from './toast'

const TYPE_STYLES: Record<ToastType, { borderLeft: string; bg: string }> = {
  success: {
    borderLeft: `4px solid ${colors.accent}`,
    bg: colors.bgCard,
  },
  error: {
    borderLeft: `4px solid ${colors.error}`,
    bg: colors.bgCard,
  },
  info: {
    borderLeft: `4px solid ${colors.textSecondary}`,
    bg: colors.bgCard,
  },
}

export default function ToastContainer() {
  const toasts = useSyncExternalStore(subscribe, getToasts)

  if (toasts.length === 0) return null

  return (
    <div style={toastStyles.container} aria-live="polite">
      {toasts.map((t) => {
        const style = TYPE_STYLES[t.type]
        return (
          <div
            key={t.id}
            style={{
              ...toastStyles.toast,
              borderLeft: style.borderLeft,
              background: style.bg,
            }}
            role="alert"
          >
            <span style={toastStyles.message}>{t.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              style={toastStyles.close}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

const toastStyles = {
  container: {
    position: 'fixed' as const,
    top: '16px',
    right: '16px',
    zIndex: 1000,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '8px',
    pointerEvents: 'none' as const,
    maxWidth: '360px',
  },
  toast: {
    pointerEvents: 'auto' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '8px',
    padding: '10px 12px',
    borderRadius: '8px',
    boxShadow: '0 4px 24px var(--color-shadow)',
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    animation: 'toast-slide-in 0.25s ease-out',
  },
  message: {
    flex: 1,
    lineHeight: '1.4' as const,
  },
  close: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    cursor: 'pointer',
    padding: '2px',
    lineHeight: 1,
    borderRadius: '3px' as const,
    flexShrink: 0,
  },
}
