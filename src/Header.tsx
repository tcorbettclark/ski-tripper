import { colors, fonts, borders } from './theme'

interface HeaderProps {
  view: string
  tripName: string
  tripDetailTab: string
  onViewAllTrips: () => void
  onTripDetailTabChange: (tab: string) => void
  userName: string
  onLogout: () => void
}

export default function Header({
  view,
  tripName,
  tripDetailTab,
  onViewAllTrips,
  onTripDetailTabChange,
  userName,
  onLogout,
}: HeaderProps) {
  if (view === 'tripList') {
    return (
      <header style={headerStyles.bar}>
        <span style={headerStyles.wordmark}>⛷ Ski Tripper</span>
        <div style={headerStyles.userGroup}>
          <span style={headerStyles.name}>{userName}</span>
          <button type="button" onClick={onLogout} style={headerStyles.button}>
            Sign Out
          </button>
        </div>
      </header>
    )
  }

  return (
    <header style={headerStyles.bar}>
      <button
        type="button"
        onClick={onViewAllTrips}
        style={headerStyles.backButton}
      >
        ← My Trips
      </button>
      <span style={headerStyles.tripName}>{tripName}</span>
      <nav style={headerStyles.subTabs}>
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
          Poll
        </button>
      </nav>
      <div style={headerStyles.userGroup}>
        <span style={headerStyles.name}>{userName}</span>
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
    position: 'sticky',
    top: 0,
    zIndex: 100,
    gap: '24px',
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: '22px',
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: '0.02em',
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
  },
  tripName: {
    fontFamily: fonts.display,
    fontSize: '20px',
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: '0.01em',
    flex: 1,
  },
  subTabs: {
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
} as const
