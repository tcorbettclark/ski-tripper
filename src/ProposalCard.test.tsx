import { describe, expect, it, mock } from 'bun:test'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProposalCard from './ProposalCard'
import type { Proposal } from './types.d.ts'

const mockUpdateProposal = mock(async () => ({}))
const mockDeleteProposal = mock(async () => {})
const mockSubmitProposal = mock(async () => ({}))
const mockRejectProposal = mock(async () => ({}))
const mockResubmitProposal = mock(async () => ({}))

const baseProposal: Proposal = {
  $id: 'proposal-1',
  $createdAt: '2024-01-01T00:00:00Z',
  $updatedAt: '2024-01-01T00:00:00Z',
  proposerUserId: 'user-1',
  proposerUserName: 'John Doe',
  tripId: 'trip-1',
  state: 'DRAFT',
  title: 'Test Proposal',
  description: 'A test proposal description',
  resortName: 'Test Resort',
  startDate: '2024-01-01',
  endDate: '2024-01-07',
  nearestAirport: 'TEST',
  transferTime: '1 hour',
  altitudeRange: '1000-2000m',
  country: 'Test Country',
}

describe('ProposalCard', () => {
  it('renders all proposal fields', () => {
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    expect(screen.getByText('Test Resort')).toBeDefined()
    expect(screen.getByText('Test Country')).toBeDefined()
    expect(screen.getByText('DRAFT')).toBeDefined()
    expect(screen.getByText('John Doe')).toBeDefined()
  })

  it('shows edit and submit buttons for owner + DRAFT', () => {
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDefined()
  })

  it('hides edit/submit for non-owner', () => {
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-2"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull()
  })

  it('shows reject button for coordinator + SUBMITTED', () => {
    const submittedProposal = { ...baseProposal, state: 'SUBMITTED' as const }
    render(
      <ProposalCard
        proposal={submittedProposal}
        userId="user-2"
        isCoordinator={true}
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        onRejected={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    expect(screen.getByRole('button', { name: 'Reject' })).toBeDefined()
  })

  it('shows delete confirmation dialog', async () => {
    const user = userEvent.setup()
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete Proposal?')).toBeDefined()
  })

  // Regression for issue #40: handleDelete used to swallow errors silently,
  // so a failed deleteProposal call left the user with no feedback. Mirror
  // the handleSubmit/handleReject pattern: surface the error in-place.
  it('surfaces deleteProposal failures next to the confirm dialog', async () => {
    const user = userEvent.setup()
    const failingDelete = mock(async () => {
      throw new Error('network is down')
    })
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={failingDelete}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    // Two "Delete" buttons exist after the dialog opens (the original on
    // the card, plus the confirm button). The dialog version is inside the
    // confirm UI, which also contains the cancel button.
    const confirmButton = screen
      .getAllByRole('button', { name: 'Delete' })
      .at(-1) as HTMLButtonElement
    await user.click(confirmButton)

    expect(failingDelete).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('network is down')).toBeDefined()
  })

  it('shows resubmit button for coordinator + REJECTED', () => {
    const rejectedProposal = { ...baseProposal, state: 'REJECTED' as const }
    render(
      <ProposalCard
        proposal={rejectedProposal}
        userId="user-2"
        isCoordinator={true}
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        onRejected={() => {}}
        onResubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
        resubmitProposal={mockResubmitProposal}
      />
    )

    expect(
      screen.getByRole('button', { name: 'Move back to Submitted' })
    ).toBeDefined()
  })

  it('does not show resubmit button for non-coordinator + REJECTED', () => {
    const rejectedProposal = { ...baseProposal, state: 'REJECTED' as const }
    render(
      <ProposalCard
        proposal={rejectedProposal}
        userId="user-2"
        isCoordinator={false}
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
        resubmitProposal={mockResubmitProposal}
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Move back to Submitted' })
    ).toBeNull()
  })

  it('displays flag image for supported countries', () => {
    const franceProposal = { ...baseProposal, country: 'France' }
    render(
      <ProposalCard
        proposal={franceProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    const flagImg = screen.getByRole('img', { name: 'France' })
    expect(flagImg).toBeDefined()
    expect(flagImg.getAttribute('src')).toBe('https://flagcdn.com/w20/fr.png')
  })

  it('does not display flag for unsupported countries', () => {
    const unknownProposal = { ...baseProposal, country: 'Unknown Land' }
    render(
      <ProposalCard
        proposal={unknownProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    expect(screen.queryByRole('img', { name: 'Unknown Land' })).toBeNull()
  })

  it('displays flag in preview mode', () => {
    const japanProposal = { ...baseProposal, country: 'Japan' }
    render(
      <ProposalCard
        proposal={japanProposal}
        userId="user-1"
        previewMode={true}
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    const flagImg = screen.getByRole('img', { name: 'Japan' })
    expect(flagImg).toBeDefined()
    expect(flagImg.getAttribute('src')).toBe('https://flagcdn.com/w20/jp.png')
  })
})
