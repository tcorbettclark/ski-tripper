import { describe, it, expect } from 'bun:test'
import { render, screen, act } from '@testing-library/react'
import TripTable from './TripTable'

const sampleTrips = [
  { $id: '1', name: 'Ski Alps', description: 'Alpine trip', userId: 'user-1' },
  { $id: '2', name: 'Whistler', description: 'Canada trip', userId: 'user-1' }
]

const noop = () => {}
const defaultUser = { name: 'Test User', email: 'test@example.com' }

async function renderTable (trips, props = {}) {
  await act(async () => {
    render(
      <TripTable
        trips={trips}
        onUpdated={noop}
        onDeleted={noop}
        getUserById={() => Promise.resolve(defaultUser)}
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
    await renderTable(sampleTrips, { userId: 'user-2', onLeft: () => {} })
    const leaveButtons = screen.getAllByRole('button', { name: /leave/i })
    expect(leaveButtons).toHaveLength(sampleTrips.length)
  })

  it('shows Edit buttons when the current user owns the trips', async () => {
    await renderTable(sampleTrips, { userId: 'user-1' })
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    expect(editButtons).toHaveLength(sampleTrips.length)
  })
})
