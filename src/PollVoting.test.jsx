import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, mock } from 'bun:test'
import PollVoting from './PollVoting'

const poll = {
  $id: 'poll-1',
  tripId: 'trip-1',
  proposalIds: ['p-1', 'p-2', 'p-3']
}
const proposals = [
  { $id: 'p-1', resortName: 'Chamonix' },
  { $id: 'p-2', resortName: 'Verbier' },
  { $id: 'p-3', resortName: 'Zermatt' }
]

function renderPollVoting (props = {}) {
  const defaults = {
    poll,
    proposals,
    myVote: null,
    userId: 'user-1',
    onVoteSaved: mock(() => {}),
    upsertVote: mock(() => Promise.resolve({ $id: 'v-new' }))
  }
  return render(<PollVoting {...defaults} {...props} />)
}

describe('PollVoting', () => {
  it('renders one token per proposal in the pile', () => {
    renderPollVoting()
    expect(screen.getAllByTestId('pile-token')).toHaveLength(3)
  })

  it('shows proposal names', () => {
    renderPollVoting()
    expect(screen.getByText('Chamonix')).toBeInTheDocument()
    expect(screen.getByText('Verbier')).toBeInTheDocument()
    expect(screen.getByText('Zermatt')).toBeInTheDocument()
  })

  it('shows total token count and remaining in the footer', () => {
    renderPollVoting()
    expect(screen.getByText(/3 tokens/i)).toBeInTheDocument()
    expect(screen.getByText(/0 placed/i)).toBeInTheDocument()
  })

  it('renders Save Vote button', () => {
    renderPollVoting()
    expect(
      screen.getByRole('button', { name: /save vote/i })
    ).toBeInTheDocument()
  })

  it('initializes from myVote: tokens appear in the correct proposal zones', () => {
    const myVote = { proposalIds: ['p-1', 'p-3'], tokenCounts: [2, 1] }
    renderPollVoting({ myVote })
    // All 3 tokens are placed — pile is empty
    expect(screen.queryAllByTestId('pile-token')).toHaveLength(0)
    expect(screen.getByText(/all tokens placed/i)).toBeInTheDocument()
    // Count badges
    expect(screen.getByTestId('count-p-1').textContent).toBe('2')
    expect(screen.getByTestId('count-p-2').textContent).toBe('0')
    expect(screen.getByTestId('count-p-3').textContent).toBe('1')
  })

  it('tap a pile token to select it — pile zone gets aria-selected', async () => {
    const user = userEvent.setup()
    renderPollVoting()
    await user.click(screen.getAllByTestId('pile-token')[0])
    expect(screen.getByTestId('pile-zone').getAttribute('aria-selected')).toBe(
      'true'
    )
  })

  it('tap a proposal after selecting from pile — token is placed', async () => {
    const user = userEvent.setup()
    renderPollVoting()
    await user.click(screen.getAllByTestId('pile-token')[0])
    await user.click(screen.getByTestId('zone-p-1'))
    expect(screen.getByTestId('count-p-1').textContent).toBe('1')
    expect(screen.getAllByTestId('pile-token')).toHaveLength(2)
  })

  it('tap the same proposal source again — deselects without moving token', async () => {
    const user = userEvent.setup()
    renderPollVoting()
    // First place a token so we can select from a proposal
    await user.click(screen.getAllByTestId('pile-token')[0])
    await user.click(screen.getByTestId('zone-p-1'))
    // Now select that token back
    await user.click(screen.getByTestId('zone-p-1'))
    expect(screen.getByTestId('pile-zone').getAttribute('aria-selected')).toBe(
      'false'
    )
    // Token is still on p-1
    expect(screen.getByTestId('count-p-1').textContent).toBe('1')
    // Click same zone again while it's selected = deselect
    await user.click(screen.getByTestId('zone-p-1'))
    expect(screen.getByTestId('count-p-1').textContent).toBe('1')
  })

  it('tap pile zone while a proposal token is selected — returns token to pile', async () => {
    const user = userEvent.setup()
    renderPollVoting()
    // Place a token
    await user.click(screen.getAllByTestId('pile-token')[0])
    await user.click(screen.getByTestId('zone-p-2'))
    expect(screen.getByTestId('count-p-2').textContent).toBe('1')
    // Select it back
    await user.click(screen.getByTestId('zone-p-2'))
    // Return to pile
    await user.click(screen.getByTestId('pile-zone'))
    expect(screen.getByTestId('count-p-2').textContent).toBe('0')
    expect(screen.getAllByTestId('pile-token')).toHaveLength(3)
  })

  it('move token directly from one proposal to another', async () => {
    const user = userEvent.setup()
    renderPollVoting()
    await user.click(screen.getAllByTestId('pile-token')[0])
    await user.click(screen.getByTestId('zone-p-1'))
    // Select from p-1
    await user.click(screen.getByTestId('zone-p-1'))
    // Place on p-2
    await user.click(screen.getByTestId('zone-p-2'))
    expect(screen.getByTestId('count-p-1').textContent).toBe('0')
    expect(screen.getByTestId('count-p-2').textContent).toBe('1')
  })

  it('calls upsertVote with non-zero allocations and calls onVoteSaved', async () => {
    const user = userEvent.setup()
    const savedVote = { $id: 'v-new', proposalIds: [], tokenCounts: [] }
    const upsertVote = mock(() => Promise.resolve(savedVote))
    const onVoteSaved = mock(() => {})
    renderPollVoting({ upsertVote, onVoteSaved })
    await user.click(screen.getByRole('button', { name: /save vote/i }))
    await waitFor(() => {
      expect(upsertVote).toHaveBeenCalledWith(
        'poll-1',
        'trip-1',
        'user-1',
        [],
        []
      )
      expect(onVoteSaved).toHaveBeenCalledWith(savedVote)
    })
  })

  it('shows "Vote saved" after successful save', async () => {
    const user = userEvent.setup()
    renderPollVoting()
    await user.click(screen.getByRole('button', { name: /save vote/i }))
    await waitFor(() => {
      expect(screen.getByText(/vote saved/i)).toBeInTheDocument()
    })
  })

  it('shows error message when upsertVote fails', async () => {
    const user = userEvent.setup()
    renderPollVoting({
      upsertVote: mock(() => Promise.reject(new Error('Vote failed')))
    })
    await user.click(screen.getByRole('button', { name: /save vote/i }))
    await waitFor(() => {
      expect(screen.getByText('Vote failed')).toBeInTheDocument()
    })
  })
})
