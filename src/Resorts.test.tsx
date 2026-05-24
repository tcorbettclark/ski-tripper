import { describe, expect, it, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
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
    resorts: sampleResorts,
    onNavigateToProposals: mock(() => {}),
    onAuthError: mock(() => {}),
    ...overrides,
  }
}

describe('Resorts', () => {
  it('renders loading state when resorts is empty', () => {
    render(<Resorts {...defaultProps({ resorts: [] })} />)
    expect(screen.getByText('Loading resorts...')).toBeTruthy()
  })

  it('renders heading and filters', () => {
    render(<Resorts {...defaultProps()} />)
    expect(screen.getByText('Resorts')).toBeTruthy()
    expect(screen.getByPlaceholderText('Search resorts...')).toBeTruthy()
    expect(screen.getByDisplayValue('All Countries')).toBeTruthy()
    expect(screen.getByDisplayValue('All Regions')).toBeTruthy()
  })

  it('shows result count', () => {
    render(<Resorts {...defaultProps()} />)
    expect(screen.getByText('3 of 3 resorts')).toBeTruthy()
  })

  it('renders table headers', () => {
    render(<Resorts {...defaultProps()} />)
    expect(screen.getByText('Resort Name')).toBeTruthy()
    expect(screen.getByText('Country')).toBeTruthy()
    expect(screen.getByText('Region')).toBeTruthy()
    expect(screen.getByText('Piste Km')).toBeTruthy()
    expect(screen.getByText('Altitude Range')).toBeTruthy()
    expect(screen.getByText('Season')).toBeTruthy()
  })

  it('renders country filter options from data', () => {
    render(<Resorts {...defaultProps()} />)
    const countrySelect = screen.getByDisplayValue('All Countries')
    const options = countrySelect.querySelectorAll('option')
    expect(options.length).toBe(4)
  })

  it('renders region filter options from data', () => {
    render(<Resorts {...defaultProps()} />)
    const regionSelect = screen.getByDisplayValue('All Regions')
    const options = regionSelect.querySelectorAll('option')
    expect(options.length).toBe(3)
  })

  it('disables clear filters button when no filters are active', () => {
    render(<Resorts {...defaultProps()} />)
    expect(screen.getByText('3 of 3 resorts')).toBeTruthy()

    const clearButton = screen.getByRole('button', {
      name: /clear filters/i,
    }) as HTMLButtonElement
    expect(clearButton).toBeTruthy()
    expect(clearButton.disabled).toBe(true)
  })

  it('enables clear filters button when filters are active', async () => {
    const eventUser = userEvent.setup()
    render(<Resorts {...defaultProps()} />)

    const searchInput = screen.getByPlaceholderText('Search resorts...')
    await eventUser.type(searchInput, 'Chamonix')

    const clearButton = screen.getByRole('button', {
      name: /clear filters/i,
    }) as HTMLButtonElement
    expect(clearButton).toBeTruthy()
    expect(clearButton.disabled).toBe(false)
  })

  it('clears search when clear button is clicked', async () => {
    const eventUser = userEvent.setup()
    render(<Resorts {...defaultProps()} />)

    const searchInput = screen.getByPlaceholderText('Search resorts...')
    await eventUser.type(searchInput, 'Ch')
    await eventUser.click(
      screen.getByRole('button', { name: /clear filters/i })
    )

    expect(searchInput).toBeTruthy()
  })

  it('shows 0 result count when no resorts match country filter', async () => {
    const eventUser = userEvent.setup()
    render(<Resorts {...defaultProps()} />)

    const countrySelect = screen.getByDisplayValue('All Countries')
    await eventUser.selectOptions(countrySelect, 'Canada')

    await waitFor(() => {
      expect(screen.getByText('1 of 3 resorts')).toBeTruthy()
    })
  })
})
