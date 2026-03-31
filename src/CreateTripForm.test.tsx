import { describe, it, expect, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateTripForm from './CreateTripForm'

const noop = () => {}
const testUser = {
  $id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
}
const defaultTrip = {
  $id: 'new-trip',
  description: 'New Trip',
  code: 'aaa-bbb-ccc',
}

function renderForm(props = {}) {
  return render(
    <CreateTripForm
      user={testUser}
      onCreated={noop}
      onDismiss={noop}
      createTrip={() => Promise.resolve(defaultTrip)}
      accountGet={() => Promise.resolve(testUser)}
      {...props}
    />
  )
}

describe('CreateTripForm', () => {
  it('shows the description field', () => {
    renderForm()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('calls createTrip and onCreated when a valid form is submitted', async () => {
    const user = userEvent.setup()
    const mockCreate = mock(() => Promise.resolve(defaultTrip))
    const handleCreated = mock(() => {})
    renderForm({ createTrip: mockCreate, onCreated: handleCreated })

    await user.type(
      screen.getByRole('textbox'),
      'A trip to the Alps in February'
    )
    await user.click(screen.getByRole('button', { name: /save trip/i }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('user-1', 'Test User', {
        description: 'A trip to the Alps in February',
      })
      expect(handleCreated).toHaveBeenCalledTimes(1)
    })
  })

  it('calls onDismiss after successful submission', async () => {
    const user = userEvent.setup()
    const handleDismiss = mock(() => {})
    renderForm({ onDismiss: handleDismiss })

    await user.type(
      screen.getByRole('textbox'),
      'A trip to the Alps in February'
    )
    await user.click(screen.getByRole('button', { name: /save trip/i }))

    await waitFor(() => {
      expect(handleDismiss).toHaveBeenCalledTimes(1)
    })
  })

  it('calls onDismiss when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const handleDismiss = mock(() => {})
    renderForm({ onDismiss: handleDismiss })

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(handleDismiss).toHaveBeenCalledTimes(1)
  })

  it('displays an error message when the API call fails', async () => {
    const user = userEvent.setup()
    renderForm({ createTrip: () => Promise.reject(new Error('API error')) })

    await user.type(
      screen.getByRole('textbox'),
      'A trip to the Alps in February'
    )
    await user.click(screen.getByRole('button', { name: /save trip/i }))

    await waitFor(() => {
      expect(screen.getByText('API error')).toBeInTheDocument()
    })
  })
})
