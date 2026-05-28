import { useEffect, useRef, useState } from 'react'
import { authStyles, borders, colors, fonts, formStyles } from './theme'
import { formatCountdown } from './utils'

interface HeaderProps {
  view: string
  tripDetailTab: string
  onViewAllTrips: () => void
  onTripDetailTabChange: (tab: string) => void
  userName: string
  onLogout: () => void
  logoutError?: string | null
  onOpenPreferences?: () => void
  activePollEndDate?: string | null
}

function UserMenu({
  userName,
  onLogout,
  logoutError,
  onOpenPreferences,
}: {
  userName: string
  onLogout: () => void
  logoutError?: string | null
  onOpenPreferences?: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logoutError) setOpen(true)
  }, [logoutError])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div style={headerStyles.userMenuWrapper} ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={headerStyles.userMenuTrigger}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span>{userName}</span>
        <span style={headerStyles.triangle}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={headerStyles.userMenuDropdown} role="menu">
          {onOpenPreferences && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onOpenPreferences()
              }}
              style={headerStyles.userMenuItem}
              role="menuitem"
            >
              Preferences
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onLogout()
            }}
            style={headerStyles.userMenuItem}
            role="menuitem"
          >
            Sign Out
          </button>
          {logoutError && (
            <p style={{ ...formStyles.error, padding: '8px 16px' }}>
              {logoutError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Header({
  view,
  tripDetailTab,
  onViewAllTrips,
  onTripDetailTabChange,
  userName,
  onLogout,
  logoutError,
  onOpenPreferences,
  activePollEndDate,
}: HeaderProps) {
  const [_now, setNow] = useState(Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (activePollEndDate) {
      intervalRef.current = setInterval(() => setNow(Date.now()), 1000)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }
  }, [activePollEndDate])

  const userMenu = (
    <UserMenu
      userName={userName}
      onLogout={onLogout}
      logoutError={logoutError}
      onOpenPreferences={onOpenPreferences}
    />
  )

  if (view === 'tripList') {
    return (
      <header style={headerStyles.bar}>
        <span style={{ ...authStyles.brandName, fontSize: '22px' }}>
          ⛷ Ski Tripper
        </span>
        {userMenu}
      </header>
    )
  }

  return (
    <header style={headerStyles.bar}>
      <div style={headerStyles.leftControls}>
        <button
          type="button"
          onClick={onViewAllTrips}
          style={headerStyles.backButton}
        >
          ← My Trips
        </button>
      </div>
      <nav style={headerStyles.centerTabs}>
        <button
          type="button"
          onClick={() => onTripDetailTabChange('overview')}
          style={
            tripDetailTab === 'overview'
              ? headerStyles.subTabActive
              : headerStyles.subTab
          }
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => onTripDetailTabChange('resorts')}
          style={
            tripDetailTab === 'resorts'
              ? headerStyles.subTabActive
              : headerStyles.subTab
          }
        >
          Resorts
        </button>
        <button
          type="button"
          onClick={() => onTripDetailTabChange('proposals')}
          style={
            tripDetailTab === 'proposals'
              ? headerStyles.subTabActive
              : headerStyles.subTab
          }
        >
          Proposals
        </button>
        <button
          type="button"
          onClick={() => onTripDetailTabChange('poll')}
          style={
            tripDetailTab === 'poll'
              ? headerStyles.subTabActive
              : headerStyles.subTab
          }
        >
          {activePollEndDate
            ? (() => {
                const cd = formatCountdown(activePollEndDate)
                return cd === 'Ended' ? 'Poll ended' : `Poll closing in ${cd}`
              })()
            : 'Voting'}
        </button>
      </nav>
      {userMenu}
    </header>
  )
}

const headerStyles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 48px',
    height: '64px',
    borderBottom: borders.subtle,
    background: 'rgba(7,17,31,0.98)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
    gap: '12px',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '14px',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: '6px',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap' as const,
  },
  subTabs: {
    display: 'flex',
    gap: '4px',
    marginLeft: 'auto',
  },
  leftControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  centerTabs: {
    display: 'flex',
    gap: '4px',
  },
  subTab: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
  subTabActive: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    background: 'rgba(59,189,232,0.12)',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
  userMenuWrapper: {
    position: 'relative' as const,
  },
  userMenuTrigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
    letterSpacing: '0.02em',
    cursor: 'pointer',
    padding: '6px 8px',
    borderRadius: '6px',
    transition: 'color 0.15s',
  },
  triangle: {
    fontSize: '10px',
    lineHeight: 1,
  },
  userMenuDropdown: {
    position: 'absolute' as const,
    right: 0,
    top: '100%',
    marginTop: '4px',
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '8px',
    padding: '4px 0',
    minWidth: '140px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: 200,
  },
  userMenuItem: {
    display: 'block',
    width: '100%',
    padding: '8px 16px',
    border: 'none',
    background: 'none',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    letterSpacing: '0.02em',
  },
} as const
