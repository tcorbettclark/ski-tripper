import { describe, expect, it, mock } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Resorts from './Resorts'
import type { ResortWithEmbedding } from './types.d.ts'

mock.module('./resortSearch', () => ({
  initSearchModel: mock(() => {}),
  getIsModelReady: mock(() => true),
  onModelReady: mock((cb: () => void) => cb()),
  searchResorts: mock(
    async (_query: string, resorts: ResortWithEmbedding[]) => resorts
  ),
}))

const user = { $id: 'user-1', name: 'Alice' }

const sampleResorts: ResortWithEmbedding[] = [
  {
    id: 'chamonix-alps-france',
    resortName: 'Chamonix',
    country: 'France',
    region: 'Alps',
    description: 'A great French resort',
    latitude: '45.9237',
    longitude: '6.8694',
    summitAltitude: 3842,
    baseAltitude: 1035,
    nearestAirport: 'GVA',
    transferTime: '1h',
    pisteKm: 150,
    beginnerPct: 20,
    intermediatePct: 40,
    advancedPct: 40,
    liftCount: 50,
    snowReliability: 'high',
    skiSeasonMonths: 'Dec-Apr',
    websites: ['https://chamonix.com'],
    linkedResortsDescription: '',
    embedding: [0.1, 0.2, 0.3],
  },
  {
    id: 'whistler-rockies-canadian-canada',
    resortName: 'Whistler',
    country: 'Canada',
    region: 'Rockies (Canadian)',
    description: 'A great Canadian resort',
    latitude: '50.1163',
    longitude: '-122.9574',
    summitAltitude: 2184,
    baseAltitude: 653,
    nearestAirport: 'YVR',
    transferTime: '2h',
    pisteKm: 200,
    beginnerPct: 20,
    intermediatePct: 40,
    advancedPct: 40,
    liftCount: 30,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-Apr',
    websites: ['https://whistler.com'],
    linkedResortsDescription: '',
    embedding: [0.4, 0.5, 0.6],
  },
  {
    id: 'zermatt-alps-switzerland',
    resortName: 'Zermatt',
    country: 'Switzerland',
    region: 'Alps',
    description: 'A classic Swiss resort',
    latitude: '46.0207',
    longitude: '7.7491',
    summitAltitude: 3899,
    baseAltitude: 1620,
    nearestAirport: 'GVA',
    transferTime: '3h 30m',
    pisteKm: 360,
    beginnerPct: 15,
    intermediatePct: 35,
    advancedPct: 50,
    liftCount: 53,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-May',
    websites: ['https://zermatt.ch'],
    linkedResortsDescription: '',
    embedding: [0.7, 0.8, 0.9],
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
  it('renders no resorts message when resorts is empty', () => {
    render(<Resorts {...defaultProps({ resorts: [] })} />)
    expect(screen.getByText('No resorts available')).toBeTruthy()
  })

  it('renders heading and filters', () => {
    render(<Resorts {...defaultProps()} />)
    expect(screen.getByText('Resorts Catalog')).toBeTruthy()
    expect(
      screen.getByPlaceholderText('Semantic search (more words are better)')
    ).toBeTruthy()
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
    expect(screen.getByText('Peak Height')).toBeTruthy()
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

    const countrySelect = screen.getByDisplayValue('All Countries')
    await eventUser.selectOptions(countrySelect, 'Canada')

    const clearButton = screen.getByRole('button', {
      name: /clear filters/i,
    }) as HTMLButtonElement
    expect(clearButton).toBeTruthy()
    expect(clearButton.disabled).toBe(false)
  })

  it('clears filters when clear button is clicked', async () => {
    const eventUser = userEvent.setup()
    render(<Resorts {...defaultProps()} />)

    const countrySelect = screen.getByDisplayValue('All Countries')
    await eventUser.selectOptions(countrySelect, 'Canada')
    await eventUser.click(
      screen.getByRole('button', { name: /clear filters/i })
    )

    expect(screen.getByText('3 of 3 resorts')).toBeTruthy()
  })

  it('shows filtered result count when country filter is applied', async () => {
    const eventUser = userEvent.setup()
    render(<Resorts {...defaultProps()} />)

    const countrySelect = screen.getByDisplayValue('All Countries')
    await eventUser.selectOptions(countrySelect, 'Canada')

    await waitFor(() => {
      expect(screen.getByText('1 of 3 resorts')).toBeTruthy()
    })
  })

  it('displays all resorts passed as props', () => {
    const extraResort: ResortWithEmbedding = {
      ...sampleResorts[0],
      id: 'extraresort-hokkaido-japan',
      resortName: 'ExtraResort',
      country: 'Japan',
      region: 'Hokkaido',
      pisteKm: 50,
      beginnerPct: 50,
      intermediatePct: 0,
      advancedPct: 0,
    }
    const fourResorts = [...sampleResorts, extraResort]
    render(<Resorts {...defaultProps({ resorts: fourResorts })} />)
    expect(screen.getByText('4 of 4 resorts')).toBeTruthy()
  })

  it('disables search input when model is not ready', () => {
    mock.module('./resortSearch', () => ({
      initSearchModel: mock(() => {}),
      getIsModelReady: mock(() => false),
      onModelReady: mock(() => {}),
      searchResorts: mock(async () => []),
    }))
  })
})
