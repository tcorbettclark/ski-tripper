import { describe, expect, it } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import TripTable from './TripTable'
import type { Trip } from './types'

const sampleTrips: Trip[] = [
  {
    $id: '1',
    $createdAt: '',
    $updatedAt: '',
    code: '',
    description: 'Alpine trip',
  },
  {
    $id: '2',
    $createdAt: '',
    $updatedAt: '',
    code: '',
    description: 'Canada trip',
  },
]

const noop = () => {}

async function renderTable(trips: Trip[], props = {}) {
  await act(async () => {
    render(
      <TripTable
        trips={trips}
        onSelectTrip={noop}
        getCoordinatorParticipant={() =>
          Promise.resolve({
            participants: [
              { participantUserId: 'user-1', participantUserName: 'Test User' },
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
    expect(screen.getByText('No trips yet. Add one above.'))
  })

  it('renders a row for each trip', async () => {
    await renderTable(sampleTrips)
    expect(screen.getByText('Alpine trip'))
    expect(screen.getByText('Canada trip'))
  })

  it('does not render the empty message when trips exist', async () => {
    await renderTable(sampleTrips)
    expect(screen.queryByText('No trips yet.')).toBeNull()
  })

  it('shows the Co-ordinator column header', async () => {
    await renderTable(sampleTrips)
    expect(screen.getByText('Co-ordinator'))
  })

  it('shows a custom empty message when provided', async () => {
    await renderTable([], {
      emptyMessage: "You haven't joined any trips yet.",
    })
    expect(screen.getByText("You haven't joined any trips yet."))
  })
})
