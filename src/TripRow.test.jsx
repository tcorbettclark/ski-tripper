import { describe, it, expect, mock } from 'bun:test'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

mock.module('./database', () => ({
  updateTrip: mock(() => Promise.resolve()),
  deleteTrip: mock(() => Promise.resolve()),
  leaveTrip: mock(() => Promise.resolve()),
  getUserById: mock(() => Promise.resolve({ name: 'Alice', email: 'alice@example.com' }))
}))

const { default: TripRow } = await import('./TripRow')

const sampleTrip = { $id: 'trip-1', code: 'ABC12', name: 'Ski Alps', description: 'A great trip', userId: 'user-1' }

const noop = () => {}

async function renderRow (trip, props = {}) {
  await act(async () => {
    render(
      <table>
        <tbody>
          <TripRow trip={trip} onUpdated={noop} onDeleted={noop} {...props} />
        </tbody>
      </table>
    )
  })
}

describe('TripRow', () => {
  it('displays the trip name and description', async () => {
    await renderRow(sampleTrip)
    expect(screen.getByText('Ski Alps')).toBeInTheDocument()
    expect(screen.getByText('A great trip')).toBeInTheDocument()
  })

  it('shows the coordinator name', async () => {
    await renderRow(sampleTrip)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('hides the coordinator cell when showCoordinator is false', async () => {
    await renderRow(sampleTrip, { showCoordinator: false })
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })

  it('shows a dash when description is empty', async () => {
    await renderRow({ ...sampleTrip, description: '' })
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the Edit button in display mode', async () => {
    await renderRow(sampleTrip)
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('shows the edit form when Edit is clicked', async () => {
    const user = userEvent.setup()
    await renderRow(sampleTrip)
    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('returns to display mode when Cancel is clicked', async () => {
    const user = userEvent.setup()
    await renderRow(sampleTrip)
    await user.click(screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })
})
