import { describe, it, expect } from 'bun:test'
import { render, screen, act } from '@testing-library/react'
import TripTable from './TripTable'

const sampleTrips = [
  { $id: '1', name: 'Ski Alps', description: 'Alpine trip' },
  { $id: '2', name: 'Whistler', description: 'Canada trip' },
]

const noop = () => {}

async function renderTable(trips, props = {}) {
  await act(async () => {
    render(
      <TripTable
        trips={trips}
        onSelectTrip={noop}
        getCoordinatorParticipant={() =>
          Promise.resolve({
            documents: [
              { ParticipantUserId: 'user-1', ParticipantUserName: 'Test User' },
            ],
          })
        }
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

  it('shows a custom empty message when provided', async () => {
    await renderTable([], {
      emptyMessage: "You haven't joined any trips yet.",
    })
    expect(
      screen.getByText("You haven't joined any trips yet.")
    ).toBeInTheDocument()
  })
})
