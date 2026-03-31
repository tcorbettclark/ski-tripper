import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, mock } from 'bun:test'
import CreateProposalForm from './CreateProposalForm'

function renderForm(props = {}) {
  const defaults = {
    tripId: 'trip-1',
    userId: 'user-1',
    onCreated: mock(() => {}),
    onDismiss: mock(() => {}),
    createProposal: mock(() =>
      Promise.resolve({ $id: 'p-1', resortName: "Val d'Isère" })
    ),
    accountGet: () => Promise.resolve({ $id: 'user-1', name: 'Alice' }),
  }
  const utils = render(<CreateProposalForm {...defaults} {...props} />)
  return { ...utils, ...defaults, ...props }
}

describe('CreateProposalForm', () => {
  it('renders all 9 field labels', () => {
    renderForm()
    expect(screen.getByText(/resort name/i)).toBeTruthy()
    expect(screen.getByText(/country/i)).toBeTruthy()
    expect(screen.getByText(/altitude range/i)).toBeTruthy()
    expect(screen.getByText(/nearest airport/i)).toBeTruthy()
    expect(screen.getByText(/transfer time/i)).toBeTruthy()
    expect(screen.getByText(/accommodation name/i)).toBeTruthy()
    expect(screen.getByText(/accommodation url/i)).toBeTruthy()
    expect(screen.getByText(/approximate cost/i)).toBeTruthy()
    expect(screen.getByText(/description/i)).toBeTruthy()
  })

  it('calls createProposal with correct args on submit', async () => {
    const createProposal = mock(() =>
      Promise.resolve({ $id: 'p-1', resortName: "Val d'Isère" })
    )
    const { container } = renderForm({ createProposal })

    function fill(name, value) {
      const el = container.querySelector(`[name="${name}"]`)
      fireEvent.change(el, { target: { name, value } })
    }

    fill('resortName', "Val d'Isère")
    fill('country', 'France')
    fill('altitudeRange', '1800m - 3200m')
    fill('nearestAirport', 'GVA')
    fill('transferTime', '1h 30m')
    fill('accommodationName', 'Hotel Bellevue')
    fill('accommodationUrl', 'https://example.com')
    fill('approximateCost', '£1200pp')
    fill('description', 'Great resort for all levels.')

    fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(createProposal).toHaveBeenCalledTimes(1)
    })

    const [calledTripId, calledUserId, calledCreatorName, calledData] =
      createProposal.mock.calls[0]
    expect(calledTripId).toBe('trip-1')
    expect(calledUserId).toBe('user-1')
    expect(calledCreatorName).toBe('Alice')
    expect(calledData.resortName).toBe("Val d'Isère")
    expect(calledData.country).toBe('France')
    expect(calledData.altitudeRange).toBe('1800m - 3200m')
    expect(calledData.nearestAirport).toBe('GVA')
    expect(calledData.transferTime).toBe('1h 30m')
    expect(calledData.accommodationName).toBe('Hotel Bellevue')
    expect(calledData.accommodationUrl).toBe('https://example.com')
    expect(calledData.approximateCost).toBe('£1200pp')
    expect(calledData.description).toBe('Great resort for all levels.')
  })

  it('calls onCreated with result and onDismiss on success', async () => {
    const result = { $id: 'p-1', resortName: "Val d'Isère" }
    const createProposal = mock(() => Promise.resolve(result))
    const onCreated = mock(() => {})
    const onDismiss = mock(() => {})
    const { container } = renderForm({ createProposal, onCreated, onDismiss })

    fireEvent.submit(container.querySelector('form'))

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

    fireEvent.submit(container.querySelector('form'))

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

    fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeTruthy()
    })

    await act(async () => {
      resolvePromise({ $id: 'p-1' })
    })
  })
})
