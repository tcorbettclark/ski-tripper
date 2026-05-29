import { describe, expect, it, mock } from 'bun:test'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { Models } from 'appwrite'
import CreateProposalForm from './CreateProposalForm'
import type { Resort } from './types.d'

const sampleResorts: Resort[] = [
  {
    $id: 'r-1',
    $createdAt: '2025-01-01T00:00:00Z',
    $updatedAt: '2025-01-01T00:00:00Z',
    resortName: "Val d'Isère",
    country: 'France',
    region: 'Alps',
    description: 'A famous ski resort',
    latitude: '45.4475',
    longitude: '6.9219',
    summitAltitude: 3330,
    baseAltitude: 1850,
    nearestAirport: 'GVA',
    transferTime: '1h 30m',
    pisteKm: 300,
    suitableFor: ['advanced'],
    liftCount: 80,
    snowReliability: 'high',
    skiSeasonMonths: 'Dec-Apr',
    websites: ['https://valdisere.com'],
    linkedResortsDescription: '',
    enriched: true,
  },
  {
    $id: 'r-2',
    $createdAt: '2025-01-01T00:00:00Z',
    $updatedAt: '2025-01-01T00:00:00Z',
    resortName: 'Whistler',
    country: 'Canada',
    region: 'British Columbia',
    description: 'North American resort',
    latitude: '50.1207',
    longitude: '-122.9640',
    summitAltitude: 2280,
    baseAltitude: 675,
    nearestAirport: 'YVR',
    transferTime: '2h',
    pisteKm: 200,
    suitableFor: ['intermediate'],
    liftCount: 37,
    snowReliability: 'high',
    skiSeasonMonths: 'Nov-Apr',
    websites: ['https://whistler.com'],
    linkedResortsDescription: '',
    enriched: true,
  },
]

function renderForm(props = {}) {
  const defaults = {
    tripId: 'trip-1',
    userId: 'user-1',
    onCreated: mock(() => {}),
    onDismiss: mock(() => {}),
    createProposal: mock(() =>
      Promise.resolve({ $id: 'p-1', resortName: "Val d'Isère" })
    ),
    accountGet: () =>
      Promise.resolve({ $id: 'user-1', name: 'Alice' }) as Promise<Models.User>,
  }
  const utils = render(<CreateProposalForm {...defaults} {...props} />)
  return { ...utils, ...defaults, ...props }
}

function getSuggestionsDropdown(container: HTMLElement) {
  return container.querySelector('[data-testid="resort-suggestions"]')
}

function typeInResortInput(container: HTMLElement, value: string) {
  const input = container.querySelector(
    '[name="resortName"]'
  ) as HTMLInputElement
  fireEvent.change(input, { target: { name: 'resortName', value } })
}

async function selectDateRange(container: HTMLElement) {
  const dayButtons = container.querySelectorAll('button[name="day"]')
  if (dayButtons.length < 8) return
  await act(async () => {
    fireEvent.click(dayButtons[0])
  })
  await act(async () => {
    fireEvent.click(dayButtons[7])
  })
}

