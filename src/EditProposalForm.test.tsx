import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, mock } from 'bun:test'
import EditProposalForm from './EditProposalForm'

const sampleProposal = {
  $id: 'p-1',
  userId: 'user-1',
  state: 'DRAFT',
  resortName: "Val d'Isère",
  country: 'France',
  altitudeRange: '1850m - 3456m',
  nearestAirport: 'GVA',
  transferTime: '2h 30m',
  accommodationName: 'Chalet Belle Vue',
  accommodationUrl: 'https://example.com',
  approximateCost: '£1200pp',
  description: 'Great powder skiing'
}

function renderForm (props = {}) {
  const defaults = {
    proposal: sampleProposal,
    userId: 'user-1',
    onUpdated: mock(() => {}),
    onDeleted: mock(() => {}),
    onCancel: mock(() => {}),
    updateProposal: mock(() => Promise.resolve({ $id: 'p-1', resortName: 'Updated' })),
    deleteProposal: mock(() => Promise.resolve())
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
    const updateProposal = mock(() => Promise.resolve({ $id: 'p-1', resortName: 'Updated' }))
    renderForm({ onUpdated, updateProposal })

    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form'))

    await waitFor(() => {
      expect(updateProposal).toHaveBeenCalledTimes(1)
      const [proposalId, userId, formData] = updateProposal.mock.calls[0]
      expect(proposalId).toBe('p-1')
      expect(userId).toBe('user-1')
      expect(formData.resortName).toBe("Val d'Isère")
      expect(onUpdated).toHaveBeenCalledWith({ $id: 'p-1', resortName: 'Updated' })
    })
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = mock(() => {})
    renderForm({ onCancel })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows confirm dialog and calls deleteProposal and onDeleted when confirmed', async () => {
    global.confirm = mock(() => true)
    const onDeleted = mock(() => {})
    const deleteProposal = mock(() => Promise.resolve())
    renderForm({ onDeleted, deleteProposal })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(global.confirm).toHaveBeenCalledWith('Delete this proposal?')
      expect(deleteProposal).toHaveBeenCalledWith('p-1', 'user-1')
      expect(onDeleted).toHaveBeenCalledWith('p-1')
    })
  })

  it('skips delete when confirm returns false', async () => {
    global.confirm = mock(() => false)
    const onDeleted = mock(() => {})
    const deleteProposal = mock(() => Promise.resolve())
    renderForm({ onDeleted, deleteProposal })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(deleteProposal).toHaveBeenCalledTimes(0)
      expect(onDeleted).toHaveBeenCalledTimes(0)
    })
  })

  it('shows error message when updateProposal rejects', async () => {
    const updateProposal = mock(() => Promise.reject(new Error('Update failed')))
    renderForm({ updateProposal })

    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form'))

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeTruthy()
    })
  })

  it('shows error when deleteProposal rejects', async () => {
    global.confirm = mock(() => true)
    const deleteProposal = mock(() => Promise.reject(new Error('Delete failed')))
    renderForm({ deleteProposal })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeTruthy()
    })
  })
})
