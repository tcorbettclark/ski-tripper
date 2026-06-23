import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ResortWithEmbedding, User } from '../shared/types.d'
import ResortDetailModal from './ResortDetailModal'

const user: User = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  emailVerification: true,
}

const sampleResort: ResortWithEmbedding = {
  id: 'chamonix-alps-france',
  resortName: 'Chamonix',
  country: 'France',
  region: 'Alps',
  description: 'A great French resort',
  latitude: '45.9237',
  longitude: '6.8694',
  summitAltitude: 3842,
  baseAltitude: 1035,
  nearestAirport: 'Geneva Airport',
  transferTime: 60,
  pisteKm: 150,
  beginnerPct: 20,
  intermediatePct: 40,
  advancedPct: 40,
  liftCount: 50,
  snowReliability: 'high',
  skiSeasonMonths: 'Dec-Apr',
  websites: ['https://chamonix.com'],
  linkedResortsDescription: 'Linked with Courmayeur',
  embedding: [0.1, 0.2, 0.3],
}

const onCloseMock = mock(() => {})

describe('ResortDetailModal', () => {
  beforeEach(() => {
    onCloseMock.mockClear()
  })

  it('renders resort name in header', async () => {
    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    expect(screen.getByText(/Chamonix/)).toBeTruthy()
  })

  it('renders resort details grid', async () => {
    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    expect(screen.getByText('Altitude Range')).toBeTruthy()
    expect(screen.getByText('1035m – 3842m')).toBeTruthy()
    expect(screen.getByText('150 km')).toBeTruthy()
    expect(screen.getByText('Geneva Airport')).toBeTruthy()
    expect(screen.getByText('1 hr')).toBeTruthy()
    expect(screen.getByText('High')).toBeTruthy()
  })

  it('renders description section when resort has description', async () => {
    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    expect(screen.getByText('Description')).toBeTruthy()
    expect(screen.getByText('A great French resort')).toBeTruthy()
  })

  it('renders linked resorts section', async () => {
    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    expect(screen.getByText('Linked Resorts')).toBeTruthy()
  })

  it('renders website links', async () => {
    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    expect(screen.getByText('chamonix.com')).toBeTruthy()
  })

  it('renders propose button in footer', async () => {
    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    expect(
      screen.getByRole('button', { name: /propose this resort/i })
    ).toBeTruthy()
  })

  it('calls onClose when close button clicked', async () => {
    const userEvent_ = userEvent.setup()

    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    const closeButton = screen.getByRole('button', { name: /close/i })
    await userEvent_.click(closeButton)
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on overlay click', async () => {
    const userEvent_ = userEvent.setup()

    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    const overlay = screen.getByRole('dialog')
    await userEvent_.click(overlay)
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when clicking inside panel', async () => {
    const userEvent_ = userEvent.setup()

    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    const proposeButton = screen.getByRole('button', {
      name: /propose this resort/i,
    })
    await userEvent_.click(proposeButton)
    expect(onCloseMock).not.toHaveBeenCalled()
  })

  it('shows proposal form when propose button clicked', async () => {
    const userEvent_ = userEvent.setup()

    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    await userEvent_.click(
      screen.getByRole('button', { name: /propose this resort/i })
    )

    expect(screen.getByLabelText(/proposal name/i)).toBeTruthy()
    expect(screen.getByText('Create Draft Proposal')).toBeTruthy()
  })

  it('hides propose button while in proposal form', async () => {
    const userEvent_ = userEvent.setup()

    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    await userEvent_.click(
      screen.getByRole('button', { name: /propose this resort/i })
    )

    expect(
      screen.queryByRole('button', { name: /propose this resort/i })
    ).toBeNull()
  })

  it('renders country flag in header when country has a flag URL', async () => {
    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    const flagImg = screen.getByAltText('France')
    expect(flagImg).toBeTruthy()
  })

  it('renders Google Maps link when resort has coordinates', async () => {
    await act(async () => {
      render(
        <ResortDetailModal
          resort={sampleResort}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    const mapLink = screen.getByRole('link', {
      name: /open in google maps/i,
    })
    expect(mapLink).toBeTruthy()
    expect(mapLink.getAttribute('href')).toContain(
      'google.com/maps?q=45.9237,6.8694'
    )
  })

  it('renders resort without websites', async () => {
    const resortNoWebsites: ResortWithEmbedding = {
      ...sampleResort,
      websites: [],
    }

    await act(async () => {
      render(
        <ResortDetailModal
          resort={resortNoWebsites}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    expect(screen.queryByText('Websites')).toBeNull()
  })

  it('renders resort without description', async () => {
    const resortNoDesc: ResortWithEmbedding = {
      ...sampleResort,
      description: '',
      linkedResortsDescription: '',
    }

    await act(async () => {
      render(
        <ResortDetailModal
          resort={resortNoDesc}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    expect(screen.queryByText('Description')).toBeNull()
    expect(screen.queryByText('Linked Resorts')).toBeNull()
  })

  it('renders resort name fallback when resortName is empty', async () => {
    const resortNoName: ResortWithEmbedding = {
      ...sampleResort,
      resortName: '',
    }

    await act(async () => {
      render(
        <ResortDetailModal
          resort={resortNoName}
          tripId="trip-1"
          user={user}
          onClose={onCloseMock}
        />
      )
    })

    const header = screen.getByRole('heading', { level: 3 })
    expect(header.textContent).toContain('\u2014')
  })
})
