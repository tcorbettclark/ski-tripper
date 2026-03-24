import { describe, it, expect, mock } from 'bun:test'
import { render, screen, act } from '@testing-library/react'

mock.module('./database', () => ({
  updateTrip: mock(() => Promise.resolve()),
  deleteTrip: mock(() => Promise.resolve()),
  getUserById: mock(() => Promise.resolve({ name: 'Alice', email: 'alice@example.com' }))
}))

const { default: TripTable } = await import('./TripTable')

const sampleTrips = [
  { $id: '1', name: 'Ski Alps', description: 'Alpine trip', userId: 'user-1' },
  { $id: '2', name: 'Whistler', description: 'Canada trip', userId: 'user-1' }
]

const noop = () => {}

async function renderTable (trips, props = {}) {
  await act(async () => {
    render(<TripTable trips={trips} onUpdated={noop} onDeleted={noop} {...props} />)
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

  it('shows the Co-ordinator column header by default', async () => {
    await renderTable(sampleTrips)
    expect(screen.getByText('Co-ordinator')).toBeInTheDocument()
  })

  it('hides the Co-ordinator column header when showCoordinator is false', async () => {
    await renderTable(sampleTrips, { showCoordinator: false })
    expect(screen.queryByText('Co-ordinator')).not.toBeInTheDocument()
  })
})
