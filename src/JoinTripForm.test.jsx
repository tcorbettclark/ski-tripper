import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockGetTripByCode = mock(() => Promise.resolve({ documents: [] }))
const mockJoinTrip = mock(() => Promise.resolve())

mock.module('./database', () => ({
  getTripByCode: mockGetTripByCode,
  joinTrip: mockJoinTrip
}))

const { default: JoinTripForm } = await import('./JoinTripForm')

const noop = () => {}
const testUser = { $id: 'user-1', name: 'Test User', email: 'test@example.com' }
const ownTrip = { $id: 'trip-1', code: 'abc-def-ghi', name: 'My Trip', userId: 'user-1' }
const otherTrip = { $id: 'trip-2', code: 'xyz-uvw-rst', name: 'Other Trip', userId: 'user-2' }

function renderForm (props = {}) {
  return render(<JoinTripForm user={testUser} onJoined={noop} {...props} />)
}

describe('JoinTripForm', () => {
  beforeEach(() => {
    mockGetTripByCode.mockClear()
    mockJoinTrip.mockClear()
  })

  it('allows a coordinator to join their own trip', async () => {
    mockGetTripByCode.mockImplementationOnce(() => Promise.resolve({ documents: [ownTrip] }))
    const user = userEvent.setup()
    const handleJoined = mock(() => {})
    renderForm({ onJoined: handleJoined })

    await user.click(screen.getByRole('button', { name: /join trip/i }))
    await user.type(screen.getByRole('textbox'), 'abc-def-ghi')
    await user.click(screen.getByRole('button', { name: /join trip/i }))

    await waitFor(() => {
      expect(mockJoinTrip).toHaveBeenCalledWith('user-1', 'trip-1')
      expect(handleJoined).toHaveBeenCalledWith(ownTrip)
    })
  })

  it('shows an error when the trip code is not found', async () => {
    mockGetTripByCode.mockImplementationOnce(() => Promise.resolve({ documents: [] }))
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: /join trip/i }))
    await user.type(screen.getByRole('textbox'), 'bad-code')
    await user.click(screen.getByRole('button', { name: /join trip/i }))

    await waitFor(() => {
      expect(screen.getByText('No trip found with that code.')).toBeInTheDocument()
    })
  })

  it('shows an error when already joined', async () => {
    mockGetTripByCode.mockImplementationOnce(() => Promise.resolve({ documents: [otherTrip] }))
    mockJoinTrip.mockImplementationOnce(() =>
      Promise.reject(new Error('You have already joined this trip.'))
    )
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: /join trip/i }))
    await user.type(screen.getByRole('textbox'), 'xyz-uvw-rst')
    await user.click(screen.getByRole('button', { name: /join trip/i }))

    await waitFor(() => {
      expect(screen.getByText('You have already joined this trip.')).toBeInTheDocument()
    })
  })
})
