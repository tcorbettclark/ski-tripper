import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockCreateTrip = mock(() =>
  Promise.resolve({ $id: 'new-id', name: 'Test Trip', description: '' })
)

mock.module('./database', () => ({
  createTrip: mockCreateTrip
}))

const { default: CreateTripForm } = await import('./CreateTripForm')

const noop = () => {}

const testUser = { $id: 'user-1', name: 'Test User', email: 'test@example.com' }

function renderForm (props = {}) {
  return render(<CreateTripForm user={testUser} onCreated={noop} {...props} />)
}

describe('CreateTripForm', () => {
  beforeEach(() => mockCreateTrip.mockClear())

  it('shows the "Trips I am coordinating" heading', () => {
    renderForm()
    expect(screen.getByText('Trips I am coordinating')).toBeInTheDocument()
  })

  it('hides the form on mount and shows the new trip button', () => {
    renderForm()
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getByRole('button', { name: /new trip/i })).toBeInTheDocument()
  })

  it('reveals the form when the new trip button is clicked', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: /new trip/i }))
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
  })

  it('calls createTrip and onCreated when a valid form is submitted', async () => {
    const user = userEvent.setup()
    const handleCreated = mock(() => {})
    renderForm({ onCreated: handleCreated })

    await user.click(screen.getByRole('button', { name: /new trip/i }))
    await user.type(screen.getAllByRole('textbox')[0], 'Ski Alps')
    await user.click(screen.getByRole('button', { name: /save trip/i }))

    await waitFor(() => {
      expect(mockCreateTrip).toHaveBeenCalledWith('user-1', { name: 'Ski Alps', description: '' })
      expect(handleCreated).toHaveBeenCalledTimes(1)
    })
  })

  it('hides the form after successful submission', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: /new trip/i }))
    await user.type(screen.getAllByRole('textbox')[0], 'Ski Alps')
    await user.click(screen.getByRole('button', { name: /save trip/i }))

    await waitFor(() => {
      expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    })
  })

  it('displays an error message when the API call fails', async () => {
    mockCreateTrip.mockImplementationOnce(() => Promise.reject(new Error('API error')))
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: /new trip/i }))
    await user.type(screen.getAllByRole('textbox')[0], 'Ski Alps')
    await user.click(screen.getByRole('button', { name: /save trip/i }))

    await waitFor(() => {
      expect(screen.getByText('API error')).toBeInTheDocument()
    })
  })
})
