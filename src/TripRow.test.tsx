import { describe, it, expect, mock } from 'bun:test'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TripRow from './TripRow'

const sampleTrip = {
  $id: 'trip-1',
  code: 'ABC12',
  name: 'Ski Alps',
  description: 'A great trip',
}

const noop = () => {}

async function renderRow(trip, props = {}) {
  await act(async () => {
    render(
      <table>
        <tbody>
          <TripRow
            trip={trip}
            onSelectTrip={props.onSelectTrip || noop}
            getCoordinatorParticipant={() =>
              Promise.resolve({
                documents: [
                  {
                    ParticipantUserId: props.coordinatorUserId || 'user-1',
                    ParticipantUserName: 'Test User',
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
    expect(screen.getByText('A great trip')).toBeInTheDocument()
  })

  it('shows the coordinator name', async () => {
    await renderRow(sampleTrip)
    expect(screen.getByText(/Test User/)).toBeInTheDocument()
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
