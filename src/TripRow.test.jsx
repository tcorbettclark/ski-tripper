import { describe, it, expect, mock } from 'bun:test'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

mock.module('./database', () => ({
  updateTrip: mock(() => Promise.resolve()),
  deleteTrip: mock(() => Promise.resolve())
}))

const { default: TripRow } = await import('./TripRow')

const sampleTrip = { $id: 'trip-1', code: 'ABC12', name: 'Ski Alps', description: 'A great trip' }

const noop = () => {}

function renderRow (trip, props = {}) {
  return render(
    <table>
      <tbody>
        <TripRow trip={trip} onUpdated={noop} onDeleted={noop} {...props} />
      </tbody>
    </table>
  )
}

describe('TripRow', () => {
  it('displays the trip name and description', () => {
    renderRow(sampleTrip)
    expect(screen.getByText('Ski Alps')).toBeInTheDocument()
    expect(screen.getByText('A great trip')).toBeInTheDocument()
  })

  it('shows a dash when description is empty', () => {
    renderRow({ ...sampleTrip, description: '' })
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows the Edit button in display mode', () => {
    renderRow(sampleTrip)
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('shows the edit form when Edit is clicked', async () => {
    const user = userEvent.setup()
    renderRow(sampleTrip)
    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('returns to display mode when Cancel is clicked', async () => {
    const user = userEvent.setup()
    renderRow(sampleTrip)
    await user.click(screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })
})
