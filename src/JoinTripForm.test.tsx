import { describe, it, expect, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JoinTripForm from './JoinTripForm'

const noop = () => {}
const testUser = {
  $id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
}
const ownTrip = { $id: 'trip-1', code: 'abc-def-ghi', name: 'My Trip' }
const otherTrip = { $id: 'trip-2', code: 'xyz-uvw-rst', name: 'Other Trip' }

function renderForm(props = {}) {
  return render(
    <JoinTripForm
      user={testUser}
      onJoined={noop}
      onDismiss={noop}
      getTripByCode={() => Promise.resolve({ documents: [] })}
      joinTrip={() => Promise.resolve()}
      accountGet={() => Promise.resolve(testUser)}
      {...props}
    />
  )
}

describe('JoinTripForm', () => {
  it('shows the trip code field', () => {
    renderForm()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('calls onDismiss when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const handleDismiss = mock(() => {})
    renderForm({ onDismiss: handleDismiss })

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(handleDismiss).toHaveBeenCalledTimes(1)
  })

  it('normalises the code to trimmed lowercase before looking it up', async () => {
    const mockGet = mock(() => Promise.resolve({ documents: [otherTrip] }))
    const user = userEvent.setup()
    renderForm({ getTripByCode: mockGet })

    await user.type(screen.getByRole('textbox'), '  XYZ-UVW-RST  ')
    await user.click(screen.getByRole('button', { name: /join trip/i }))

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('xyz-uvw-rst')
    })
  })

  it('calls onDismiss after a successful join', async () => {
    const user = userEvent.setup()
    const handleDismiss = mock(() => {})
    renderForm({
      getTripByCode: () => Promise.resolve({ documents: [otherTrip] }),
      onDismiss: handleDismiss,
    })

    await user.type(screen.getByRole('textbox'), 'xyz-uvw-rst')
    await user.click(screen.getByRole('button', { name: /join trip/i }))

    await waitFor(() => {
      expect(handleDismiss).toHaveBeenCalledTimes(1)
    })
  })

  it('allows a coordinator to join their own trip', async () => {
    const mockJoin = mock(() => Promise.resolve())
    const handleJoined = mock(() => {})
    const user = userEvent.setup()
    renderForm({
      getTripByCode: () => Promise.resolve({ documents: [ownTrip] }),
      joinTrip: mockJoin,
      onJoined: handleJoined,
    })

    await user.type(screen.getByRole('textbox'), 'abc-def-ghi')
    await user.click(screen.getByRole('button', { name: /join trip/i }))

    await waitFor(() => {
      expect(mockJoin).toHaveBeenCalledWith('user-1', 'Test User', 'trip-1')
      expect(handleJoined).toHaveBeenCalledWith(ownTrip)
    })
  })

  it('shows an error when the trip code is not found', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByRole('textbox'), 'bad-code')
    await user.click(screen.getByRole('button', { name: /join trip/i }))

    await waitFor(() => {
      expect(
        screen.getByText('No trip found with that code.')
      ).toBeInTheDocument()
    })
  })

  it('shows an error when already joined', async () => {
    const user = userEvent.setup()
    renderForm({
      getTripByCode: () => Promise.resolve({ documents: [otherTrip] }),
      joinTrip: () =>
        Promise.reject(new Error('You have already joined this trip.')),
    })

    await user.type(screen.getByRole('textbox'), 'xyz-uvw-rst')
    await user.click(screen.getByRole('button', { name: /join trip/i }))

    await waitFor(() => {
      expect(
        screen.getByText('You have already joined this trip.')
      ).toBeInTheDocument()
    })
  })
})
