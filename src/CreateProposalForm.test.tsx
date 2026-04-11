import { describe, expect, it, mock } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Models } from 'appwrite'
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
    accountGet: () =>
      Promise.resolve({ $id: 'user-1', name: 'Alice' }) as Promise<Models.User>,
  }
  const utils = render(<CreateProposalForm {...defaults} {...props} />)
  return { ...utils, ...defaults, ...props }
}

describe('CreateProposalForm', () => {
  it('renders main form fields', () => {
    const { container } = renderForm()
    expect(screen.getByText(/resort name/i)).toBeTruthy()
    expect(screen.getByLabelText(/country/i)).toBeTruthy()
    expect(screen.getByText(/altitude range/i)).toBeTruthy()
    expect(screen.getByText(/nearest airport/i)).toBeTruthy()
    expect(screen.getByText(/transfer time/i)).toBeTruthy()
    expect(screen.getByText(/depart/i)).toBeTruthy()
    expect(screen.getByText(/return/i)).toBeTruthy()
    const textarea = container.querySelector('#description')
    expect(textarea).toBeTruthy()
  })

  it('renders accommodations section with add button', () => {
    renderForm()
    expect(screen.getByText(/accommodations/i)).toBeTruthy()
    expect(screen.getByText(/\+ add accommodation/i)).toBeTruthy()
  })

  it('calls createProposal and createAccommodation on submit', async () => {
    const createProposal = mock(() =>
      Promise.resolve({ $id: 'p-1', resortName: "Val d'Isère" })
    )
    const createAccommodation = mock(() => Promise.resolve({ $id: 'acc-1' }))
    const { container } = renderForm({ createProposal, createAccommodation })

    function fill(name: string, value: string) {
      const el = container.querySelector(`[name="${name}"]`)
      fireEvent.change(el!, { target: { name, value } })
    }

    fill('resortName', "Val d'Isère")
    fill('country', 'France')
    fill('altitudeRange', '1800m - 3200m')
    fill('nearestAirport', 'GVA')
    fill('transferTime', '1h 30m')
    fill('departureDate', '2027-01-15')
    fill('returnDate', '2027-01-22')
    fill('description', 'Great resort for all levels.')

    const accNameInput = container.querySelector('[name^="acc-name-"]')
    if (accNameInput) {
      fireEvent.change(accNameInput, { target: { value: 'Hotel Bellevue' } })
    }

    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await waitFor(() => {
      expect(createProposal).toHaveBeenCalledTimes(1)
    })

    const call = createProposal.mock.calls[0]
    if (!call) return
    const [calledTripId, calledUserId, calledCreatorName, calledData] =
      call as unknown as [string, string, string, Record<string, string>]
    expect(calledTripId).toBe('trip-1')
    expect(calledUserId).toBe('user-1')
    expect(calledCreatorName).toBe('Alice')
    expect(calledData.resortName).toBe("Val d'Isère")
    expect(calledData.country).toBe('France')
    expect(calledData.description).toBe('Great resort for all levels.')

    expect(createAccommodation).toHaveBeenCalledTimes(1)
    const [, , accData] = createAccommodation.mock.calls[0] as unknown as [
      unknown,
      unknown,
      { name: string },
    ]
    expect(accData.name).toBe('Hotel Bellevue')
  })

  it('calls onCreated with result and onDismiss on success', async () => {
    const result = { $id: 'p-1', resortName: "Val d'Isère" }
    const createProposal = mock(() => Promise.resolve(result))
    const createAccommodation = mock(() => Promise.resolve({ $id: 'acc-1' }))
    const onCreated = mock(() => {})
    const onDismiss = mock(() => {})
    const { container } = renderForm({
      createProposal,
      createAccommodation,
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
})
