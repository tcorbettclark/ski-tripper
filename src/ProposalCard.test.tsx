import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProposalCard from './ProposalCard'
import type { Discussion, Proposal } from './types.d.ts'

const mockUpdateProposal = mock(async () => ({}))
const mockDeleteProposal = mock(async () => {})
const mockSubmitProposal = mock(async () => ({}))
const mockRejectProposal = mock(async () => ({}))
const mockRevertProposalToDraft = mock(async () => ({}))

const baseProposal: Proposal = {
  $id: 'proposal-1',
  $createdAt: '2024-01-01T00:00:00Z',
  $updatedAt: '2024-01-01T00:00:00Z',
  proposerUserId: 'user-1',
  proposerUserName: 'John Doe',
  tripId: 'trip-1',
  state: 'DRAFT',
  description: 'A test proposal description',
  resortName: 'Test Resort',
  startDate: '2024-01-01',
  endDate: '2024-01-07',
  nearestAirport: 'TEST',
  transferTime: '1 hour',
  country: 'Test Country',
  region: 'Alps',
  topAltitude: 3000,
  bottomAltitude: 1500,
  pisteKm: 600,
  difficulty: 'intermediate',
  liftCount: 50,
  snowReliability: 'high',
  skiSeasonMonths: 'Dec-Apr',
  websiteUrl: 'https://example.com',
  latitude: '45.9163',
  longitude: '7.7554',
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

  it('displays new resort fields', () => {
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

    expect(screen.getByText('Alps')).toBeDefined()
    expect(screen.getByText('600 km')).toBeDefined()
    expect(screen.getByText('Intermediate')).toBeDefined()
    expect(screen.getByText('50')).toBeDefined()
    expect(screen.getByText('High')).toBeDefined()
    expect(screen.getByText('Dec-Apr')).toBeDefined()
    expect(
      screen.getByText((content) => content.includes('45.9163'))
    ).toBeDefined()
    expect(
      screen.getByText((content) => content.includes('7.7554'))
    ).toBeDefined()
  })

  it('displays altitude range from topAltitude and bottomAltitude', () => {
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

    expect(screen.getByText('1500m – 3000m')).toBeDefined()
  })

  it('displays website link when websiteUrl is valid', () => {
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

    const link = screen.getByText('example.com')
    expect(link).toBeDefined()
    expect(link.closest('a')!.getAttribute('href')).toBe('https://example.com/')
  })

  it('hides website link when websiteUrl is empty', () => {
    const noWebsiteProposal = { ...baseProposal, websiteUrl: '' }
    render(
      <ProposalCard
        proposal={noWebsiteProposal}
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

    expect(screen.queryByText(/↗/)).toBeNull()
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

  it('shows revert-to-draft button for coordinator + REJECTED', () => {
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
        onRevertedToDraft={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
        revertProposalToDraft={mockRevertProposalToDraft}
      />
    )

    expect(
      screen.getByRole('button', { name: 'Move back to Draft' })
    ).toBeDefined()
  })

  it('does not show revert-to-draft button for non-coordinator + REJECTED', () => {
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
        revertProposalToDraft={mockRevertProposalToDraft}
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Move back to Draft' })
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

  it('shows error when submitProposal rejects', async () => {
    const failingSubmit = mock(() => Promise.reject(new Error('Submit failed')))
    const onSubmitted = mock()
    const user = userEvent.setup()
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={onSubmitted}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={failingSubmit}
        rejectProposal={mockRejectProposal}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await screen.findByText('Submit failed')
    expect(onSubmitted).not.toHaveBeenCalled()
  })

  it('shows error when rejectProposal rejects', async () => {
    const failingReject = mock(() => Promise.reject(new Error('Reject failed')))
    const onRejected = mock()
    const submittedProposal = { ...baseProposal, state: 'SUBMITTED' as const }
    const user = userEvent.setup()
    render(
      <ProposalCard
        proposal={submittedProposal}
        userId="user-2"
        isCoordinator={true}
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        onRejected={onRejected}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={failingReject}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await screen.findByText('Reject failed')
    expect(onRejected).not.toHaveBeenCalled()
  })

  it('shows error when revertProposalToDraft rejects', async () => {
    const failingRevert = mock(() => Promise.reject(new Error('Revert failed')))
    const onRevertedToDraft = mock()
    const rejectedProposal = { ...baseProposal, state: 'REJECTED' as const }
    const user = userEvent.setup()
    render(
      <ProposalCard
        proposal={rejectedProposal}
        userId="user-2"
        isCoordinator={true}
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        onRejected={() => {}}
        onRevertedToDraft={onRevertedToDraft}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
        revertProposalToDraft={failingRevert}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Move back to Draft' }))
    await screen.findByText('Revert failed')
    expect(onRevertedToDraft).not.toHaveBeenCalled()
  })

  it('shows error when deleteProposal rejects', async () => {
    const failingDelete = mock(() => Promise.reject(new Error('Delete failed')))
    const onDeleted = mock()
    const user = userEvent.setup()
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={onDeleted}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={failingDelete}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' })
    await user.click(confirmButtons[confirmButtons.length - 1])
    await screen.findByText('Delete failed')
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('refreshes discussion count badge after closing discussion dialog', async () => {
    const comments: Discussion[] = [
      {
        $id: 'd-1',
        $createdAt: '2024-06-15T10:00:00Z',
        $updatedAt: '2024-06-15T10:00:00Z',
        proposalId: 'proposal-1',
        authorUserId: 'user-2',
        authorUserName: 'Bob',
        body: 'Hello',
        type: 'comment',
      },
    ]
    const listDiscussion = mock(async () => [...comments])

    const user = userEvent.setup()
    await act(async () => {
      render(
        <ProposalCard
          proposal={baseProposal}
          userId="user-1"
          userName="Alice"
          onUpdated={() => {}}
          onDeleted={() => {}}
          onSubmitted={() => {}}
          updateProposal={mockUpdateProposal}
          deleteProposal={mockDeleteProposal}
          submitProposal={mockSubmitProposal}
          rejectProposal={mockRejectProposal}
          listDiscussion={listDiscussion}
        />
      )
    })

    await screen.findByRole('button', { name: /Discussion/i })
    expect(listDiscussion).toHaveBeenCalledTimes(1)
    expect(screen.getByText('1')).toBeDefined()

    await user.click(screen.getByRole('button', { name: /Discussion/i }))
    await screen.findByText('Hello')

    comments.push({
      $id: 'd-new',
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      proposalId: 'proposal-1',
      authorUserId: 'user-1',
      authorUserName: 'Alice',
      body: 'New comment',
      type: 'comment',
    })

    await user.click(screen.getByText('✕').closest('button')!)

    await screen.findByText('2')
  })

  it('renders accommodations in collapsible section', () => {
    const accommodations = [
      {
        $id: 'acc-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposalId: 'proposal-1',
        name: 'Chalet Mont Blanc',
        url: 'https://example.com/chalet',
        cost: '€150/night',
        description: 'Nice chalet near the slopes',
      },
    ]

    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        accommodations={accommodations}
      />
    )

    expect(screen.getByText('Accommodations')).toBeDefined()
    expect(screen.getByText(/Chalet Mont Blanc/)).toBeDefined()
    expect(screen.getByText('€150/night')).toBeDefined()
  })

  it('shows add accommodation button for owner of DRAFT', () => {
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
      />
    )

    expect(
      screen.getByRole('button', { name: '+ Add Accommodation' })
    ).toBeDefined()
  })

  it('hides add accommodation button for non-owner', () => {
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-2"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
      />
    )

    expect(
      screen.queryByRole('button', { name: '+ Add Accommodation' })
    ).toBeNull()
  })

  it('hides add accommodation button for SUBMITTED proposal', () => {
    const submittedProposal = { ...baseProposal, state: 'SUBMITTED' as const }
    render(
      <ProposalCard
        proposal={submittedProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
      />
    )

    expect(
      screen.queryByRole('button', { name: '+ Add Accommodation' })
    ).toBeNull()
  })

  it('toggles accommodation section collapse', async () => {
    const user = userEvent.setup()
    const accommodations = [
      {
        $id: 'acc-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposalId: 'proposal-1',
        name: 'Chalet Mont Blanc',
        url: '',
        cost: '€100/night',
        description: 'A hotel',
      },
    ]

    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        accommodations={accommodations}
      />
    )

    expect(screen.getByText('€100/night')).toBeDefined()

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))

    expect(screen.queryByText('€100/night')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))

    expect(screen.getByText('€100/night')).toBeDefined()
  })

  it('shows edit button on accommodations for owner of DRAFT', () => {
    const accommodations = [
      {
        $id: 'acc-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposalId: 'proposal-1',
        name: 'Hotel Test',
        url: '',
        cost: '€100',
        description: '',
      },
    ]

    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        accommodations={accommodations}
      />
    )

    const accommodationEditButtons = screen.getAllByRole('button', {
      name: 'Edit',
    })
    expect(accommodationEditButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('hides accommodation edit/delete buttons for non-owner', () => {
    const accommodations = [
      {
        $id: 'acc-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposalId: 'proposal-1',
        name: 'Hotel Test',
        url: '',
        cost: '€100',
        description: '',
      },
    ]

    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-2"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        accommodations={accommodations}
      />
    )

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('creates accommodation inline', async () => {
    const createAccommodation = mock(() => Promise.resolve({ $id: 'acc-new' }))
    const onAccommodationsChanged = mock()
    const listAccommodations = mock(() => Promise.resolve([]))
    const user = userEvent.setup()

    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        createAccommodation={createAccommodation}
        onAccommodationsChanged={onAccommodationsChanged}
        listAccommodations={listAccommodations}
      />
    )

    await user.click(
      screen.getByRole('button', { name: '+ Add Accommodation' })
    )

    expect(screen.getByLabelText('Name')).toBeDefined()

    await user.type(screen.getByLabelText('Name'), 'New Hotel')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(createAccommodation).toHaveBeenCalledWith(
      'proposal-1',
      'user-1',
      expect.objectContaining({ name: 'New Hotel' })
    )
    expect(onAccommodationsChanged).toHaveBeenCalledWith('proposal-1')
  })

  it('displays accommodation delete error', async () => {
    const deleteAccommodation = mock(() =>
      Promise.reject(new Error('delete failed'))
    )
    const accommodations = [
      {
        $id: 'acc-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposalId: 'proposal-1',
        name: 'Hotel',
        url: '',
        cost: '',
        description: '',
      },
    ]

    await act(async () => {
      render(
        <ProposalCard
          proposal={baseProposal}
          userId="user-1"
          onUpdated={() => {}}
          onDeleted={() => {}}
          onSubmitted={() => {}}
          accommodations={accommodations}
          deleteAccommodation={deleteAccommodation}
        />
      )
    })

    const user = userEvent.setup()
    const accommodationEditButton = screen.getAllByRole('button', {
      name: 'Edit',
    })[0]

    await user.click(accommodationEditButton)

    const accommodationDeleteButton = screen.getAllByRole('button', {
      name: 'Delete',
    })[0]

    await user.click(accommodationDeleteButton)

    await screen.findByText('delete failed')
  })
})
