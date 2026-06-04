import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, within } from '@testing-library/react'
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
  summitAltitude: 3000,
  baseAltitude: 1500,
  pisteKm: 600,
  beginnerPct: 33,
  intermediatePct: 50,
  advancedPct: 17,
  liftCount: 50,
  snowReliability: 'high',
  skiSeasonMonths: 'Dec-Apr',
  websites: ['https://example.com'],
  latitude: '45.9163',
  longitude: '7.7554',
  linkedResortsDescription: '',
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

    expect(screen.getByText(/Test Resort/)).toBeDefined()
    expect(screen.getByText(/being drafted by John Doe/)).toBeDefined()
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

    expect(screen.getByText(/Alps/)).toBeDefined()
    expect(screen.getByText('600 km')).toBeDefined()
    expect(screen.getByText('Piste Breakdown')).toBeDefined()
    expect(screen.getByText('50')).toBeDefined()
    expect(screen.getByText('High')).toBeDefined()
    expect(screen.getByText('Dec-Apr')).toBeDefined()
    expect(
      screen.getByRole('link', { name: 'Open in Google Maps' })
    ).toBeDefined()
  })

  it('displays altitude range from summitAltitude and baseAltitude', () => {
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

  it('displays website link when websites is non-empty', () => {
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

  it('hides website link when websites is empty', () => {
    const noWebsiteProposal = { ...baseProposal, websites: [] }
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

    expect(screen.getByRole('button', { name: 'Edit proposal' })).toBeDefined()
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

    expect(screen.queryByRole('button', { name: 'Edit proposal' })).toBeNull()
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
    expect(flagImg.getAttribute('src')).toBe('/flags/fr.png')
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
    expect(flagImg.getAttribute('src')).toBe('/flags/jp.png')
  })

  it('shows popup when submitting with no accommodations', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('No Accommodations')).toBeDefined()
    expect(
      screen.getByText(/At least one accommodation is required/)
    ).toBeDefined()
  })

  it('shows error when submitProposal rejects', async () => {
    const failingSubmit = mock(() => Promise.reject(new Error('Submit failed')))
    const onSubmitted = mock()
    const user = userEvent.setup()
    const accommodations = [
      {
        $id: 'acc-1',
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
        proposalId: 'proposal-1',
        name: 'Hotel Test',
        url: '',
        cost: '',
        description: '',
      },
    ]
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={onSubmitted}
        accommodations={accommodations}
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

  it('shows discussion count in tab', async () => {
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
    expect(screen.getByText(/\(1\)/)).toBeDefined()
  })

  it('renders accommodations in tab', async () => {
    const user = userEvent.setup()
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

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))

    expect(screen.getByText(/Chalet Mont Blanc/)).toBeDefined()
    expect(screen.getByText('€150/night')).toBeDefined()
  })

  it('shows add accommodation button for owner of DRAFT', async () => {
    const user = userEvent.setup()
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
      />
    )

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))

    expect(
      screen.getByRole('button', { name: '+ Add Accommodation' })
    ).toBeDefined()
  })

  it('hides add accommodation button for non-owner', async () => {
    const user = userEvent.setup()
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-2"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
      />
    )

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))

    expect(
      screen.queryByRole('button', { name: '+ Add Accommodation' })
    ).toBeNull()
  })

  it('hides add accommodation button for SUBMITTED proposal', async () => {
    const user = userEvent.setup()
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

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))

    expect(
      screen.queryByRole('button', { name: '+ Add Accommodation' })
    ).toBeNull()
  })

  it('switches to accommodations tab and shows count', async () => {
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

    expect(screen.getByText(/\(1\)/)).toBeDefined()

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))

    expect(await screen.findByText('€100/night')).toBeDefined()
  })

  it('shows edit button on accommodations for owner of DRAFT', async () => {
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
    const user = userEvent.setup()

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

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))

    const accommodationEditButtons = screen.getAllByRole('button', {
      name: /Edit accommodation/,
    })
    expect(accommodationEditButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('hides accommodation edit/delete buttons for non-owner', async () => {
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
    const user = userEvent.setup()

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

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))

    expect(
      screen.queryByRole('button', { name: /Edit accommodation/ })
    ).toBeNull()
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

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))
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

  it('prepends https:// to accommodation URL when scheme is missing', async () => {
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

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))
    await user.click(
      screen.getByRole('button', { name: '+ Add Accommodation' })
    )

    await user.type(screen.getByLabelText('Name'), 'New Hotel')
    await user.type(screen.getByLabelText('URL'), 'example.com/hotel')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(createAccommodation).toHaveBeenCalledWith(
      'proposal-1',
      'user-1',
      expect.objectContaining({ url: 'https://example.com/hotel' })
    )
  })

  it('does not modify accommodation URL that already has https://', async () => {
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

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))
    await user.click(
      screen.getByRole('button', { name: '+ Add Accommodation' })
    )

    await user.type(screen.getByLabelText('Name'), 'New Hotel')
    await user.type(screen.getByLabelText('URL'), 'https://example.com/hotel')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(createAccommodation).toHaveBeenCalledWith(
      'proposal-1',
      'user-1',
      expect.objectContaining({ url: 'https://example.com/hotel' })
    )
  })

  it('does not modify accommodation URL that already has http://', async () => {
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

    await user.click(screen.getByRole('button', { name: /Accommodations/ }))
    await user.click(
      screen.getByRole('button', { name: '+ Add Accommodation' })
    )

    await user.type(screen.getByLabelText('Name'), 'New Hotel')
    await user.type(screen.getByLabelText('URL'), 'http://example.com/hotel')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(createAccommodation).toHaveBeenCalledWith(
      'proposal-1',
      'user-1',
      expect.objectContaining({ url: 'http://example.com/hotel' })
    )
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
    await user.click(screen.getByRole('button', { name: /Accommodations/ }))

    await user.click(
      screen.getByRole('button', { name: 'Delete accommodation Hotel' })
    )

    const dialog = screen.getByRole('dialog', { name: 'Delete Accommodation?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await screen.findByText('delete failed')
  })

  it('defaults to proposal tab showing proposal details', () => {
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

    expect(screen.getByText('600 km')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Proposal' })).toBeDefined()
  })

  it('switches to discussion tab and shows discussion section', async () => {
    const listDiscussion = mock(async () => [])
    const user = userEvent.setup()

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

    await user.click(screen.getByRole('button', { name: /Discussion/ }))

    expect(screen.getByPlaceholderText('Write a comment…')).toBeDefined()
  })
})
