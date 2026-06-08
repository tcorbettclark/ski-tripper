import { describe, expect, it, mock } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import EditProposalForm from './EditProposalForm'
import type { Proposal } from './types.d.ts'

const sampleProposal: Proposal = {
  $id: 'p-1',
  $createdAt: '2024-01-01T00:00:00Z',
  $updatedAt: '2024-01-01T00:00:00Z',
  proposerUserId: 'user-1',
  proposerUserName: 'John Doe',
  tripId: 'trip-1',
  state: 'DRAFT',
  description: 'Great powder skiing',
  resortName: "Val d'Isère",
  startDate: '2024-01-01',
  endDate: '2024-01-07',
  nearestAirport: 'Geneva Airport',
  transferTime: 150,
  country: 'France',
  region: 'Alps',
  summitAltitude: 3456,
  baseAltitude: 1850,
  pisteKm: 300,
  beginnerPct: 0,
  intermediatePct: 0,
  advancedPct: 0,
  liftCount: 80,
  snowReliability: 'high',
  skiSeasonMonths: 'Dec-Apr',
  websites: ['https://valdisere.com'],
  latitude: '45.4475',
  longitude: '6.9219',
  linkedResortsDescription: '',
}

function renderForm(props = {}) {
  const defaults = {
    proposal: sampleProposal,
    userId: 'user-1',
    onUpdated: mock((_p: unknown) => {}),
    onCancel: mock(() => {}),
    updateProposal: mock(() =>
      Promise.resolve({ $id: 'p-1', resortName: 'Updated' })
    ),
  }
  return render(<EditProposalForm {...defaults} {...props} />)
}

describe('EditProposalForm', () => {
  it('renders form fields including date range picker', async () => {
    renderForm()
    await waitFor(() => {
      expect(screen.getByText(/trip dates/i)).toBeTruthy()
    })
  })

  it('calls updateProposal with correct args and then onUpdated on submit', async () => {
    const onUpdated = mock(() => {})
    const updateProposal = mock(() =>
      Promise.resolve({ $id: 'p-1', resortName: 'Updated' })
    )
    renderForm({ onUpdated, updateProposal })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    })

    await act(async () => {
      const form = document.querySelector('form')
      form?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      )
    })

    await waitFor(() => {
      expect(updateProposal).toHaveBeenCalledTimes(1)
      const [proposalId, userId, formData] = updateProposal.mock
        .calls[0] as unknown as [string, string, Record<string, string>]
      expect(proposalId).toBe('p-1')
      expect(userId).toBe('user-1')
      expect(formData.resortName).toBe("Val d'Isère")
    })
  })

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = mock(() => {})
    renderForm({ onCancel })
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('passes updated proposal from server response to onUpdated, not original prop', async () => {
    const onUpdated = mock(() => {})
    const updatedFromServer = {
      ...sampleProposal,
      resortName: 'Updated Resort',
      $updatedAt: '2024-02-01T00:00:00Z',
    }
    const updateProposal = mock(() => Promise.resolve(updatedFromServer))
    renderForm({ onUpdated, updateProposal })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    })

    await act(async () => {
      const form = document.querySelector('form')
      form?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      )
    })

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledTimes(1)
      const passedProposal = (
        onUpdated.mock.calls as unknown[][]
      )[0][0] as Proposal
      expect(passedProposal.resortName).toBe('Updated Resort')
      expect(passedProposal.$updatedAt).toBe('2024-02-01T00:00:00Z')
    })
  })

  it('shows date validation error when submitting without dates', async () => {
    const updateProposal = mock(() =>
      Promise.resolve({ $id: 'p-1', resortName: 'Updated' })
    )
    const proposalWithoutDates: Proposal = {
      ...sampleProposal,
      startDate: '',
      endDate: '',
    }
    renderForm({ proposal: proposalWithoutDates, updateProposal })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    })

    const form = document.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      )
    })

    expect(
      screen.getByText('Please select both a start and end date')
    ).toBeTruthy()
    expect(updateProposal).not.toHaveBeenCalled()
  })

  it('shows error message when updateProposal rejects', async () => {
    const updateProposal = mock(() =>
      Promise.reject(new Error('Update failed'))
    )
    renderForm({ updateProposal })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    })

    await act(async () => {
      const form = document.querySelector('form')
      form?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeTruthy()
    })
  })
})
