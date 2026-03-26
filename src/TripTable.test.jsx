import { describe, it, expect, mock } from 'bun:test'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TripTable from './TripTable'

const sampleTrips = [
  { $id: '1', name: 'Ski Alps', description: 'Alpine trip' },
  { $id: '2', name: 'Whistler', description: 'Canada trip' }
]

const noop = () => {}
const defaultUser = { name: 'Test User', email: 'test@example.com' }

async function renderTable (trips, props = {}) {
  await act(async () => {
    render(
      <TripTable
        trips={trips}
        userId='user-1'
        coordinatorUserIds={{}}
        onUpdated={noop}
        onDeleted={noop}
        getUserById={() => Promise.resolve(defaultUser)}
        getCoordinatorParticipant={() => Promise.resolve({ documents: [] })}
        leaveTrip={() => Promise.resolve()}
        updateTrip={() => Promise.resolve({})}
        deleteTrip={() => Promise.resolve()}
        {...props}
      />
    )
  })
}

describe('TripTable', () => {
  it('shows an empty message when there are no trips', async () => {
    await renderTable([])
    expect(screen.getByText('No trips yet. Add one above.')).toBeInTheDocument()
  })

  it('renders a row for each trip', async () => {
    await renderTable(sampleTrips)
    expect(screen.getByText('Alpine trip')).toBeInTheDocument()
    expect(screen.getByText('Canada trip')).toBeInTheDocument()
  })

  it('does not render the empty message when trips exist', async () => {
    await renderTable(sampleTrips)
    expect(screen.queryByText('No trips yet.')).not.toBeInTheDocument()
  })

  it('shows the Co-ordinator column header', async () => {
    await renderTable(sampleTrips)
    expect(screen.getByText('Co-ordinator')).toBeInTheDocument()
  })

  it('shows the Code column header', async () => {
    await renderTable(sampleTrips)
    expect(screen.getByText('Code')).toBeInTheDocument()
  })

  it('shows a custom empty message when provided', async () => {
    await renderTable([], { emptyMessage: "You haven't joined any trips yet." })
    expect(screen.getByText("You haven't joined any trips yet.")).toBeInTheDocument()
  })

  it('shows Leave buttons when the current user does not own the trips', async () => {
    await renderTable(sampleTrips, { userId: 'user-2', onLeft: () => {}, coordinatorUserIds: { 1: 'user-1', 2: 'user-1' }, getCoordinatorParticipant: () => Promise.resolve({ documents: [{ userId: 'user-1' }] }) })
    const leaveButtons = screen.getAllByRole('button', { name: /leave/i })
    expect(leaveButtons).toHaveLength(sampleTrips.length)
  })

  it('shows Edit buttons when the current user owns the trips', async () => {
    await renderTable(sampleTrips, { userId: 'user-1', coordinatorUserIds: { 1: 'user-1', 2: 'user-1' } })
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    expect(editButtons).toHaveLength(sampleTrips.length)
  })

  it('shows Proposals buttons for each trip', async () => {
    await renderTable(sampleTrips, { onViewProposals: () => {} })
    const proposalsButtons = screen.getAllByRole('button', { name: /proposals/i })
    expect(proposalsButtons).toHaveLength(sampleTrips.length)
  })

  it('calls onViewProposals with correct trip id when Proposals button is clicked', async () => {
    const user = userEvent.setup()
    const handleViewProposals = mock(() => {})
    await renderTable(sampleTrips, { onViewProposals: handleViewProposals })
    await user.click(screen.getAllByRole('button', { name: /proposals/i })[0])
    expect(handleViewProposals).toHaveBeenCalledWith('1')
  })

  it('shows Actions column header', async () => {
    await renderTable(sampleTrips)
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })
})
