import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditTripDescriptionForm from './EditTripDescriptionForm'
import type { Trip } from './types.d.ts'

const noop = () => {}
const testTrip = {
  id: 'trip-1',
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-01T00:00:00Z',
  code: 'aaa-bbb-ccc',
  description: 'Original description',
} as Trip

const updatedTrip = {
  ...testTrip,
  description: 'Updated description',
}

function renderForm(props = {}) {
  return render(
    <EditTripDescriptionForm
      trip={testTrip}
      userId="user-1"
      onUpdated={noop}
      onCancel={noop}
      updateTrip={() => Promise.resolve(updatedTrip)}
      {...props}
    />
  )
}

describe('EditTripDescriptionForm', () => {
  it('renders with the current description pre-filled', () => {
    renderForm()
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('Original description')
  })

  it('calls updateTrip and onUpdated when a valid form is submitted', async () => {
    const user = userEvent.setup()
    const mockUpdate = mock(() => Promise.resolve(updatedTrip))
    const handleUpdated = mock(() => {})

    renderForm({ updateTrip: mockUpdate, onUpdated: handleUpdated })

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Updated description')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        'trip-1',
        { description: 'Updated description' },
        'user-1'
      )
      expect(handleUpdated).toHaveBeenCalledWith(updatedTrip)
    })
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const handleCancel = mock(() => {})
    renderForm({ onCancel: handleCancel })

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })

  it('displays an error message when the API call fails', async () => {
    const user = userEvent.setup()
    renderForm({
      updateTrip: () =>
        Promise.reject(new Error('Only the coordinator can edit this trip.')),
    })

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'New description')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText('Only the coordinator can edit this trip.'))
    })
  })

  it('shows saving state while submitting', async () => {
    const user = userEvent.setup()
    let resolvePromise: (value: unknown) => void
    const slowUpdate = () =>
      new Promise((resolve) => {
        resolvePromise = resolve
      })
    renderForm({ updateTrip: slowUpdate })

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'New desc')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(screen.getByText('Saving…'))
    await act(async () => {
      resolvePromise!(updatedTrip)
    })
  })
})
