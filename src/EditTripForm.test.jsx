import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockUpdateTrip = mock(() =>
  Promise.resolve({ $id: 'trip-1', name: 'Updated', description: '' })
)
const mockDeleteTrip = mock(() => Promise.resolve())

mock.module('./database', () => ({
  updateTrip: mockUpdateTrip,
  deleteTrip: mockDeleteTrip
}))

const { default: EditTripForm } = await import('./EditTripForm')

const sampleTrip = { $id: 'trip-1', name: 'Ski Alps', description: 'A great trip' }

const noop = () => {}

function renderForm (props = {}) {
  return render(
    <EditTripForm
      trip={sampleTrip}
      onUpdated={noop}
      onDeleted={noop}
      onCancel={noop}
      {...props}
    />
  )
}

describe('EditTripForm', () => {
  beforeEach(() => {
    mockUpdateTrip.mockClear()
    mockDeleteTrip.mockClear()
  })

  it('pre-fills the description field from the trip prop', () => {
    renderForm()
    expect(screen.getByRole('textbox')).toHaveValue('A great trip')
  })

  it('calls updateTrip and onUpdated when the form is saved', async () => {
    const user = userEvent.setup()
    const handleUpdated = mock(() => {})
    renderForm({ onUpdated: handleUpdated })

    const descInput = screen.getByRole('textbox')
    await user.clear(descInput)
    await user.type(descInput, 'Updated description')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockUpdateTrip).toHaveBeenCalledWith('trip-1', {
        description: 'Updated description'
      })
      expect(handleUpdated).toHaveBeenCalledTimes(1)
    })
  })

  it('calls deleteTrip and onDeleted when delete is confirmed', async () => {
    window.confirm = mock(() => true)
    const user = userEvent.setup()
    const handleDeleted = mock(() => {})
    renderForm({ onDeleted: handleDeleted })

    await user.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(mockDeleteTrip).toHaveBeenCalledWith('trip-1')
      expect(handleDeleted).toHaveBeenCalledTimes(1)
    })
  })

  it('does not delete when confirm is cancelled', async () => {
    window.confirm = mock(() => false)
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(mockDeleteTrip).not.toHaveBeenCalled()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const handleCancel = mock(() => {})
    renderForm({ onCancel: handleCancel })

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })

  it('shows an error message when save fails', async () => {
    mockUpdateTrip.mockImplementationOnce(() => Promise.reject(new Error('Save failed')))
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument()
    })
  })
})
