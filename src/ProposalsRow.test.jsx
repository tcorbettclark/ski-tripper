import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, mock } from 'bun:test'
import ProposalsRow from './ProposalsRow'

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
  accommodationUrl: '',
  approximateCost: '£1200pp',
  description: 'Great powder skiing'
}

async function renderProposalsRow (props = {}) {
  const defaults = {
    proposal: sampleProposal,
    userId: 'user-1',
    onUpdated: mock(() => {}),
    onDeleted: mock(() => {}),
    onSubmitted: mock(() => {}),
    updateProposal: mock(() => Promise.resolve()),
    deleteProposal: mock(() => Promise.resolve()),
    submitProposal: mock(() => Promise.resolve()),
    getUserById: mock(() => Promise.resolve({ name: 'Alice', email: 'alice@example.com' }))
  }
  let result
  await act(async () => {
    result = render(
      <table>
        <tbody>
          <ProposalsRow {...defaults} {...props} />
        </tbody>
      </table>
    )
  })
  return { ...result, ...defaults, ...props }
}

describe('ProposalsRow', () => {
  it('shows the resort name', async () => {
    await renderProposalsRow()
    expect(screen.getByText("Val d'Isère")).toBeInTheDocument()
  })

  it('shows the country', async () => {
    await renderProposalsRow()
    expect(screen.getByText('France')).toBeInTheDocument()
  })

  it('shows the altitude range', async () => {
    await renderProposalsRow()
    expect(screen.getByText('1850m - 3456m')).toBeInTheDocument()
  })

  it('shows creator name', async () => {
    await renderProposalsRow()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('shows the DRAFT status badge', async () => {
    await renderProposalsRow()
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
  })

  it('shows the SUBMITTED status badge', async () => {
    await renderProposalsRow({ proposal: { ...sampleProposal, state: 'SUBMITTED' } })
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument()
  })

  it('shows Edit, Delete, and Submit buttons when userId matches and state is DRAFT', async () => {
    await renderProposalsRow()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('hides action buttons when userId does not match the proposal creator', async () => {
    await renderProposalsRow({ userId: 'user-2' })
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument()
  })

  it('hides action buttons when proposal state is SUBMITTED', async () => {
    await renderProposalsRow({ proposal: { ...sampleProposal, state: 'SUBMITTED' } })
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument()
  })

  it('switches to editing mode when Edit is clicked', async () => {
    const user = userEvent.setup()
    await renderProposalsRow()
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    // In editing mode the normal row action buttons are replaced by the edit form
    // (The edit form itself has a Delete button, so we check for Submit which only exists in row mode)
    expect(screen.queryByRole('button', { name: /^submit$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
  })

  it('calls deleteProposal and onDeleted when Delete is clicked', async () => {
    const user = userEvent.setup()
    const deleteProposal = mock(() => Promise.resolve())
    const onDeleted = mock(() => {})
    await renderProposalsRow({ deleteProposal, onDeleted })
    await user.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => {
      expect(deleteProposal).toHaveBeenCalledWith('p-1', 'user-1')
      expect(onDeleted).toHaveBeenCalledWith('p-1')
    })
  })

  it('calls submitProposal and onSubmitted when Submit is clicked', async () => {
    const user = userEvent.setup()
    const submittedProposal = { ...sampleProposal, state: 'SUBMITTED' }
    const submitProposal = mock(() => Promise.resolve(submittedProposal))
    const onSubmitted = mock(() => {})
    await renderProposalsRow({ submitProposal, onSubmitted })
    await user.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => {
      expect(submitProposal).toHaveBeenCalledWith('p-1', 'user-1')
      expect(onSubmitted).toHaveBeenCalledWith(submittedProposal)
    })
  })

  it('shows an error when deleteProposal fails', async () => {
    const user = userEvent.setup()
    await renderProposalsRow({
      deleteProposal: mock(() => Promise.reject(new Error('Cannot delete')))
    })
    await user.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => {
      expect(screen.getByText('Cannot delete')).toBeInTheDocument()
    })
  })

  it('shows an error when submitProposal fails', async () => {
    const user = userEvent.setup()
    await renderProposalsRow({
      submitProposal: mock(() => Promise.reject(new Error('Cannot submit')))
    })
    await user.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => {
      expect(screen.getByText('Cannot submit')).toBeInTheDocument()
    })
  })
})
