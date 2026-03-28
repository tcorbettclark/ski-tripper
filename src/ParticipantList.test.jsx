import { describe, it, expect } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import ParticipantList from './ParticipantList'

describe('ParticipantList', () => {
  it('shows loading state initially', () => {
    render(
      <ParticipantList
        tripId='trip-1'
        listTripParticipants={() => new Promise(() => {})}
      />
    )
    expect(screen.getByText('Loading participants…')).toBeInTheDocument()
  })

  it('renders participant names and roles', async () => {
    render(
      <ParticipantList
        tripId='trip-1'
        listTripParticipants={() => Promise.resolve({
          documents: [
            { $id: 'p1', ParticipantUserName: 'Alice', role: 'coordinator' },
            { $id: 'p2', ParticipantUserName: 'Bob', role: 'participant' }
          ]
        })}
      />
    )
    await waitFor(() => expect(screen.queryByText('Loading participants…')).not.toBeInTheDocument())
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('coordinator')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('participant')).toBeInTheDocument()
  })

  it('renders an empty list when there are no participants', async () => {
    render(
      <ParticipantList
        tripId='trip-1'
        listTripParticipants={() => Promise.resolve({ documents: [] })}
      />
    )
    await waitFor(() => expect(screen.queryByText('Loading participants…')).not.toBeInTheDocument())
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
