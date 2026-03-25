import { describe, it, expect } from 'bun:test'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Trips from './Trips'

const testUser = { $id: 'user-1', name: 'Test User', email: 'test@example.com' }
const defaultUser = { name: 'Test User', email: 'test@example.com' }
const defaultTrip = { $id: 'new-trip', description: 'New Trip', code: 'aaa-bbb-ccc' }

function renderTrips (props = {}) {
  return render(
    <Trips
      user={testUser}
      listTrips={() => Promise.resolve({ documents: [] })}
      listParticipatedTrips={() => Promise.resolve([])}
      createTrip={() => Promise.resolve(defaultTrip)}
      getTripByCode={() => Promise.resolve({ documents: [] })}
      joinTrip={() => Promise.resolve()}
      updateTrip={() => Promise.resolve(defaultTrip)}
      deleteTrip={() => Promise.resolve()}
      leaveTrip={() => Promise.resolve()}
      getUserById={() => Promise.resolve(defaultUser)}
      {...props}
    />
  )
}

describe('Trips', () => {
  it('shows a loading message while fetching', () => {
    renderTrips({ listTrips: () => new Promise(() => {}) })
    expect(screen.getByText(/loading trips/i)).toBeInTheDocument()
  })

  it('shows an error when the API call fails', async () => {
    await act(async () => { renderTrips({ listTrips: () => Promise.reject(new Error('Server error')) }) })
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  it('shows the Trips heading with New Trip and Join Trip buttons after loading', async () => {
    await act(async () => { renderTrips() })
    await waitFor(() => {
      expect(screen.getByText('Trips')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /\+ new trip/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /\+ join trip/i })).toBeInTheDocument()
    })
  })

  it('renders a row for each coordinated trip', async () => {
    await act(async () => {
      renderTrips({
        listTrips: () => Promise.resolve({
          documents: [
            { $id: 't-1', description: "Val d'Isere week", code: 'aaa-bbb-ccc' },
            { $id: 't-2', description: 'Chamonix weekend', code: 'ddd-eee-fff' }
          ],
          coordinatorUserIds: { 't-1': 'user-1', 't-2': 'user-1' }
        })
      })
    })
    await waitFor(() => {
      expect(screen.getByText("Val d'Isere week")).toBeInTheDocument()
      expect(screen.getByText('Chamonix weekend')).toBeInTheDocument()
    })
  })

  it('renders a row for each joined trip', async () => {
    await act(async () => {
      renderTrips({
        listParticipatedTrips: () => Promise.resolve([
          { $id: 't-3', description: 'Whistler trip', code: 'ggg-hhh-iii', userId: 'user-2' }
        ])
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Whistler trip')).toBeInTheDocument()
    })
  })

  it('removes the row when a coordinated trip that is also in participatedTrips is deleted', async () => {
    const trip = { $id: 't-1', description: 'Alps trip', code: 'aaa-bbb-ccc' }

    const originalConfirm = window.confirm
    window.confirm = () => true

    const user = userEvent.setup()
    await act(async () => {
      renderTrips({
        listTrips: () => Promise.resolve({ documents: [trip], coordinatorUserIds: { 't-1': 'user-1' } }),
        listParticipatedTrips: () => Promise.resolve([trip])
      })
    })
    await waitFor(() => expect(screen.getByText('Alps trip')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(screen.queryByText('Alps trip')).not.toBeInTheDocument()
    })

    window.confirm = originalConfirm
  })

  it('adds a newly created trip to the coordinating list', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderTrips({
        createTrip: () => Promise.resolve({ $id: 'new-trip', description: 'Alps in February', code: 'aaa-bbb-ccc' })
      })
    })
    await waitFor(() => screen.getByRole('button', { name: /new trip/i }))

    await user.click(screen.getByRole('button', { name: /new trip/i }))
    await user.type(screen.getByRole('textbox'), 'Alps in February')
    await user.click(screen.getByRole('button', { name: /save trip/i }))

    await waitFor(() => {
      expect(screen.getByText('Alps in February')).toBeInTheDocument()
    })
  })
})
