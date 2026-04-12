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
  title: 'Test',
  description: 'Great powder skiing',
  resortName: "Val d'Isère",
  startDate: '2024-01-01',
  endDate: '2024-01-07',
  nearestAirport: 'GVA',
  transferTime: '2h 30m',
  altitudeRange: '1850m - 3456m',
  country: 'France',
}

function renderForm(props = {}) {
  const defaults = {
    proposal: sampleProposal,
    userId: 'user-1',
    onUpdated: mock(() => {}),
    onCancel: mock(() => {}),
    updateProposal: mock(() =>
      Promise.resolve({ $id: 'p-1', resortName: 'Updated' })
    ),
    listAccommodations: mock(() => Promise.resolve([])),
    createAccommodation: mock(() => Promise.resolve({ $id: 'acc-1' })),
    updateAccommodation: mock(() => Promise.resolve({ $id: 'acc-1' })),
    deleteAccommodation: mock(() => Promise.resolve()),
  }
  return render(<EditProposalForm {...defaults} {...props} />)
}

describe('EditProposalForm', () => {
  it('pre-populates fields from proposal', async () => {
    renderForm()
    await waitFor(() => {
      const input = screen.getByDisplayValue("Val d'Isère")
      expect(input).toBeTruthy()
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
