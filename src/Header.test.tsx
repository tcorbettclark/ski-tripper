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
}

describe('Header', () => {
  it('renders countdown when activePollEndDate is provided', () => {
    const future = dayjs().add(2, 'day').toISOString()
    render(<Header {...defaultProps} activePollEndDate={future} />)
    expect(screen.getByText(/Poll closing in \d+d \d+h/))
  })

  it('renders "Poll ended" when endDate is in the past', () => {
    const past = dayjs().subtract(1, 'day').toISOString()
    render(<Header {...defaultProps} activePollEndDate={past} />)
    expect(screen.getByText('Poll ended'))
  })

  it('renders minutes-left countdown for near-future endDate', () => {
    const nearFuture = dayjs().add(5, 'minute').toISOString()
    render(<Header {...defaultProps} activePollEndDate={nearFuture} />)
    expect(screen.getByText(/Poll closing in \d+m \d+s/))
  })

  it('renders hours-left countdown for same-day endDate', () => {
    const sameDay = dayjs().add(3, 'hour').toISOString()
    render(<Header {...defaultProps} activePollEndDate={sameDay} />)
    expect(screen.getByText(/Poll closing in \d+h \d+m/))
  })

  it('shows "Voting" when activePollEndDate is null', () => {
    render(<Header {...defaultProps} activePollEndDate={null} />)
    expect(screen.getByText('Voting'))
    expect(screen.queryByText(/Poll closing in/)).toBeNull()
  })

  it('shows "Voting" when activePollEndDate is not provided', () => {
    render(<Header {...defaultProps} />)
    expect(screen.getByText('Voting'))
    expect(screen.queryByText(/Poll closing in/)).toBeNull()
  })

  it('does not render "Voting" or countdown in tripList view', () => {
    const future = dayjs().add(2, 'day').toISOString()
    render(
      <Header {...defaultProps} view="tripList" activePollEndDate={future} />
    )
    expect(screen.queryByText('Voting')).toBeNull()
    expect(screen.queryByText(/Poll closing in/)).toBeNull()
  })

  it('updates countdown text over time', () => {
    const nearFuture = dayjs().add(30, 'second').toISOString()
    render(<Header {...defaultProps} activePollEndDate={nearFuture} />)
    expect(screen.getByText(/Poll closing in \d+m \d+s/))
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
})
