import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TripRow from './TripRow'
import type { Trip } from './types.d.ts'

interface RenderRowProps {
  onSelectTrip?: () => void
  onShowTripInfo?: () => void
  coordinatorUserId?: string
}

const sampleTrip: Trip = {
  $id: 'trip-1',
  $createdAt: '2024-01-01T00:00:00.000Z',
  $updatedAt: '2024-01-01T00:00:00.000Z',
  code: 'ABC12',
  description: 'A great trip',
}

const noop = () => {}

async function renderRow(trip: Trip, props: RenderRowProps = {}) {
  await act(async () => {
    render(
      <table>
        <tbody>
          <TripRow
            trip={trip}
            onSelectTrip={props.onSelectTrip || noop}
            onShowTripInfo={props.onShowTripInfo || noop}
            getCoordinatorParticipant={() =>
              Promise.resolve({
                participants: [
                  {
                    participantUserId: props.coordinatorUserId || 'user-1',
                    participantUserName: 'Test User',
                  },
                ],
              })
            }
          />
        </tbody>
      </table>
    )
  })
}

describe('TripRow', () => {
  it('displays the trip description', async () => {
    await renderRow(sampleTrip)
    expect(screen.getByText('A great trip'))
  })

  it('shows the coordinator name', async () => {
    await renderRow(sampleTrip)
    expect(screen.getByText(/Test User/))
  })

  it('shows a dash when description is empty', async () => {
    await renderRow({ ...sampleTrip, description: '' })
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('calls onSelectTrip when row is clicked', async () => {
    const user = userEvent.setup()
    const handleSelectTrip = mock(() => {})
    await renderRow(sampleTrip, { onSelectTrip: handleSelectTrip })
    await user.click(screen.getByText('A great trip'))
    expect(handleSelectTrip).toHaveBeenCalledWith('trip-1')
  })
})
