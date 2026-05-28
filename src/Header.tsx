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
  if (view === 'tripList') {
    return (
      <header style={headerStyles.bar}>
        <span style={{ ...authStyles.brandName, fontSize: '22px' }}>
          ⛷ Ski Tripper
        </span>
        <div style={headerStyles.userGroup}>
          <span style={headerStyles.name}>{userName}</span>
          {onOpenPreferences && (
            <button
              type="button"
              onClick={onOpenPreferences}
              style={headerStyles.iconButton}
              aria-label="Preferences"
            >
              ⚙
            </button>
          )}
          {logoutError && <p style={formStyles.error}>{logoutError}</p>}
          <button type="button" onClick={onLogout} style={headerStyles.button}>
            Sign Out
          </button>
        </div>
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
      <div style={headerStyles.userGroup}>
        <span style={headerStyles.name}>{userName}</span>
        {onOpenPreferences && (
          <button
            type="button"
            onClick={onOpenPreferences}
            style={headerStyles.iconButton}
            aria-label="Preferences"
          >
            ⚙
          </button>
        )}
        {logoutError && <p style={formStyles.error}>{logoutError}</p>}
        <button type="button" onClick={onLogout} style={headerStyles.button}>
          Sign Out
        </button>
      </div>
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
  userGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  name: {
    fontFamily: fonts.body,
    fontSize: '13px',
    color: colors.textSecondary,
    letterSpacing: '0.02em',
  },
  button: {
    padding: '7px 18px',
    borderRadius: '6px',
    border: borders.accent,
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
  iconButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
    transition: 'color 0.15s',
    ':hover': {
      color: colors.accent,
    },
  },
} as const
