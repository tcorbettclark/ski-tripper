import { describe, it, expect, mock, spyOn } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditTripForm from './EditTripForm'

const sampleTrip = {
  $id: 'trip-1',
  name: 'Ski Alps',
  description: 'A great trip',
}
const defaultUpdated = {
  $id: 'trip-1',
  description: 'Updated',
  code: 'aaa-bbb-ccc',
}
const noop = () => {}

function renderForm(props = {}) {
  return render(
    <EditTripForm
      trip={sampleTrip}
      userId="user-1"
      onUpdated={noop}
      onDeleted={noop}
      onCancel={noop}
      updateTrip={() => Promise.resolve(defaultUpdated)}
      deleteTrip={() => Promise.resolve()}
      {...props}
    />
  )
}

describe('EditTripForm', () => {
  it('pre-fills the description field from the trip prop', () => {
    renderForm()
    expect(screen.getByRole('textbox')).toHaveValue('A great trip')
  })

  it('calls updateTrip and onUpdated when the form is saved', async () => {
    const user = userEvent.setup()
    const mockUpdate = mock(() => Promise.resolve(defaultUpdated))
    const handleUpdated = mock(() => {})
    renderForm({ updateTrip: mockUpdate, onUpdated: handleUpdated })

    const descInput = screen.getByRole('textbox')
    await user.clear(descInput)
    await user.type(descInput, 'Updated description')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        'trip-1',
        {
          description: 'Updated description',
        },
        'user-1'
      )
      expect(handleUpdated).toHaveBeenCalledWith(defaultUpdated)
    })
  })

  it('calls deleteTrip and onDeleted when delete is confirmed', async () => {
    spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    const mockDelete = mock(() => Promise.resolve())
    const handleDeleted = mock(() => {})
    renderForm({ deleteTrip: mockDelete, onDeleted: handleDeleted })

    await user.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('trip-1', 'user-1')
      expect(handleDeleted).toHaveBeenCalledTimes(1)
    })
  })

  it('does not delete when confirm is cancelled', async () => {
    spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    const mockDelete = mock(() => Promise.resolve())
    renderForm({ deleteTrip: mockDelete })

    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const handleCancel = mock(() => {})
    renderForm({ onCancel: handleCancel })

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })

  it('shows an error message when save fails', async () => {
    const user = userEvent.setup()
    renderForm({ updateTrip: () => Promise.reject(new Error('Save failed')) })

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument()
    })
  })
})
