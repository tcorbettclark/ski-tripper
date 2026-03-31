import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, mock } from 'bun:test'
import ProposalsRow from './ProposalsRow'

const sampleProposal = {
  $id: 'p-1',
  ProposerUserId: 'user-1',
  ProposerUserName: 'Alice',
  state: 'DRAFT',
  resortName: "Val d'Isère",
  country: 'France',
  altitudeRange: '1850m - 3456m',
  nearestAirport: 'GVA',
  transferTime: '2h 30m',
  accommodationName: 'Chalet Belle Vue',
  accommodationUrl: '',
  approximateCost: '£1200pp',
  description: 'Great powder skiing',
}

async function renderProposalsRow(props = {}) {
  const defaults = {
    proposal: sampleProposal,
    userId: 'user-1',
    isCoordinator: false,
    onUpdated: mock(() => {}),
    onDeleted: mock(() => {}),
    onSubmitted: mock(() => {}),
    onRejected: mock(() => {}),
    onView: mock(() => {}),
    updateProposal: mock(() => Promise.resolve()),
    deleteProposal: mock(() => Promise.resolve()),
    submitProposal: mock(() => Promise.resolve()),
    rejectProposal: mock(() => Promise.resolve()),
  }
  let result: ReturnType<typeof render> | undefined
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

  it('shows creator name', async () => {
    await renderProposalsRow()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('shows the DRAFT status badge', async () => {
    await renderProposalsRow()
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
  })

  it('shows the SUBMITTED status badge', async () => {
    await renderProposalsRow({
      proposal: { ...sampleProposal, state: 'SUBMITTED' },
    })
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument()
  })

  it('shows Edit and Submit buttons when userId matches and state is DRAFT', async () => {
    await renderProposalsRow()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /delete/i })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('hides action buttons when userId does not match the proposal creator', async () => {
    await renderProposalsRow({ userId: 'user-2' })
    expect(
      screen.queryByRole('button', { name: /edit/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /submit/i })
    ).not.toBeInTheDocument()
  })

  it('hides action buttons when proposal state is SUBMITTED', async () => {
    await renderProposalsRow({
      proposal: { ...sampleProposal, state: 'SUBMITTED' },
    })
    expect(
      screen.queryByRole('button', { name: /edit/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /submit/i })
    ).not.toBeInTheDocument()
  })

  it('switches to editing mode when Edit is clicked', async () => {
    const user = userEvent.setup()
    await renderProposalsRow()
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    // In editing mode the normal row action buttons are replaced by the edit form
    // (The edit form itself has a Delete button, so we check for Submit which only exists in row mode)
    expect(
      screen.queryByRole('button', { name: /^submit$/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^edit$/i })
    ).not.toBeInTheDocument()
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

  it('shows an error when submitProposal fails', async () => {
    const user = userEvent.setup()
    await renderProposalsRow({
      submitProposal: mock(() => Promise.reject(new Error('Cannot submit'))),
    })
    await user.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => {
      expect(screen.getByText('Cannot submit')).toBeInTheDocument()
    })
  })

  it('shows a View button for all users regardless of ownership', async () => {
    await renderProposalsRow({ userId: 'user-2' })
    expect(screen.getByRole('button', { name: /^view$/i })).toBeInTheDocument()
  })

  it('shows a View button for submitted proposals', async () => {
    await renderProposalsRow({
      proposal: { ...sampleProposal, state: 'SUBMITTED' },
    })
    expect(screen.getByRole('button', { name: /^view$/i })).toBeInTheDocument()
  })

  it('calls onView when View is clicked', async () => {
    const user = userEvent.setup()
    const onView = mock(() => {})
    await renderProposalsRow({ onView })
    await user.click(screen.getByRole('button', { name: /^view$/i }))
    expect(onView).toHaveBeenCalledTimes(1)
  })

  it('shows the REJECTED status badge', async () => {
    await renderProposalsRow({
      proposal: { ...sampleProposal, state: 'REJECTED' },
    })
    expect(screen.getByText('REJECTED')).toBeInTheDocument()
  })

  it('shows no action buttons for REJECTED proposals', async () => {
    await renderProposalsRow({
      proposal: { ...sampleProposal, state: 'REJECTED' },
    })
    expect(
      screen.queryByRole('button', { name: /^view$/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^edit$/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^submit$/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^reject$/i })
    ).not.toBeInTheDocument()
  })

  it('shows Reject button when isCoordinator and proposal is SUBMITTED', async () => {
    await renderProposalsRow({
      isCoordinator: true,
      proposal: { ...sampleProposal, state: 'SUBMITTED' },
    })
    expect(
      screen.getByRole('button', { name: /^reject$/i })
    ).toBeInTheDocument()
  })

  it('does not show Reject button when not coordinator', async () => {
    await renderProposalsRow({
      isCoordinator: false,
      proposal: { ...sampleProposal, state: 'SUBMITTED' },
    })
    expect(
      screen.queryByRole('button', { name: /^reject$/i })
    ).not.toBeInTheDocument()
  })

  it('does not show Reject button for DRAFT proposals even when coordinator', async () => {
    await renderProposalsRow({ isCoordinator: true })
    expect(
      screen.queryByRole('button', { name: /^reject$/i })
    ).not.toBeInTheDocument()
  })

  it('calls rejectProposal and onRejected when Reject is clicked', async () => {
    const user = userEvent.setup()
    const rejectedProposal = { ...sampleProposal, state: 'REJECTED' }
    const rejectProposal = mock(() => Promise.resolve(rejectedProposal))
    const onRejected = mock(() => {})
    await renderProposalsRow({
      isCoordinator: true,
      proposal: { ...sampleProposal, state: 'SUBMITTED' },
      rejectProposal,
      onRejected,
    })
    await user.click(screen.getByRole('button', { name: /^reject$/i }))
    await waitFor(() => {
      expect(rejectProposal).toHaveBeenCalledWith('p-1', 'user-1')
      expect(onRejected).toHaveBeenCalledWith(rejectedProposal)
    })
  })

  it('shows an error when rejectProposal fails', async () => {
    const user = userEvent.setup()
    await renderProposalsRow({
      isCoordinator: true,
      proposal: { ...sampleProposal, state: 'SUBMITTED' },
      rejectProposal: mock(() => Promise.reject(new Error('Cannot reject'))),
    })
    await user.click(screen.getByRole('button', { name: /^reject$/i }))
    await waitFor(() => {
      expect(screen.getByText('Cannot reject')).toBeInTheDocument()
    })
  })
})