describe('CreateProposalForm', () => {
  it('renders main form fields', () => {
    const { container } = renderForm()
    expect(screen.getByText(/resort name/i)).toBeTruthy()
    expect(screen.getByLabelText(/country/i)).toBeTruthy()
    expect(screen.getByText(/summit altitude/i)).toBeTruthy()
    expect(screen.getByText(/nearest airport/i)).toBeTruthy()
    expect(screen.getByText(/transfer time/i)).toBeTruthy()
    expect(screen.getByText(/trip dates/i)).toBeTruthy()
    const textarea = container.querySelector('#description')
    expect(textarea).toBeTruthy()
  })

  it('calls createProposal on submit', async () => {
    const createProposal = mock(() =>
      Promise.resolve({ $id: 'p-1', resortName: "Val d'Isère" })
    )
    const { container } = renderForm({ createProposal })

    function fill(name: string, value: string) {
      const el = container.querySelector(`[name="${name}"]`)
      fireEvent.change(el!, { target: { name, value } })
    }

    fill('resortName', "Val d'Isère")
    fill('country', 'France')
    fill('region', 'Alps')
    fill('summitAltitude', '3330')
    fill('baseAltitude', '1850')
    fill('nearestAirport', 'GVA')
    fill('transferTime', '1h 30m')
    fill('pisteKm', '300')
    fireEvent.click(screen.getByLabelText('Advanced'))
    fill('liftCount', '80')
    fill('snowReliability', 'high')
    fill('skiSeasonMonths', 'Dec-Apr')
    fill('websites', 'https://valdisere.com')
    fill('latitude', '45.4475')
    fill('longitude', '6.9219')

    await selectDateRange(container)

    fill('description', 'Great resort for all levels.')

    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await waitFor(() => {
      expect(createProposal).toHaveBeenCalledTimes(1)
    })

    const call = createProposal.mock.calls[0]
    if (!call) return
    const [calledTripId, calledUserId, calledCreatorName, calledData] =
      call as unknown as [string, string, string, Record<string, unknown>]
    expect(calledTripId).toBe('trip-1')
    expect(calledUserId).toBe('user-1')
    expect(calledCreatorName).toBe('Alice')
    const resortData = calledData.resortData as Record<string, unknown>
    expect(resortData.resortName).toBe("Val d'Isère")
    expect(resortData.country).toBe('France')
    expect(calledData.description).toBe('Great resort for all levels.')
  })

  it('calls onCreated with result and onDismiss on success', async () => {
    const result = { $id: 'p-1', resortName: "Val d'Isère" }
    const createProposal = mock(() => Promise.resolve(result))
    const onCreated = mock(() => {})
    const onDismiss = mock(() => {})
    const { container } = renderForm({
      createProposal,
      onCreated,
      onDismiss,
    })

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(result)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  it('shows error message and does not call onDismiss on error', async () => {
    const createProposal = mock(() =>
      Promise.reject(new Error('Permission denied'))
    )
    const onDismiss = mock(() => {})
    const { container } = renderForm({ createProposal, onDismiss })

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeTruthy()
    })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('calls onDismiss when Cancel button is clicked', () => {
    const onDismiss = mock(() => {})
    renderForm({ onDismiss })

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('shows Saving… while submit is in flight', async () => {
    let resolvePromise: ((value: unknown) => void) | undefined
    const createProposal = mock(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve
        })
    )
    const { container } = renderForm({ createProposal })

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeTruthy()
    })

    await act(async () => {
      resolvePromise?.({ $id: 'p-1' })
    })
  })

  describe('resort autocomplete', () => {
    it('shows suggestions when typing resort name', () => {
      const { container } = renderForm({ resorts: sampleResorts })
      typeInResortInput(container, 'Val')
      const dropdown = getSuggestionsDropdown(container)
      expect(dropdown).toBeTruthy()
      expect(
        within(dropdown! as HTMLElement).getByText("Val d'Isère")
      ).toBeTruthy()
    })

    it('does not show suggestions when input is empty', () => {
      const { container } = renderForm({ resorts: sampleResorts })
      typeInResortInput(container, '')
      const dropdown = getSuggestionsDropdown(container)
      expect(dropdown).toBeNull()
    })

    it('auto-fills resort fields when a suggestion is selected', () => {
      const { container } = renderForm({ resorts: sampleResorts })
      typeInResortInput(container, 'Val')

      const suggestion = container.querySelector(
        '[data-testid="resort-suggestion-r-1"]'
      ) as HTMLElement
      fireEvent.mouseDown(suggestion)

      const countrySelect = container.querySelector(
        '[name="country"]'
      ) as HTMLSelectElement
      expect(countrySelect.value).toBe('France')

      const regionInput = container.querySelector(
        '[name="region"]'
      ) as HTMLInputElement
      expect(regionInput.value).toBe('Alps')

      const topAltInput = container.querySelector(
        '[name="summitAltitude"]'
      ) as HTMLInputElement
      expect(topAltInput.value).toBe('3330')

      const bottomAltInput = container.querySelector(
        '[name="baseAltitude"]'
      ) as HTMLInputElement
      expect(bottomAltInput.value).toBe('1850')

      const airportInput = container.querySelector(
        '[name="nearestAirport"]'
      ) as HTMLInputElement
      expect(airportInput.value).toBe('GVA')
    })

    it('pre-fills description when resort is selected', () => {
      const { container } = renderForm({ resorts: sampleResorts })
      typeInResortInput(container, 'Val')

      const suggestion = container.querySelector(
        '[data-testid="resort-suggestion-r-1"]'
      ) as HTMLElement
      fireEvent.mouseDown(suggestion)

      const desc = container.querySelector(
        '#description'
      ) as HTMLTextAreaElement
      expect(desc.value).toBe('A famous ski resort')
    })

    it('allows free-text entry for resort name not in catalog', () => {
      const { container } = renderForm({ resorts: sampleResorts })
      typeInResortInput(container, 'My Custom Resort')
      const input = container.querySelector(
        '[name="resortName"]'
      ) as HTMLInputElement
      expect(input.value).toBe('My Custom Resort')

      const countrySelect = container.querySelector(
        '[name="country"]'
      ) as HTMLSelectElement
      expect(countrySelect.value).toBe('')
    })

    it('filters suggestions by country and region', () => {
      const { container } = renderForm({ resorts: sampleResorts })
      typeInResortInput(container, 'Canada')
      const dropdown = getSuggestionsDropdown(container)
      expect(dropdown).toBeTruthy()
      expect(
        within(dropdown! as HTMLElement).getByText('Whistler')
      ).toBeTruthy()
    })
  })
})
