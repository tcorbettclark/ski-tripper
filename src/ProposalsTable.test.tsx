import { render, screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, mock } from 'bun:test'
import ProposalsTable from './ProposalsTable'

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

async function renderProposalsTable(props = {}) {
  const defaults = {
    proposals: [],
    userId: 'user-1',
    isCoordinator: false,
    onUpdated: mock(() => {}),
    onDeleted: mock(() => {}),
    onSubmitted: mock(() => {}),
    onRejected: mock(() => {}),
    updateProposal: mock(() => Promise.resolve()),
    deleteProposal: mock(() => Promise.resolve()),
    submitProposal: mock(() => Promise.resolve()),
    rejectProposal: mock(() => Promise.resolve()),
  }
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(<ProposalsTable {...defaults} {...props} />)
  })
  return result
}

describe('ProposalsTable', () => {
  it('shows the empty message when there are no proposals', async () => {
    await renderProposalsTable()
    expect(
      screen.getByText('No proposals yet. Create one above.')
    ).toBeInTheDocument()
  })

  it('shows a custom empty message when provided', async () => {
    await renderProposalsTable({ emptyMessage: 'Nothing here yet.' })
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
  })

  it('renders a row for each proposal', async () => {
    const proposals = [
      { ...sampleProposal, $id: 'p-1', resortName: "Val d'Isère" },
      { ...sampleProposal, $id: 'p-2', resortName: 'Chamonix' },
    ]
    await renderProposalsTable({ proposals })
    expect(screen.getByText("Val d'Isère")).toBeInTheDocument()
    expect(screen.getByText('Chamonix')).toBeInTheDocument()
  })

  it('renders the table headers', async () => {
    await renderProposalsTable({ proposals: [sampleProposal] })
    expect(screen.getByText('Resort Name')).toBeInTheDocument()
    expect(screen.getByText('Country')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('does not render a table when proposals is empty', async () => {
    await renderProposalsTable()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('clicking View on a row opens the viewer for that proposal', async () => {
    const user = userEvent.setup()
    const proposals = [
      { ...sampleProposal, $id: 'p-1', resortName: "Val d'Isère" },
      { ...sampleProposal, $id: 'p-2', resortName: 'Chamonix' },
    ]
    await renderProposalsTable({ proposals })
    const viewButtons = screen.getAllByRole('button', { name: /^view$/i })
    await act(async () => {
      await user.click(viewButtons[1])
    })
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Chamonix')).toBeInTheDocument()
    expect(within(dialog).getByText('2 of 2')).toBeInTheDocument()
  })

  it('passes isCoordinator to ProposalsRow — Reject button visible when true and proposal is SUBMITTED', async () => {
    const submittedProposal = {
      ...sampleProposal,
      $id: 'p-1',
      state: 'SUBMITTED',
    }
    await renderProposalsTable({
      proposals: [submittedProposal],
      isCoordinator: true,
    })
    expect(
      screen.getByRole('button', { name: /^reject$/i })
    ).toBeInTheDocument()
  })

  it('does not show Reject button when isCoordinator is false', async () => {
    const submittedProposal = {
      ...sampleProposal,
      $id: 'p-1',
      state: 'SUBMITTED',
    }
    await renderProposalsTable({
      proposals: [submittedProposal],
      isCoordinator: false,
    })
    expect(
      screen.queryByRole('button', { name: /^reject$/i })
    ).not.toBeInTheDocument()
  })

  it('closing the viewer hides it', async () => {
    const user = userEvent.setup()
    const proposals = [
      { ...sampleProposal, $id: 'p-1', resortName: "Val d'Isère" },
    ]
    await renderProposalsTable({ proposals })
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^view$/i }))
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /close/i }))
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
