import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Discussion, Proposal } from '../shared/types.d'
import ProposalCard from './ProposalCard'
import { getToasts } from './toast'

const mockUpdateProposal = mock(async () => ({}))
const mockDeleteProposal = mock(async () => {})
const mockSubmitProposal = mock(async () => ({}))
const mockRejectProposal = mock(async () => ({}))
const mockRevertProposalToDraft = mock(async () => ({}))
const mockListDiscussion = mock(async () => [])
const mockListAccommodations = mock(async () => [])

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    proposal: baseProposal,
    userId: 'user-1',
    onUpdated: () => {},
    onDeleted: () => {},
    onSubmitted: () => {},
    updateProposal: mockUpdateProposal,
    deleteProposal: mockDeleteProposal,
    submitProposal: mockSubmitProposal,
    rejectProposal: mockRejectProposal,
    revertProposalToDraft: mockRevertProposalToDraft,
    listDiscussion: mockListDiscussion,
    listAccommodations: mockListAccommodations,
    ...overrides,
  }
}

async function renderCard(props: Record<string, unknown> = {}) {
  await act(async () => {
    render(<ProposalCard {...defaultProps(props)} />)
  })
}

const baseProposal: Proposal = {
  id: 'proposal-1',
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-01T00:00:00Z',
  proposer: 'user-1',
  proposerUserName: 'John Doe',
  trip: 'trip-1',
  state: 'DRAFT',
  description: 'A test proposal description',
  resortName: 'Test Resort',
  startDate: '2024-01-01',
  endDate: '2024-01-07',
  nearestAirport: 'Test Airport',
  transferTime: 60,
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
  it('renders all proposal fields', async () => {
    await renderCard()

    expect(screen.getByText(/Test Resort/)).toBeDefined()
    expect(screen.getByText(/Being drafted by John Doe/)).toBeDefined()
  })

  it('displays new resort fields', async () => {
    await renderCard()

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

  it('displays altitude range from summitAltitude and baseAltitude', async () => {
    await renderCard()

    expect(screen.getByText('1500m – 3000m')).toBeDefined()
  })

  it('displays website link when websites is non-empty', async () => {
    await renderCard()

    const link = screen.getByText('example.com')
    expect(link).toBeDefined()
    expect(link.closest('a')!.getAttribute('href')).toBe('https://example.com/')
  })

  it('hides website link when websites is empty', async () => {
    const noWebsiteProposal = { ...baseProposal, websites: [] }
    await renderCard({ proposal: noWebsiteProposal })

    expect(screen.queryByText(/↗/)).toBeNull()
  })

  it('shows edit and submit buttons for owner + DRAFT', async () => {
    await renderCard()

    expect(screen.getByRole('button', { name: 'Edit proposal' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDefined()
  })

  it('hides edit/submit for non-owner', async () => {
    await renderCard({ userId: 'user-2' })

    expect(screen.queryByRole('button', { name: 'Edit proposal' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull()
  })

  it('shows reject button for coordinator + SUBMITTED', async () => {
    const submittedProposal = { ...baseProposal, state: 'SUBMITTED' as const }
    await renderCard({
      proposal: submittedProposal,
      userId: 'user-2',
      isCoordinator: true,
      onRejected: () => {},
    })

    expect(screen.getByRole('button', { name: 'Reject' })).toBeDefined()
  })

  it('shows delete confirmation dialog', async () => {
    const user = userEvent.setup()
    await renderCard()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete Proposal?')).toBeDefined()
  })

  it('shows revert-to-draft button for coordinator + REJECTED', async () => {
    const rejectedProposal = { ...baseProposal, state: 'REJECTED' as const }
    await renderCard({
      proposal: rejectedProposal,
      userId: 'user-2',
      isCoordinator: true,
      onRejected: () => {},
      onRevertedToDraft: () => {},
    })

    expect(
      screen.getByRole('button', { name: 'Move back to Draft' })
    ).toBeDefined()
  })

  it('does not show revert-to-draft button for non-coordinator + REJECTED', async () => {
    const rejectedProposal = { ...baseProposal, state: 'REJECTED' as const }
    await renderCard({
      proposal: rejectedProposal,
      userId: 'user-2',
      isCoordinator: false,
    })

    expect(
      screen.queryByRole('button', { name: 'Move back to Draft' })
    ).toBeNull()
  })

  it('displays flag image for supported countries', async () => {
    const franceProposal = { ...baseProposal, country: 'France' }
    await renderCard({ proposal: franceProposal })

    const flagImg = screen.getByRole('img', { name: 'France' })
    expect(flagImg).toBeDefined()
    expect(flagImg.getAttribute('src')).toBe('/flags/fr.png')
  })

  it('does not display flag for unsupported countries', async () => {
    const unknownProposal = { ...baseProposal, country: 'Unknown Land' }
    await renderCard({ proposal: unknownProposal })

    expect(screen.queryByRole('img', { name: 'Unknown Land' })).toBeNull()
  })

  it('displays flag in preview mode', async () => {
    const japanProposal = { ...baseProposal, country: 'Japan' }
    await renderCard({ proposal: japanProposal, previewMode: true })

    const flagImg = screen.getByRole('img', { name: 'Japan' })
    expect(flagImg).toBeDefined()
    expect(flagImg.getAttribute('src')).toBe('/flags/jp.png')
  })

  it('shows popup when submitting with no accommodations', async () => {
    const user = userEvent.setup()
    await renderCard()

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('No Accommodations')).toBeDefined()
    expect(
      screen.getByText(/At least one accommodation is required/)
    ).toBeDefined()
  })

  it('shows error when submitProposal rejects', async () => {
    const failingSubmit = mock(() => Promise.reject(new Error('Submit failed')))
    const onSubmitted = mock()
    const accommodations = [
      {
        id: 'acc-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        proposal: 'proposal-1',
        name: 'Hotel Test',
        url: '',
        cost: '',
        description: '',
      },
    ]
    const user = userEvent.setup()
    render(
      <ProposalCard
        {...defaultProps({
          onSubmitted,
          listAccommodations: mock(() => Promise.resolve(accommodations)),
          submitProposal: failingSubmit,
        })}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => {
      expect(
        getToasts().some(
          (t) => t.message === 'Submit failed' && t.type === 'error'
        )
      ).toBeTruthy()
    })
    expect(onSubmitted).not.toHaveBeenCalled()
  })

  it('shows error when rejectProposal rejects', async () => {
    const failingReject = mock(() => Promise.reject(new Error('Reject failed')))
    const onRejected = mock()
    const submittedProposal = { ...baseProposal, state: 'SUBMITTED' as const }
    const user = userEvent.setup()
    render(
      <ProposalCard
        {...defaultProps({
          proposal: submittedProposal,
          userId: 'user-2',
          isCoordinator: true,
          onRejected,
          rejectProposal: failingReject,
        })}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() => {
      expect(
        getToasts().some(
          (t) => t.message === 'Reject failed' && t.type === 'error'
        )
      ).toBeTruthy()
    })
    expect(onRejected).not.toHaveBeenCalled()
  })

  it('shows error when revertProposalToDraft rejects', async () => {
    const failingRevert = mock(() => Promise.reject(new Error('Revert failed')))
    const onRevertedToDraft = mock()
    const rejectedProposal = { ...baseProposal, state: 'REJECTED' as const }
    const user = userEvent.setup()
    render(
      <ProposalCard
        {...defaultProps({
          proposal: rejectedProposal,
          userId: 'user-2',
          isCoordinator: true,
          onRejected: () => {},
          onRevertedToDraft,
          revertProposalToDraft: failingRevert,
        })}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Move back to Draft' }))
    await waitFor(() => {
      expect(
        getToasts().some(
          (t) => t.message === 'Revert failed' && t.type === 'error'
        )
      ).toBeTruthy()
    })
    expect(onRevertedToDraft).not.toHaveBeenCalled()
  })

  it('shows error when deleteProposal rejects', async () => {
    const failingDelete = mock(() => Promise.reject(new Error('Delete failed')))
    const onDeleted = mock()
    const user = userEvent.setup()
    render(
      <ProposalCard
        {...defaultProps({
          onDeleted,
          deleteProposal: failingDelete,
        })}
      />
    )

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' })
    await user.click(confirmButtons[confirmButtons.length - 1])
    await screen.findByText('Delete failed')
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('shows discussion count on Notes button', async () => {
    const comments: Discussion[] = [
      {
        id: 'd-1',
        created: '2024-06-15T10:00:00Z',
        updated: '2024-06-15T10:00:00Z',
        proposal: 'proposal-1',
        author: 'user-2',
        authorUserName: 'Bob',
        body: 'Hello',
        type: 'comment',
      },
    ]
    const listDiscussion = mock(async () => [...comments])

    await renderCard({ userName: 'Alice', listDiscussion })

    await screen.findByRole('button', { name: /Notes/i })
    expect(screen.getByText('(1)')).toBeDefined()
  })

  it('renders accommodations inline without switching tabs', async () => {
    const accommodations = [
      {
        id: 'acc-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        proposal: 'proposal-1',
        name: 'Chalet Mont Blanc',
        url: 'https://example.com/chalet',
        cost: '€150/night',
        description: 'Nice chalet near the slopes',
      },
    ]

    render(
      <ProposalCard
        {...defaultProps({
          listAccommodations: mock(() => Promise.resolve(accommodations)),
        })}
      />
    )

    expect(await screen.findByText(/Chalet Mont Blanc/)).toBeDefined()
    expect(screen.getByText('€150/night')).toBeDefined()
  })

  it('shows add accommodation button for owner of DRAFT', async () => {
    await renderCard()

    expect(
      screen.getByRole('button', { name: '+ Add Accommodation' })
    ).toBeDefined()
  })

  it('hides add accommodation button for non-owner', async () => {
    await renderCard({ userId: 'user-2' })

    expect(
      screen.queryByRole('button', { name: '+ Add Accommodation' })
    ).toBeNull()
  })

  it('hides add accommodation button for SUBMITTED proposal', async () => {
    const submittedProposal = { ...baseProposal, state: 'SUBMITTED' as const }
    await renderCard({ proposal: submittedProposal })

    expect(
      screen.queryByRole('button', { name: '+ Add Accommodation' })
    ).toBeNull()
  })

  it('shows edit button on accommodations for owner of DRAFT', async () => {
    const accommodations = [
      {
        id: 'acc-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        proposal: 'proposal-1',
        name: 'Hotel Test',
        url: '',
        cost: '€100',
        description: '',
      },
    ]

    render(
      <ProposalCard
        {...defaultProps({
          listAccommodations: mock(() => Promise.resolve(accommodations)),
        })}
      />
    )

    const accommodationEditButtons = await screen.findAllByRole('button', {
      name: /Edit accommodation/,
    })
    expect(accommodationEditButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('hides accommodation edit/delete buttons for non-owner', async () => {
    const accommodations = [
      {
        id: 'acc-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        proposal: 'proposal-1',
        name: 'Hotel Test',
        url: '',
        cost: '€100',
        description: '',
      },
    ]

    render(
      <ProposalCard
        {...defaultProps({
          userId: 'user-2',
          listAccommodations: mock(() => Promise.resolve(accommodations)),
        })}
      />
    )

    await screen.findByText(/Hotel Test/)
    expect(
      screen.queryByRole('button', { name: /Edit accommodation/ })
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('creates accommodation inline', async () => {
    const createAccommodation = mock(() => Promise.resolve({ id: 'acc-new' }))
    const listAccommodations = mock(() => Promise.resolve([]))
    const user = userEvent.setup()

    render(
      <ProposalCard
        {...defaultProps({
          createAccommodation,
          listAccommodations,
        })}
      />
    )

    await user.click(
      screen.getByRole('button', { name: '+ Add Accommodation' })
    )

    expect(screen.getByLabelText('Name')).toBeDefined()

    await user.type(screen.getByLabelText('Name'), 'New Hotel')
    await user.type(screen.getByLabelText('URL'), 'https://example.com')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(createAccommodation).toHaveBeenCalledWith(
      'proposal-1',
      'user-1',
      expect.objectContaining({ name: 'New Hotel' })
    )
    expect(listAccommodations).toHaveBeenCalledWith('proposal-1')
  })

  it('prepends https:// to accommodation URL when scheme is missing', async () => {
    const createAccommodation = mock(() => Promise.resolve({ id: 'acc-new' }))
    const listAccommodations = mock(() => Promise.resolve([]))
    const user = userEvent.setup()

    render(
      <ProposalCard
        {...defaultProps({
          createAccommodation,
          listAccommodations,
        })}
      />
    )

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
    const createAccommodation = mock(() => Promise.resolve({ id: 'acc-new' }))
    const listAccommodations = mock(() => Promise.resolve([]))
    const user = userEvent.setup()

    render(
      <ProposalCard
        {...defaultProps({
          createAccommodation,
          listAccommodations,
        })}
      />
    )

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
    const createAccommodation = mock(() => Promise.resolve({ id: 'acc-new' }))
    const listAccommodations = mock(() => Promise.resolve([]))
    const user = userEvent.setup()

    render(
      <ProposalCard
        {...defaultProps({
          createAccommodation,
          listAccommodations,
        })}
      />
    )

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
        id: 'acc-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        proposal: 'proposal-1',
        name: 'Hotel',
        url: 'https://example.com',
        cost: '',
        description: '',
      },
    ]

    await act(async () => {
      render(
        <ProposalCard
          {...defaultProps({
            listAccommodations: mock(() => Promise.resolve(accommodations)),
            deleteAccommodation,
          })}
        />
      )
    })

    const user = userEvent.setup()

    await user.click(
      screen.getByRole('button', { name: 'Delete accommodation Hotel' })
    )

    const dialog = screen.getByRole('dialog', { name: 'Delete Accommodation?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await screen.findByText('delete failed')
  })

  it('shows proposal details and accommodations inline by default', async () => {
    await renderCard()

    expect(screen.getByText('600 km')).toBeDefined()
    expect(screen.getByText('Accommodations')).toBeDefined()
  })

  it('opens Notes modal when clicking the Notes button', async () => {
    const listDiscussion = mock(async () => [])

    await renderCard({ userName: 'Alice', listDiscussion })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Notes/i }))

    expect(screen.getByPlaceholderText('Write a comment…')).toBeDefined()
  })

  it('closes Notes modal when clicking the close button', async () => {
    const listDiscussion = mock(async () => [])

    await renderCard({ userName: 'Alice', listDiscussion })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Notes/i }))
    expect(screen.getByPlaceholderText('Write a comment…')).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Close notes' }))
    expect(screen.queryByPlaceholderText('Write a comment…')).toBeNull()
  })
})
