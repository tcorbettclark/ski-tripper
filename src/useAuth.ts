import { ClientResponseError } from 'pocketbase'
import { useCallback, useEffect, useRef, useState } from 'react'
import pb, { hasSession as _hasSession } from './backend'
import type { User } from './types.d'

const IDLE_TIMEOUT_MS = 5 * 60_000
const ACTIVITY_THROTTLE_MS = 1_000

function mapUser(record: Record<string, unknown>): User {
  return {
    id: record.id as string,
    name: (record.name as string) || '',
    email: record.email as string,
    emailVerification: record.verified as boolean,
  }
}

export default function useAuth(options?: {
  hasSession?: () => boolean
  getUser?: () => User | null
}) {
  const hasSessionRef = useRef(options?.hasSession ?? _hasSession)
  const pbRef = useRef(pb)

  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<
    string | null
  >(null)
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = null
    }
  }, [])

  const logout = useCallback(
    (message?: string) => {
      setUser(null)
      setSessionExpiredMessage(message || null)
      clearTimers()
    },
    [clearTimers]
  )

  const autoLogout = useCallback(
    (message?: string) => {
      pbRef.current.authStore.clear()
      logout(message)
    },
    [logout]
  )

  const onAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof ClientResponseError && err.status === 401) {
        autoLogout('Your session has expired. Please sign in again.')
      }
    },
    [autoLogout]
  )

  useEffect(() => {
    if (!hasSessionRef.current()) {
      setUser(null)
      setChecking(false)
      return
    }
    const record = pbRef.current.authStore.record
    if (record) {
      setUser(mapUser(record as unknown as Record<string, unknown>))
    } else {
      setUser(null)
    }
    setChecking(false)
  }, [])

  useEffect(() => {
    const unsubscribe = pbRef.current.authStore.onChange((_token, record) => {
      if (record) {
        setUser(mapUser(record as unknown as Record<string, unknown>))
      } else {
        setUser(null)
      }
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const lastActivityRef = useRef(0)

  const resetIdleTimer = useCallback(() => {
    const now = Date.now()
    if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return
    lastActivityRef.current = now
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
    }
    idleTimeoutRef.current = setTimeout(() => {
      autoLogout('You have been signed out due to inactivity.')
    }, IDLE_TIMEOUT_MS)
  }, [autoLogout])

  useEffect(() => {
    if (!user) return
    lastActivityRef.current = Date.now()
    resetIdleTimer()
    window.addEventListener('mousedown', resetIdleTimer)
    window.addEventListener('keydown', resetIdleTimer)
    window.addEventListener('scroll', resetIdleTimer)
    window.addEventListener('touchstart', resetIdleTimer)
    window.addEventListener('mousemove', resetIdleTimer)
    return () => {
      window.removeEventListener('mousedown', resetIdleTimer)
      window.removeEventListener('keydown', resetIdleTimer)
      window.removeEventListener('scroll', resetIdleTimer)
      window.removeEventListener('touchstart', resetIdleTimer)
      window.removeEventListener('mousemove', resetIdleTimer)
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
        idleTimeoutRef.current = null
      }
    }
  }, [user, resetIdleTimer])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  const refreshUser = useCallback(() => {
    const record = pbRef.current.authStore.record
    if (record) {
      setUser(mapUser(record as unknown as Record<string, unknown>))
    } else {
      setUser(null)
    }
  }, [])

  const login = useCallback((loggedInUser: User) => {
    setUser(loggedInUser)
    setSessionExpiredMessage(null)
  }, [])

  return {
    user,
    checking,
    sessionExpiredMessage,
    login,
    logout,
    autoLogout,
    onAuthError,
    setSessionExpiredMessage,
    refreshUser,
  }
}
