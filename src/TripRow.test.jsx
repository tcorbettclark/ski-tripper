import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TripRow from './TripRow'

const sampleTrip = { $id: 'trip-1', code: 'ABC12', name: 'Ski Alps', description: 'A great trip', userId: 'user-1' }
const defaultUser = { name: 'Test User', email: 'test@example.com' }
const defaultUpdated = { $id: 'trip-1', description: 'Updated', code: 'aaa-bbb-ccc', userId: 'user-1' }

const noop = () => {}

async function renderRow (trip, props = {}) {
  await act(async () => {
    render(
      <table>
        <tbody>
          <TripRow
            trip={trip}
            onUpdated={noop}
            onDeleted={noop}
            getUserById={() => Promise.resolve(defaultUser)}
            leaveTrip={() => Promise.resolve()}
            updateTrip={() => Promise.resolve(defaultUpdated)}
            deleteTrip={() => Promise.resolve()}
            {...props}
          />
        </tbody>
      </table>
    )
  })
}

describe('TripRow', () => {
  let mockWriteText

  beforeEach(() => {
    mockWriteText = mock(() => Promise.resolve())
    navigator.clipboard.writeText = mockWriteText
  })

  it('displays the trip description', async () => {
    await renderRow(sampleTrip)
    expect(screen.getByText('A great trip')).toBeInTheDocument()
  })

  it('shows the trip code', async () => {
    await renderRow(sampleTrip)
    expect(screen.getByText('ABC12')).toBeInTheDocument()
  })

  it('shows a dash when trip code is absent', async () => {
    await renderRow({ ...sampleTrip, code: undefined })
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the coordinator name', async () => {
    await renderRow(sampleTrip)
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('shows a dash when description is empty', async () => {
    await renderRow({ ...sampleTrip, description: '' })
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the Edit button when the trip belongs to the current user', async () => {
    await renderRow(sampleTrip, { userId: 'user-1' })
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /leave/i })).not.toBeInTheDocument()
  })

  it('shows the Leave button when the trip belongs to another user', async () => {
    await renderRow(sampleTrip, { userId: 'user-2', onLeft: noop })
    expect(screen.getByRole('button', { name: /leave/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('appends "(me)" to the coordinator name when the trip belongs to the current user', async () => {
    await renderRow(sampleTrip, { userId: 'user-1' })
    expect(screen.getByText('Test User (me)')).toBeInTheDocument()
  })

  it('calls leaveTrip and onLeft when Leave is clicked', async () => {
    const user = userEvent.setup()
    const mockLeave = mock(() => Promise.resolve())
    const handleLeft = mock(() => {})
    await renderRow(sampleTrip, { userId: 'user-2', onLeft: handleLeft, leaveTrip: mockLeave })
    await user.click(screen.getByRole('button', { name: /leave/i }))
    await waitFor(() => {
      expect(mockLeave).toHaveBeenCalledWith('user-2', 'trip-1')
      expect(handleLeft).toHaveBeenCalledWith('trip-1')
    })
  })

  it('shows an error message when leaving fails', async () => {
    const user = userEvent.setup()
    await renderRow(sampleTrip, {
      userId: 'user-2',
      onLeft: noop,
      leaveTrip: () => Promise.reject(new Error('Cannot leave'))
    })
    await user.click(screen.getByRole('button', { name: /leave/i }))
    await waitFor(() => {
      expect(screen.getByText('Cannot leave')).toBeInTheDocument()
    })
  })

  it('shows the edit form when Edit is clicked', async () => {
    const user = userEvent.setup()
    await renderRow(sampleTrip, { userId: 'user-1' })
    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('returns to display mode when Cancel is clicked', async () => {
    const user = userEvent.setup()
    await renderRow(sampleTrip, { userId: 'user-1' })
    await user.click(screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('shows a copy button when the trip has a code', async () => {
    await renderRow(sampleTrip)
    expect(screen.getByRole('button', { name: /copy trip code/i })).toBeInTheDocument()
  })

  it('does not show a copy button when the trip has no code', async () => {
    await renderRow({ ...sampleTrip, code: undefined })
    expect(screen.queryByRole('button', { name: /copy trip code/i })).not.toBeInTheDocument()
  })

  it('copies the trip code to the clipboard when the copy button is clicked', async () => {
    const user = userEvent.setup()
    await renderRow(sampleTrip)
    await user.click(screen.getByRole('button', { name: /copy trip code/i }))
    expect(mockWriteText).toHaveBeenCalledWith('ABC12')
  })

  it('shows a confirmation tick after copying and reverts after 1500ms', async () => {
    const user = userEvent.setup({ delay: null })
    await renderRow(sampleTrip)
    await user.click(screen.getByRole('button', { name: /copy trip code/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /copy trip code/i })).toHaveTextContent('✓'))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1500)) })
    expect(screen.getByRole('button', { name: /copy trip code/i })).toHaveTextContent('⧉')
  })
})
