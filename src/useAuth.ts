import { AppwriteException, type Models } from 'appwrite'
import { useCallback, useEffect, useRef, useState } from 'react'
import { account as _account, hasSession as _hasSession } from './backend'

const IDLE_TIMEOUT_MS = 5 * 60_000
const ACTIVITY_THROTTLE_MS = 1_000

export default function useAuth(options?: {
  hasSession?: () => boolean
  accountGet?: () => Promise<Models.User>
  deleteSession?: () => Promise<unknown>
}) {
  const sessionRef = useRef(options?.hasSession ?? _hasSession)
  const accountGetRef = useRef(options?.accountGet ?? (() => _account.get()))
  const deleteSessionRef = useRef(
    options?.deleteSession ?? (() => _account.deleteSession('current'))
  )

  const [user, setUser] = useState<Models.User | null>(null)
  const [checking, setChecking] = useState(true)
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<
    string | null
  >(null)
  const sessionExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (sessionExpiryRef.current) {
      clearTimeout(sessionExpiryRef.current)
      sessionExpiryRef.current = null
    }
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
      deleteSessionRef.current().catch(() => {})
      logout(message)
    },
    [logout]
  )

  const onAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof AppwriteException && err.code === 401) {
        autoLogout('Your session has expired. Please sign in again.')
      }
    },
    [autoLogout]
  )

  useEffect(() => {
    if (!sessionRef.current()) {
      setUser(null)
      setChecking(false)
      return
    }
    accountGetRef
      .current()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
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

  const login = useCallback(
    (session: Models.Session, loggedInUser: Models.User) => {
      setUser(loggedInUser)
      setSessionExpiredMessage(null)

      const expireDate = new Date(session.expire)
      const msUntilExpire = expireDate.getTime() - Date.now()
      if (msUntilExpire > 0) {
        sessionExpiryRef.current = setTimeout(() => {
          autoLogout('Your session has expired. Please sign in again.')
        }, msUntilExpire)
      }
    },
    [autoLogout]
  )

  return {
    user,
    checking,
    sessionExpiredMessage,
    login,
    logout,
    autoLogout,
    onAuthError,
    setSessionExpiredMessage,
  }
}
