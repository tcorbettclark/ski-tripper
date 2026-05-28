import { useEffect, useRef, useState } from 'react'
import { BrandTitle, HamburgerIcon } from './Icons'
import { authStyles, borders, colors, fonts, formStyles } from './theme'
import useIsSmallScreen from './useIsSmallScreen'
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

function NavTabs({
  tripDetailTab,
  onTripDetailTabChange,
  activePollEndDate,
}: {
  tripDetailTab: string
  onTripDetailTabChange: (tab: string) => void
  activePollEndDate?: string | null
}) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'resorts', label: 'Resorts' },
    { id: 'proposals', label: 'Proposals' },
    {
      id: 'poll',
      label: activePollEndDate
        ? (() => {
            const cd = formatCountdown(activePollEndDate)
            return cd === 'Ended' ? 'Poll ended' : `Poll closing in ${cd}`
          })()
        : 'Voting',
    },
  ]

  return (
    <nav style={headerStyles.centerTabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTripDetailTabChange(tab.id)}
          style={
            tripDetailTab === tab.id
              ? headerStyles.subTabActive
              : headerStyles.subTab
          }
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

function MobileMenu({
  open,
  onClose,
  tripDetailTab,
  onTripDetailTabChange,
  onLogout,
  logoutError,
  onOpenPreferences,
  activePollEndDate,
  onViewAllTrips,
}: {
  open: boolean
  onClose: () => void
  tripDetailTab: string
  onTripDetailTabChange: (tab: string) => void
  onLogout: () => void
  logoutError?: string | null
  onOpenPreferences?: () => void
  activePollEndDate?: string | null
  onViewAllTrips: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  if (!open) return null

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'resorts', label: 'Resorts' },
    { id: 'proposals', label: 'Proposals' },
    {
      id: 'poll',
      label: activePollEndDate
        ? (() => {
            const cd = formatCountdown(activePollEndDate)
            return cd === 'Ended' ? 'Poll ended' : `Poll closing in ${cd}`
          })()
        : 'Voting',
    },
  ]

  return (
    <div style={headerStyles.mobileMenuOverlay} ref={menuRef} role="menu">
      <button
        type="button"
        onClick={() => {
          onClose()
          onViewAllTrips()
        }}
        style={headerStyles.mobileMenuItem}
        role="menuitem"
      >
        ← My Trips
      </button>
      <div style={headerStyles.mobileMenuDivider} />
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => {
            onTripDetailTabChange(tab.id)
            onClose()
          }}
          style={{
            ...headerStyles.mobileMenuItem,
            ...(tripDetailTab === tab.id
              ? { color: colors.accent, fontWeight: '600' as const }
              : {}),
          }}
          role="menuitem"
        >
          {tab.label}
        </button>
      ))}
      <div style={headerStyles.mobileMenuDivider} />
      {onOpenPreferences && (
        <button
          type="button"
          onClick={() => {
            onClose()
            onOpenPreferences()
          }}
          style={headerStyles.mobileMenuItem}
          role="menuitem"
        >
          Preferences
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          onClose()
          onLogout()
        }}
        style={headerStyles.mobileMenuItem}
        role="menuitem"
      >
        Sign Out
      </button>
      {logoutError && (
        <p style={{ ...formStyles.error, padding: '12px 20px' }}>
          {logoutError}
        </p>
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
  const [_now, _setNow] = useState(Date.now())
  const _intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isSmall = useIsSmallScreen()
  const prevIsSmallRef = useRef(isSmall)

  useEffect(() => {
    if (activePollEndDate) {
      _intervalRef.current = setInterval(() => _setNow(Date.now()), 1000)
      return () => {
        if (_intervalRef.current) clearInterval(_intervalRef.current)
      }
    }
  }, [activePollEndDate])

  if (prevIsSmallRef.current !== isSmall) {
    prevIsSmallRef.current = isSmall
    setMobileMenuOpen(false)
  }

  if (view === 'tripList') {
    return (
      <header style={headerStyles.bar}>
        <span style={{ ...authStyles.brandName, fontSize: '22px' }}>
          <BrandTitle fontSize="22px" />
        </span>
        {isSmall ? (
          <>
            <div style={headerStyles.mobileRight}>
              <span style={headerStyles.userNameSmall}>{userName}</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((o) => !o)}
                style={headerStyles.hamburgerButton}
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
              >
                <span style={headerStyles.hamburgerIcon}>
                  <HamburgerIcon />
                </span>
              </button>
            </div>
            {mobileMenuOpen && (
              <div style={headerStyles.mobileMenuOverlay} role="menu">
                {onOpenPreferences && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      onOpenPreferences()
                    }}
                    style={headerStyles.mobileMenuItem}
                    role="menuitem"
                  >
                    Preferences
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    onLogout()
                  }}
                  style={headerStyles.mobileMenuItem}
                  role="menuitem"
                >
                  Sign Out
                </button>
                {logoutError && (
                  <p style={{ ...formStyles.error, padding: '12px 20px' }}>
                    {logoutError}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <UserMenu
            userName={userName}
            onLogout={onLogout}
            logoutError={logoutError}
            onOpenPreferences={onOpenPreferences}
          />
        )}
      </header>
    )
  }

  if (isSmall) {
    return (
      <header style={headerStyles.bar}>
        <span style={{ ...authStyles.brandName, fontSize: '18px' }}>
          <BrandTitle fontSize="18px" />
        </span>
        <div style={headerStyles.mobileRight}>
          <span style={headerStyles.userNameSmall}>{userName}</span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            style={headerStyles.hamburgerButton}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
          >
            <span style={headerStyles.hamburgerIcon}>☰</span>
          </button>
        </div>
        <MobileMenu
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          tripDetailTab={tripDetailTab}
          onTripDetailTabChange={onTripDetailTabChange}
          onLogout={onLogout}
          logoutError={logoutError}
          onOpenPreferences={onOpenPreferences}
          activePollEndDate={activePollEndDate}
          onViewAllTrips={onViewAllTrips}
        />
      </header>
    )
  }

  const userMenu = (
    <UserMenu
      userName={userName}
      onLogout={onLogout}
      logoutError={logoutError}
      onOpenPreferences={onOpenPreferences}
    />
  )

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
      <NavTabs
        tripDetailTab={tripDetailTab}
        onTripDetailTabChange={onTripDetailTabChange}
        activePollEndDate={activePollEndDate}
      />
      {userMenu}
    </header>
  )
}

const headerStyles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
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
  mobileRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  userNameSmall: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '12px',
    letterSpacing: '0.02em',
  },
  hamburgerButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '6px',
    fontSize: '20px',
    lineHeight: 1,
  },
  hamburgerIcon: {
    display: 'block',
  },
  mobileMenuOverlay: {
    position: 'absolute' as const,
    top: '64px',
    left: 0,
    right: 0,
    background: colors.bgCard,
    borderBottom: borders.subtle,
    padding: '4px 0',
    zIndex: 200,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  mobileMenuItem: {
    display: 'block',
    width: '100%',
    padding: '12px 20px',
    border: 'none',
    background: 'none',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    letterSpacing: '0.02em',
  },
  mobileMenuDivider: {
    height: '1px',
    background: borders.subtle,
    margin: '4px 16px',
  },
} as const
