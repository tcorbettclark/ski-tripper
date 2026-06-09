import { describe, expect, it, mock } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Resorts from './Resorts'
import type { ScoredResort } from './resortSearch'
import type { ResortWithEmbedding } from './types.d.ts'

mock.module('./resortSearch', () => ({
  initSearchModel: mock(() => {}),
  getIsModelReady: mock(() => true),
  onModelReady: mock((cb: () => void) => cb()),
  searchResorts: mock(
    async (
      _query: string,
      resorts: ResortWithEmbedding[]
    ): Promise<ScoredResort[]> => resorts
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
    nearestAirport: 'Vancouver Airport',
    transferTime: 120,
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
    nearestAirport: 'Geneva Airport',
    transferTime: 210,
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
  {
    id: 'unknown-alps-andorra',
    resortName: 'Unknown Resort',
    country: 'Andorra',
    region: 'Alps',
    description: 'A resort with missing transfer time',
    latitude: '42.5424',
    longitude: '1.5932',
    summitAltitude: 2640,
    baseAltitude: 1750,
    nearestAirport: '',
    transferTime: null,
    pisteKm: 100,
    beginnerPct: 30,
    intermediatePct: 40,
    advancedPct: 30,
    liftCount: 25,
    snowReliability: 'medium',
    skiSeasonMonths: 'Dec-Mar',
    websites: [],
    linkedResortsDescription: '',
    embedding: [0.2, 0.3, 0.4],
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

  it('renders heading and search input', () => {
    render(<Resorts {...defaultProps()} />)
    expect(screen.getByText('Resorts Catalog')).toBeTruthy()
    expect(
      screen.getByPlaceholderText('Semantic search (more words are better)')
    ).toBeTruthy()
  })

  it('renders country tag cloud with common countries', () => {
    render(<Resorts {...defaultProps()} />)
    expect(screen.getByTitle('France')).toBeTruthy()
    expect(screen.getByTitle('Canada')).toBeTruthy()
    expect(screen.getByTitle('Switzerland')).toBeTruthy()
    expect(screen.getByTitle('Austria')).toBeTruthy()
    expect(screen.getByTitle('United States')).toBeTruthy()
    expect(screen.getByTitle('Japan')).toBeTruthy()
    expect(screen.getByTitle('Italy')).toBeTruthy()
  })

  it('renders region tag cloud with common regions', () => {
    render(<Resorts {...defaultProps()} />)
    expect(screen.getByTitle('Alps')).toBeTruthy()
    expect(screen.getByTitle('Appalachians')).toBeTruthy()
    expect(screen.getByTitle('Japanese Alps')).toBeTruthy()
    expect(screen.getByTitle('Carpathians')).toBeTruthy()
    expect(screen.getByTitle('Rockies (US)')).toBeTruthy()
    expect(screen.getByTitle('Scandinavia')).toBeTruthy()
  })

  it('renders more countries link for uncommon countries', () => {
    render(<Resorts {...defaultProps()} />)
    const moreLinks = screen.getAllByRole('button', { name: /\+\d+ more/ })
    expect(moreLinks.length).toBe(2)
  })

  it('renders more regions link for uncommon regions', () => {
    render(<Resorts {...defaultProps()} />)
    const moreButtons = screen.getAllByRole('button', { name: /\+\d+ more/ })
    expect(moreButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('shows result count', () => {
    render(<Resorts {...defaultProps()} />)
    expect(screen.getByText('4 of 4 resorts')).toBeTruthy()
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

  it('does not show clear location button when no location filters are active', () => {
    render(<Resorts {...defaultProps()} />)
    expect(screen.getByText('4 of 4 resorts')).toBeTruthy()

    expect(screen.queryByRole('button', { name: /clear location/i })).toBeNull()
  })

  it('shows clear location button when country filter is active', async () => {
    render(<Resorts {...defaultProps()} />)

    const franceButton = screen.getByTitle('France')
    fireEvent.click(franceButton)

    const clearButton = screen.getByRole('button', {
      name: /clear location/i,
    }) as HTMLButtonElement
    expect(clearButton).toBeTruthy()
  })

  it('clears location filters when clear button is clicked', async () => {
    const eventUser = userEvent.setup()
    render(<Resorts {...defaultProps()} />)

    const franceButton = screen.getByTitle('France')
    await eventUser.click(franceButton)

    await eventUser.click(
      screen.getByRole('button', { name: /clear location/i })
    )

    expect(screen.getByText('4 of 4 resorts')).toBeTruthy()
  })

  it('filters resorts by single country using tag cloud', async () => {
    render(<Resorts {...defaultProps()} />)

    const canadaButton = screen.getByTitle('Canada')
    fireEvent.click(canadaButton)

    await waitFor(() => {
      expect(screen.getByText('1 of 4 resorts')).toBeTruthy()
    })
  })

  it('filters resorts by multiple countries using OR logic', async () => {
    render(<Resorts {...defaultProps()} />)

    const franceButton = screen.getByTitle('France')
    const canadaButton = screen.getByTitle('Canada')
    fireEvent.click(franceButton)
    fireEvent.click(canadaButton)

    await waitFor(() => {
      expect(screen.getByText('2 of 4 resorts')).toBeTruthy()
    })
  })

  it('deselects country tag when clicked again', async () => {
    render(<Resorts {...defaultProps()} />)

    const franceButton = screen.getByTitle('France')
    fireEvent.click(franceButton)

    await waitFor(() => {
      expect(screen.getByText('1 of 4 resorts')).toBeTruthy()
    })

    fireEvent.click(franceButton)

    await waitFor(() => {
      expect(screen.getByText('4 of 4 resorts')).toBeTruthy()
    })
  })

  it('filters resorts by single region using tag cloud', async () => {
    render(<Resorts {...defaultProps()} />)

    const alpsButton = screen.getByTitle('Alps')
    fireEvent.click(alpsButton)

    await waitFor(() => {
      expect(screen.getByText('3 of 4 resorts')).toBeTruthy()
    })
  })

  it('filters resorts by uncommon region after expanding more', async () => {
    const eventUser = userEvent.setup()
    render(<Resorts {...defaultProps()} />)

    await eventUser.click(
      screen.getAllByRole('button', { name: /\+\d+ more/ })[1]
    )
    const rockiesButton = screen.getByTitle('Rockies (Canadian)')
    fireEvent.click(rockiesButton)

    await waitFor(() => {
      expect(screen.getByText('1 of 4 resorts')).toBeTruthy()
    })
  })

  it('shows uncommon countries when more is clicked', async () => {
    const eventUser = userEvent.setup()
    render(<Resorts {...defaultProps()} />)

    expect(screen.queryByTitle('Czechia')).toBeNull()

    await eventUser.click(
      screen.getAllByRole('button', { name: /\+\d+ more/ })[0]
    )

    expect(screen.getByTitle('Czechia')).toBeTruthy()
  })

  it('hides uncommon countries when less is clicked', async () => {
    const eventUser = userEvent.setup()
    render(<Resorts {...defaultProps()} />)

    await eventUser.click(
      screen.getAllByRole('button', { name: /\+\d+ more/ })[0]
    )
    expect(screen.getByTitle('Czechia')).toBeTruthy()

    await eventUser.click(screen.getByRole('button', { name: /less/i }))
    expect(screen.queryByTitle('Czechia')).toBeNull()
  })

  it('combines country and region filters', async () => {
    render(<Resorts {...defaultProps()} />)

    const franceButton = screen.getByTitle('France')
    const alpsButton = screen.getByTitle('Alps')
    fireEvent.click(franceButton)
    fireEvent.click(alpsButton)

    await waitFor(() => {
      expect(screen.getByText('1 of 4 resorts')).toBeTruthy()
    })
  })

  it('filters resorts by max transfer time', async () => {
    render(<Resorts {...defaultProps()} />)

    const slider = screen.getByLabelText(/max transfer time/i)
    fireEvent.change(slider, { target: { value: '60' } })

    await waitFor(() => {
      expect(screen.getByText('1 of 4 resorts')).toBeTruthy()
    })
  })

  it('shows Any when transfer time slider is at maximum', async () => {
    render(<Resorts {...defaultProps()} />)

    await waitFor(() => {
      const slider = screen.getByLabelText(/max transfer time/i)
      const group = slider.closest('div')!
      expect(group.querySelector('span')!.textContent).toBe('Any')
    })
    expect(screen.getByText('4 of 4 resorts')).toBeTruthy()
  })

  it('excludes resorts with null transfer time when transfer time filter is active', async () => {
    render(<Resorts {...defaultProps()} />)

    const slider = screen.getByLabelText(/max transfer time/i)
    fireEvent.change(slider, { target: { value: '120' } })

    await waitFor(() => {
      expect(screen.getByText('2 of 4 resorts')).toBeTruthy()
    })
  })

  it('displays formatted transfer time in slider value', () => {
    render(<Resorts {...defaultProps()} />)

    const slider = screen.getByLabelText(/max transfer time/i)
    fireEvent.change(slider, { target: { value: '80' } })

    const group = slider.closest('div')!
    expect(group.querySelector('span')!.textContent).toBe('1 hr 20 mins')
  })

  it('resets transfer time to Any when clear transport filters is clicked', async () => {
    const eventUser = userEvent.setup()
    render(<Resorts {...defaultProps()} />)

    const slider = screen.getByLabelText(/max transfer time/i)
    fireEvent.change(slider, { target: { value: '60' } })

    await waitFor(() => {
      expect(screen.getByText('1 of 4 resorts')).toBeTruthy()
    })

    await eventUser.click(
      screen.getByRole('button', { name: /clear transport/i })
    )

    await waitFor(() => {
      const group = screen.getByLabelText(/max transfer time/i).closest('div')!
      expect(group.querySelector('span')!.textContent).toBe('Any')
    })
    expect(screen.getByText('4 of 4 resorts')).toBeTruthy()
  })

  it('shows clear transport button when transfer time filter is active', () => {
    render(<Resorts {...defaultProps()} />)

    const slider = screen.getByLabelText(/max transfer time/i)
    fireEvent.change(slider, { target: { value: '60' } })

    const clearButton = screen.getByRole('button', {
      name: /clear transport/i,
    }) as HTMLButtonElement
    expect(clearButton).toBeTruthy()
  })

  it('filters resorts by piste profile - advanced shows resort where advanced is plurality', async () => {
    render(<Resorts {...defaultProps()} />)

    const advancedButton = screen.getByRole('button', { name: 'Advanced' })
    fireEvent.click(advancedButton)

    await waitFor(() => {
      expect(screen.getByText('1 of 4 resorts')).toBeTruthy()
    })
  })

  it('filters resorts by piste profile - intermediate+advanced shows all where combined beats each other', async () => {
    render(<Resorts {...defaultProps()} />)

    const intermediateButton = screen.getByRole('button', {
      name: 'Intermediate',
    })
    const advancedButton = screen.getByRole('button', { name: 'Advanced' })
    fireEvent.click(intermediateButton)
    fireEvent.click(advancedButton)

    await waitFor(() => {
      expect(screen.getByText('4 of 4 resorts')).toBeTruthy()
    })
  })

  it('toggles piste profile off when clicking same button again', async () => {
    render(<Resorts {...defaultProps()} />)

    const advancedButton = screen.getByRole('button', { name: 'Advanced' })
    fireEvent.click(advancedButton)

    await waitFor(() => {
      expect(screen.getByText('1 of 4 resorts')).toBeTruthy()
    })

    fireEvent.click(advancedButton)

    await waitFor(() => {
      expect(screen.getByText('4 of 4 resorts')).toBeTruthy()
    })
  })

  it('shows clear slope and terrain button when piste profile filter is active', () => {
    render(<Resorts {...defaultProps()} />)

    const beginnerButton = screen.getByRole('button', { name: 'Beginner' })
    fireEvent.click(beginnerButton)

    const clearButton = screen.getByRole('button', {
      name: /clear slope and terrain/i,
    }) as HTMLButtonElement
    expect(clearButton).toBeTruthy()
  })

  it('renders min resort alt slider', () => {
    render(<Resorts {...defaultProps()} />)
    const slider = screen.getByLabelText(/min resort alt/i)
    expect(slider).toBeTruthy()
  })

  it('filters resorts by min resort alt (base altitude)', async () => {
    render(<Resorts {...defaultProps()} />)

    const slider = screen.getByLabelText(/min resort alt/i)
    fireEvent.change(slider, { target: { value: '1500' } })

    await waitFor(() => {
      expect(screen.getByText('2 of 4 resorts')).toBeTruthy()
    })
  })

  it('shows Any when min resort alt slider is at zero', () => {
    render(<Resorts {...defaultProps()} />)

    const slider = screen.getByLabelText(/min resort alt/i)
    const group = slider.closest('div')!
    expect(group.querySelector('span')!.textContent).toBe('Any')
  })

  it('displays formatted value in min resort alt slider', () => {
    render(<Resorts {...defaultProps()} />)

    const slider = screen.getByLabelText(/min resort alt/i)
    fireEvent.change(slider, { target: { value: '1000' } })

    const group = slider.closest('div')!
    expect(group.querySelector('span')!.textContent).toBe('1000m')
  })

  it('shows clear slope and terrain button when min resort alt filter is active', () => {
    render(<Resorts {...defaultProps()} />)

    const slider = screen.getByLabelText(/min resort alt/i)
    fireEvent.change(slider, { target: { value: '1000' } })

    const clearButton = screen.getByRole('button', {
      name: /clear slope and terrain/i,
    }) as HTMLButtonElement
    expect(clearButton).toBeTruthy()
  })

  it('resets min resort alt to Any when clear slope filters is clicked', async () => {
    const eventUser = userEvent.setup()
    render(<Resorts {...defaultProps()} />)

    const slider = screen.getByLabelText(/min resort alt/i)
    fireEvent.change(slider, { target: { value: '1500' } })

    await waitFor(() => {
      expect(screen.getByText('2 of 4 resorts')).toBeTruthy()
    })

    await eventUser.click(
      screen.getByRole('button', { name: /clear slope and terrain/i })
    )

    await waitFor(() => {
      const group = screen.getByLabelText(/min resort alt/i).closest('div')!
      expect(group.querySelector('span')!.textContent).toBe('Any')
    })
    expect(screen.getByText('4 of 4 resorts')).toBeTruthy()
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
    expect(screen.getByText('5 of 5 resorts')).toBeTruthy()
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
