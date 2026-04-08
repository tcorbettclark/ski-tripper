import { describe, expect, it, mock } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import EditProposalForm from './EditProposalForm'

const sampleProposal = {
  $id: 'p-1',
  $createdAt: '2024-01-01T00:00:00.000Z',
  $updatedAt: '2024-01-01T00:00:00.000Z',
  proposerUserId: 'user-1',
  proposerUserName: 'Test User',
  tripId: 'trip-1',
  state: 'DRAFT' as const,
  title: 'Test Proposal',
  resortName: "Val d'Isère",
  country: 'France',
  altitudeRange: '1850m - 3456m',
  nearestAirport: 'GVA',
  transferTime: '2h 30m',
  accommodationName: 'Chalet Belle Vue',
  accommodationUrl: 'https://example.com',
  approximateCost: '£1200pp',
  description: 'Great powder skiing',
  departureDate: '2024-03-01',
  returnDate: '2024-03-08',
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
  }
  return render(<EditProposalForm {...defaults} {...props} />)
}

describe('EditProposalForm', () => {
  it('pre-populates fields from proposal', () => {
    renderForm()
    const input = screen.getByDisplayValue("Val d'Isère")
    expect(input).toBeTruthy()
  })

  it('calls updateProposal with correct args and then onUpdated on submit', async () => {
    const onUpdated = mock(() => {})
    const updateProposal = mock(() =>
      Promise.resolve({ $id: 'p-1', resortName: 'Updated' })
    )
    renderForm({ onUpdated, updateProposal })

    fireEvent.submit(
      screen.getByRole('button', { name: /save/i }).closest('form')!
    )

    await waitFor(() => {
      expect(updateProposal).toHaveBeenCalledTimes(1)
      const [proposalId, userId, formData] = updateProposal.mock
        .calls[0] as unknown as [string, string, Record<string, string>]
      expect(proposalId).toBe('p-1')
      expect(userId).toBe('user-1')
      expect(formData.resortName).toBe("Val d'Isère")
      expect(onUpdated).toHaveBeenCalledWith({
        $id: 'p-1',
        resortName: 'Updated',
      })
    })
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = mock(() => {})
    renderForm({ onCancel })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows error message when updateProposal rejects', async () => {
    const updateProposal = mock(() =>
      Promise.reject(new Error('Update failed'))
    )
    renderForm({ updateProposal })

    fireEvent.submit(
      screen.getByRole('button', { name: /save/i }).closest('form')!
    )

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeTruthy()
    })
  })
})
