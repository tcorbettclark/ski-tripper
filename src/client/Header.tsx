import { useEffect, useRef, useState } from 'react'
import { BrandTitle, HamburgerIcon } from './Icons'
import ThemeToggle from './ThemeToggle'
import { authStyles, borders, colors, fontSizes, fonts, mix } from './theme'
import useIsSmallScreen from './useIsSmallScreen'
import { formatCountdown } from './utils'

interface HeaderProps {
  view: string
  tripDetailTab: string
  onViewAllTrips: () => void
  onTripDetailTabChange: (tab: string) => void
  userName: string
  onLogout: () => void
  onOpenPreferences?: () => void
  activePollEndDate?: string | null
  useIsSmallScreenHook?: () => boolean
}

function UserMenu({
  userName,
  onLogout,
  onOpenPreferences,
}: {
  userName: string
  onLogout: () => void
  onOpenPreferences?: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
        data-testid="user-menu-trigger"
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
            data-testid="sign-out"
            onClick={() => {
              onLogout()
            }}
            style={headerStyles.userMenuItem}
            role="menuitem"
          >
            Sign Out
          </button>
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
      id: 'voting',
      label: activePollEndDate
        ? (() => {
            const cd = formatCountdown(activePollEndDate)
            return cd === 'Ended' ? 'Voting ended' : `Voting closes in ${cd}`
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
          data-testid={`nav-tab-${tab.id}`}
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
  onOpenPreferences,
  activePollEndDate,
  onViewAllTrips,
}: {
  open: boolean
  onClose: () => void
  tripDetailTab: string
  onTripDetailTabChange: (tab: string) => void
  onLogout: () => void
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
      id: 'voting',
      label: activePollEndDate
        ? (() => {
            const cd = formatCountdown(activePollEndDate)
            return cd === 'Ended' ? 'Voting ended' : `Voting closes in ${cd}`
          })()
        : 'Voting',
    },
  ]

  return (
    <div style={headerStyles.mobileMenuOverlay} ref={menuRef} role="menu">
      <button
        type="button"
        data-testid="nav-my-trips"
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
          data-testid={`nav-tab-${tab.id}`}
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
  onOpenPreferences,
  activePollEndDate,
  useIsSmallScreenHook = useIsSmallScreen,
}: HeaderProps) {
  const [_now, _setNow] = useState(Date.now())
  const _intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isSmall = useIsSmallScreenHook()
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
        <span style={{ ...authStyles.brandName, fontSize: fontSizes.xl }}>
          <BrandTitle fontSize="22px" />
        </span>
        {isSmall ? (
          <>
            <div style={headerStyles.mobileRight}>
              <span style={headerStyles.userNameSmall}>{userName}</span>
              <ThemeToggle />
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
              </div>
            )}
          </>
        ) : (
          <div style={headerStyles.rightControls}>
            <ThemeToggle />
            <UserMenu
              userName={userName}
              onLogout={onLogout}
              onOpenPreferences={onOpenPreferences}
            />
          </div>
        )}
      </header>
    )
  }

  if (isSmall) {
    return (
      <header style={headerStyles.bar}>
        <span style={{ ...authStyles.brandName, fontSize: fontSizes.lg }}>
          <BrandTitle fontSize="18px" />
        </span>
        <div style={headerStyles.mobileRight}>
          <span style={headerStyles.userNameSmall}>{userName}</span>
          <ThemeToggle />
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
      onOpenPreferences={onOpenPreferences}
    />
  )

  return (
    <header style={headerStyles.bar}>
      <div style={headerStyles.leftControls}>
        <button
          type="button"
          data-testid="nav-my-trips"
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
      <div style={headerStyles.rightControls}>
        <ThemeToggle />
        {userMenu}
      </div>
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
    background: 'color-mix(in srgb, var(--color-bgPrimary) 98%, transparent)',
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
    fontSize: fontSizes.base,
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
  rightControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
    fontSize: fontSizes.sm,
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
  subTabActive: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    background: mix('--color-accent', 0.15),
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '700',
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
    fontSize: fontSizes.sm,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    padding: '6px 8px',
    borderRadius: '6px',
    transition: 'color 0.15s',
  },
  triangle: {
    fontSize: fontSizes.xs,
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
    boxShadow: '0 8px 32px var(--color-shadow)',
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
    fontSize: fontSizes.sm,
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
    fontSize: fontSizes.sm,
    letterSpacing: '0.02em',
  },
  hamburgerButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '6px',
    fontSize: fontSizes.lg,
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
    boxShadow: '0 8px 32px var(--color-shadow)',
  },
  mobileMenuItem: {
    display: 'block',
    width: '100%',
    padding: '12px 20px',
    border: 'none',
    background: 'none',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
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
