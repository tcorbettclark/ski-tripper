import { describe, expect, it, mock } from 'bun:test'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Header from './Header'
import { dayjs } from './utils'

const defaultProps = {
  view: 'tripDetail',
  tripDetailTab: 'proposals',
  onViewAllTrips: mock(() => {}),
  onTripDetailTabChange: mock(() => {}),
  userName: 'Alice',
  onLogout: mock(() => {}),
  useIsSmallScreenHook: () => false as boolean,
}

describe('Header', () => {
  it('renders countdown when activePollEndDate is provided', () => {
    const future = dayjs().add(2, 'day').toISOString()
    render(<Header {...defaultProps} activePollEndDate={future} />)
    expect(screen.getByText(/Voting closes in \d+d \d+h/))
  })

  it('renders "Poll ended" when endDate is in the past', () => {
    const past = dayjs().subtract(1, 'day').toISOString()
    render(<Header {...defaultProps} activePollEndDate={past} />)
    expect(screen.getByText('Voting ended'))
  })

  it('renders minutes-left countdown for near-future endDate', () => {
    const nearFuture = dayjs().add(5, 'minute').toISOString()
    render(<Header {...defaultProps} activePollEndDate={nearFuture} />)
    expect(screen.getByText(/Voting closes in \d+m \d+s/))
  })

  it('renders hours-left countdown for same-day endDate', () => {
    const sameDay = dayjs().add(3, 'hour').toISOString()
    render(<Header {...defaultProps} activePollEndDate={sameDay} />)
    expect(screen.getByText(/Voting closes in \d+h \d+m/))
  })

  it('shows "Voting" when activePollEndDate is null', () => {
    render(<Header {...defaultProps} activePollEndDate={null} />)
    expect(screen.getByText('Voting'))
    expect(screen.queryByText(/Voting closes in/)).toBeNull()
  })

  it('shows "Voting" when activePollEndDate is not provided', () => {
    render(<Header {...defaultProps} />)
    expect(screen.getByText('Voting'))
    expect(screen.queryByText(/Voting closes in/)).toBeNull()
  })

  it('does not render "Voting" or countdown in tripList view', () => {
    const future = dayjs().add(2, 'day').toISOString()
    render(
      <Header {...defaultProps} view="tripList" activePollEndDate={future} />
    )
    expect(screen.queryByText('Voting')).toBeNull()
    expect(screen.queryByText(/Voting closes in/)).toBeNull()
  })

  it('updates countdown text over time', () => {
    const nearFuture = dayjs().add(30, 'second').toISOString()
    render(<Header {...defaultProps} activePollEndDate={nearFuture} />)
    expect(screen.getByText(/Voting closes in \d+m \d+s/))
  })

  it('shows user name in menu trigger', () => {
    render(<Header {...defaultProps} />)
    expect(screen.getByText('Alice'))
  })

  it('opens user menu on click and shows Sign Out', async () => {
    const user = userEvent.setup()
    render(<Header {...defaultProps} />)
    const trigger = screen.getByRole('button', { name: /alice/i })
    expect(screen.queryByText('Sign Out')).toBeNull()
    await user.click(trigger)
    expect(screen.getByText('Sign Out'))
  })

  it('shows Preferences in menu when onOpenPreferences provided', async () => {
    const user = userEvent.setup()
    render(<Header {...defaultProps} onOpenPreferences={mock(() => {})} />)
    await user.click(screen.getByRole('button', { name: /alice/i }))
    expect(screen.getByText('Preferences'))
  })

  it('does not show Preferences when onOpenPreferences not provided', async () => {
    const user = userEvent.setup()
    render(<Header {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /alice/i }))
    expect(screen.queryByText('Preferences')).toBeNull()
  })

  describe('on small screens', () => {
    const smallScreenProps = {
      ...defaultProps,
      useIsSmallScreenHook: () => true,
    }

    it('shows hamburger button on tripList view', () => {
      render(<Header {...smallScreenProps} view="tripList" />)
      expect(screen.getByRole('button', { name: /open menu/i }))
    })

    it('shows hamburger button on tripDetail view', () => {
      render(<Header {...smallScreenProps} />)
      expect(screen.getByRole('button', { name: /open menu/i }))
    })

    it('opens mobile menu with nav tabs', async () => {
      const user = userEvent.setup()
      render(<Header {...smallScreenProps} />)
      expect(screen.queryByText('Overview')).toBeNull()
      await user.click(screen.getByRole('button', { name: /open menu/i }))
      expect(screen.getByText('Overview'))
      expect(screen.getByText('Resorts'))
      expect(screen.getByText('Proposals'))
      expect(screen.getByText('Sign Out'))
    })

    it('mobile menu includes My Trips back link', async () => {
      const user = userEvent.setup()
      render(<Header {...smallScreenProps} />)
      await user.click(screen.getByRole('button', { name: /open menu/i }))
      expect(screen.getByText(/← My Trips/))
    })

    it('mobile menu calls onTripDetailTabChange when tab clicked', async () => {
      const user = userEvent.setup()
      const onTabChange = mock(() => {})
      render(
        <Header {...smallScreenProps} onTripDetailTabChange={onTabChange} />
      )
      await user.click(screen.getByRole('button', { name: /open menu/i }))
      await user.click(screen.getByText('Resorts'))
      expect(onTabChange).toHaveBeenCalledWith('resorts')
    })

    it('shows Preferences in mobile menu when onOpenPreferences provided', async () => {
      const user = userEvent.setup()
      render(
        <Header
          {...smallScreenProps}
          view="tripList"
          onOpenPreferences={mock(() => {})}
        />
      )
      await user.click(screen.getByRole('button', { name: /open menu/i }))
      expect(screen.getByRole('menuitem', { name: /preferences/i }))
    })

    it('shows user name next to hamburger', () => {
      render(<Header {...smallScreenProps} view="tripList" />)
      expect(screen.getByText('Alice'))
    })
  })
})
