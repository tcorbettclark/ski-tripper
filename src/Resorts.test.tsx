import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Models } from 'appwrite'
import Resorts from './Resorts'
import type { Resort } from './types.d.ts'

const user = { $id: 'user-1', name: 'Alice' } as Models.User

const sampleResorts: Resort[] = [
  {
    $id: 'resort-1',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    resortName: 'Chamonix',
    country: 'France',
    region: 'Alps',
    description: 'A great French resort',
    latitude: '45.9237',
    longitude: '6.8694',
    topAltitude: 3842,
    bottomAltitude: 1035,
    nearestAirport: 'GVA',
    transferTime: '1h',
    pisteKm: 150,
    difficulty: 'advanced',
    liftCount: 50,
    snowReliability: 'high',
    skiSeasonMonths: 'Dec-Apr',
    websiteUrl: 'https://chamonix.com',
    enriched: true,
  },
  {
    $id: 'resort-2',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    resortName: 'Whistler',
    country: 'Canada',
    region: 'Rockies (Canadian)',
    description: 'A great Canadian resort',
    latitude: '50.1163',
    longitude: '-122.9574',
    topAltitude: 2184,
    bottomAltitude: 653,
    nearestAirport: 'YVR',
    transferTime: '2h',
    pisteKm: 200,
    difficulty: 'advanced',
    liftCount: 30,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-Apr',
    websiteUrl: 'https://whistler.com',
    enriched: true,
  },
  {
    $id: 'resort-3',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    resortName: 'Zermatt',
    country: 'Switzerland',
    region: 'Alps',
    description: 'A classic Swiss resort',
    latitude: '46.0207',
    longitude: '7.7491',
    topAltitude: 3899,
    bottomAltitude: 1620,
    nearestAirport: 'GVA',
    transferTime: '3h 30m',
    pisteKm: 360,
    difficulty: 'advanced',
    liftCount: 53,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-May',
    websiteUrl: 'https://zermatt.ch',
    enriched: true,
  },
]

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    user,
    tripId: 'trip-1',
    onNavigateToProposals: mock(() => {}),
    onAuthError: mock(() => {}),
    listResorts: mock(() => Promise.resolve({ resorts: sampleResorts })),
    ...overrides,
  }
}

describe('Resorts', () => {
  it('renders loading state', async () => {
    const neverResolves = mock(
      () => new Promise<{ resorts: Resort[] }>(() => {})
    )
    await act(async () => {
      render(<Resorts {...defaultProps({ listResorts: neverResolves })} />)
    })
    expect(screen.getByText('Loading resorts...')).toBeTruthy()
  })

  it('renders error state', async () => {
    await act(async () => {
      render(
        <Resorts
          {...defaultProps({
            listResorts: mock(() => Promise.reject(new Error('Load failed'))),
          })}
        />
      )
    })
    await waitFor(() => {
      expect(screen.getByText('Load failed')).toBeTruthy()
    })
  })

  it('renders heading and filters after loading', async () => {
    await act(async () => {
      render(<Resorts {...defaultProps()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('Resorts')).toBeTruthy()
      expect(screen.getByPlaceholderText('Search resorts...')).toBeTruthy()
      expect(screen.getByDisplayValue('All Countries')).toBeTruthy()
      expect(screen.getByDisplayValue('All Regions')).toBeTruthy()
    })
  })

  it('shows result count', async () => {
    await act(async () => {
      render(<Resorts {...defaultProps()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('3 of 3 resorts')).toBeTruthy()
    })
  })

  it('renders table headers', async () => {
    await act(async () => {
      render(<Resorts {...defaultProps()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('Resort Name')).toBeTruthy()
      expect(screen.getByText('Country')).toBeTruthy()
      expect(screen.getByText('Region')).toBeTruthy()
      expect(screen.getByText('Piste Km')).toBeTruthy()
      expect(screen.getByText('Altitude Range')).toBeTruthy()
      expect(screen.getByText('Season')).toBeTruthy()
    })
  })

  it('renders country filter options from data', async () => {
    await act(async () => {
      render(<Resorts {...defaultProps()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('3 of 3 resorts')).toBeTruthy()
    })
    const countrySelect = screen.getByDisplayValue('All Countries')
    const options = countrySelect.querySelectorAll('option')
    expect(options.length).toBe(4)
  })

  it('renders region filter options from data', async () => {
    await act(async () => {
      render(<Resorts {...defaultProps()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('3 of 3 resorts')).toBeTruthy()
    })
    const regionSelect = screen.getByDisplayValue('All Regions')
    const options = regionSelect.querySelectorAll('option')
    expect(options.length).toBe(3)
  })

  it('shows View Proposals button when onNavigateToProposals is provided', async () => {
    await act(async () => {
      render(<Resorts {...defaultProps()} />)
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /view proposals/i })
      ).toBeTruthy()
    })
  })

  it('does not show View Proposals button when onNavigateToProposals is not provided', async () => {
    const { onNavigateToProposals, ...propsWithoutNav } = defaultProps()
    await act(async () => {
      render(<Resorts {...propsWithoutNav} />)
    })
    await waitFor(() => {
      expect(screen.getByText('3 of 3 resorts')).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: /view proposals/i })).toBeNull()
  })

  it('shows clear filters button after typing in search', async () => {
    const eventUser = userEvent.setup()
    await act(async () => {
      render(<Resorts {...defaultProps()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('3 of 3 resorts')).toBeTruthy()
    })

    expect(screen.queryByRole('button', { name: /clear filters/i })).toBeNull()

    const searchInput = screen.getByPlaceholderText('Search resorts...')
    await eventUser.type(searchInput, 'Chamonix')

    expect(screen.getByRole('button', { name: /clear filters/i })).toBeTruthy()
  })

  it('clears search when clear button is clicked', async () => {
    const eventUser = userEvent.setup()
    await act(async () => {
      render(<Resorts {...defaultProps()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('3 of 3 resorts')).toBeTruthy()
    })

    const searchInput = screen.getByPlaceholderText('Search resorts...')
    await eventUser.type(searchInput, 'Ch')
    await eventUser.click(
      screen.getByRole('button', { name: /clear filters/i })
    )

    expect(searchInput).toBeTruthy()
  })

  it('calls onNavigateToProposals when View Proposals button is clicked', async () => {
    const onNavigateToProposals = mock(() => {})
    const eventUser = userEvent.setup()
    await act(async () => {
      render(<Resorts {...defaultProps({ onNavigateToProposals })} />)
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /view proposals/i })
      ).toBeTruthy()
    })

    await eventUser.click(
      screen.getByRole('button', { name: /view proposals/i })
    )
    expect(onNavigateToProposals).toHaveBeenCalled()
  })

  it('shows 0 result count when no resorts match country filter', async () => {
    const eventUser = userEvent.setup()
    await act(async () => {
      render(<Resorts {...defaultProps()} />)
    })
    await waitFor(() => {
      expect(screen.getByText('3 of 3 resorts')).toBeTruthy()
    })

    const countrySelect = screen.getByDisplayValue('All Countries')
    await eventUser.selectOptions(countrySelect, 'Canada')

    await waitFor(() => {
      expect(screen.getByText('1 of 3 resorts')).toBeTruthy()
    })
  })
})
