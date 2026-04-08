import { describe, expect, it } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import ParticipantList from './ParticipantList'

describe('ParticipantList', () => {
  it('shows loading state initially', () => {
    render(
      <ParticipantList
        tripId="trip-1"
        listTripParticipants={() => new Promise(() => {})}
      />
    )
    expect(screen.getByText('Loading participants…'))
  })

  it('renders participant names and roles', async () => {
    render(
      <ParticipantList
        tripId="trip-1"
        listTripParticipants={() =>
          Promise.resolve({
            participants: [
              { $id: 'p1', participantUserName: 'Alice', role: 'coordinator' },
              { $id: 'p2', participantUserName: 'Bob', role: 'participant' },
            ],
          })
        }
      />
    )
    await waitFor(() =>
      expect(screen.queryByText('Loading participants…')).toBeNull()
    )
    expect(screen.getByText('Alice'))
    expect(screen.getByText('coordinator'))
    expect(screen.getByText('Bob'))
    expect(screen.getByText('participant'))
  })

  it('renders an empty list when there are no participants', async () => {
    render(
      <ParticipantList
        tripId="trip-1"
        listTripParticipants={() => Promise.resolve({ participants: [] })}
      />
    )
    await waitFor(() =>
      expect(screen.queryByText('Loading participants…')).toBeNull()
    )
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('surfaces fetch errors so ErrorBoundary can catch them', async () => {
    interface ErrorBoundaryProps {
      children?: ReactNode
    }
    interface ErrorBoundaryState {
      error: Error | null
    }
    class ErrorBoundary extends (await import('react')).Component<
      ErrorBoundaryProps,
      ErrorBoundaryState
    > {
      constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { error: null }
      }
      static getDerivedStateFromError(error: Error) {
        return { error }
      }
      render() {
        return this.state.error ? (
          <span>caught: {this.state.error.message}</span>
        ) : (
          this.props.children
        )
      }
    }

    const originalError = console.error
    console.error = () => {}
    try {
      render(
        <ErrorBoundary>
          <ParticipantList
            tripId="trip-1"
            listTripParticipants={() => Promise.reject(new Error('boom'))}
          />
        </ErrorBoundary>
      )
      await waitFor(() => expect(screen.getByText('caught: boom')))
    } finally {
      console.error = originalError
    }
  })
})
