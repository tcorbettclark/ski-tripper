import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, mock } from 'bun:test'
import PollVoting from './PollVoting'

const poll = {
  $id: 'poll-1',
  tripId: 'trip-1',
  proposalIds: ['p-1', 'p-2', 'p-3'],
}
const proposals = [
  { $id: 'p-1', resortName: 'Chamonix' },
  { $id: 'p-2', resortName: 'Verbier' },
  { $id: 'p-3', resortName: 'Zermatt' },
]

function renderPollVoting(props = {}) {
  const defaults = {
    poll,
    proposals,
    myVote: null,
    userId: 'user-1',
    onVoteSaved: mock(() => {}),
    upsertVote: mock(() => Promise.resolve({ $id: 'v-new' })),
  }
  return render(<PollVoting {...defaults} {...props} />)
}

describe('PollVoting', () => {
  it('renders proposal names', () => {
    renderPollVoting()
    expect(screen.getByText('Chamonix')).toBeInTheDocument()
    expect(screen.getByText('Verbier')).toBeInTheDocument()
    expect(screen.getByText('Zermatt')).toBeInTheDocument()
  })

  it('initialises all counts to 0 with no myVote', () => {
    renderPollVoting()
    expect(screen.getByTestId('count-p-1').textContent).toBe('0')
    expect(screen.getByTestId('count-p-2').textContent).toBe('0')
    expect(screen.getByTestId('count-p-3').textContent).toBe('0')
  })

  it('initialises from myVote', () => {
    const myVote = { proposalIds: ['p-1', 'p-3'], tokenCounts: [2, 1] }
    renderPollVoting({ myVote })
    expect(screen.getByTestId('count-p-1').textContent).toBe('2')
    expect(screen.getByTestId('count-p-2').textContent).toBe('0')
    expect(screen.getByTestId('count-p-3').textContent).toBe('1')
  })

  it('+ increments count', async () => {
    const user = userEvent.setup()
    renderPollVoting()
    await user.click(
      screen.getByRole('button', { name: /add vote to Chamonix/i })
    )
    expect(screen.getByTestId('count-p-1').textContent).toBe('1')
  })

  it('− decrements count', async () => {
    const user = userEvent.setup()
    const myVote = { proposalIds: ['p-1'], tokenCounts: [1] }
    renderPollVoting({ myVote })
    await user.click(
      screen.getByRole('button', { name: /remove vote from Chamonix/i })
    )
    expect(screen.getByTestId('count-p-1').textContent).toBe('0')
  })

  it('+ disabled when no tokens remaining', async () => {
    const user = userEvent.setup()
    renderPollVoting()
    await user.click(
      screen.getByRole('button', { name: /add vote to Chamonix/i })
    )
    await user.click(
      screen.getByRole('button', { name: /add vote to Verbier/i })
    )
    await user.click(
      screen.getByRole('button', { name: /add vote to Zermatt/i })
    )
    expect(
      screen.getByRole('button', { name: /add vote to Chamonix/i })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /add vote to Verbier/i })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /add vote to Zermatt/i })
    ).toBeDisabled()
  })

  it('− disabled when count is zero', () => {
    renderPollVoting()
    expect(
      screen.getByRole('button', { name: /remove vote from Chamonix/i })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /remove vote from Verbier/i })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /remove vote from Zermatt/i })
    ).toBeDisabled()
  })

  it('save calls upsertVote with correct args and calls onVoteSaved', async () => {
    const user = userEvent.setup()
    const savedVote = { $id: 'v-new' }
    const upsertVote = mock(() => Promise.resolve(savedVote))
    const onVoteSaved = mock(() => {})
    renderPollVoting({ upsertVote, onVoteSaved })
    await user.click(
      screen.getByRole('button', { name: /add vote to Chamonix/i })
    )
    await user.click(
      screen.getByRole('button', { name: /add vote to Chamonix/i })
    )
    await user.click(
      screen.getByRole('button', { name: /add vote to Verbier/i })
    )
    await user.click(screen.getByRole('button', { name: /save vote/i }))
    await waitFor(() => {
      expect(upsertVote).toHaveBeenCalledWith(
        'poll-1',
        'trip-1',
        'user-1',
        ['p-1', 'p-2'],
        [2, 1]
      )
      expect(onVoteSaved).toHaveBeenCalledWith(savedVote)
    })
  })

  it('shows error on failure', async () => {
    const user = userEvent.setup()
    renderPollVoting({
      upsertVote: mock(() => Promise.reject(new Error('Vote failed'))),
    })
    await user.click(screen.getByRole('button', { name: /save vote/i }))
    await waitFor(() => {
      expect(screen.getByText('Vote failed')).toBeInTheDocument()
    })
  })

  it('Save button disabled when current allocation matches saved vote', () => {
    const myVote = { proposalIds: ['p-1', 'p-2'], tokenCounts: [2, 1] }
    renderPollVoting({ myVote })
    expect(screen.getByRole('button', { name: /save vote/i })).toBeDisabled()
  })

  it('Save button enabled when current allocation differs from saved vote', async () => {
    const user = userEvent.setup()
    const myVote = { proposalIds: ['p-1'], tokenCounts: [1] }
    renderPollVoting({ myVote })
    await user.click(
      screen.getByRole('button', { name: /add vote to Verbier/i })
    )
    expect(
      screen.getByRole('button', { name: /save vote/i })
    ).not.toBeDisabled()
  })

  it('displays proposals in alphabetical order regardless of proposalIds order', () => {
    const pollOutOfOrder = {
      $id: 'poll-1',
      tripId: 'trip-1',
      proposalIds: ['p-3', 'p-1', 'p-2'],
    }
    const proposalsOutOfOrder = [
      { $id: 'p-1', resortName: 'Chamonix' },
      { $id: 'p-2', resortName: 'Verbier' },
      { $id: 'p-3', resortName: 'Zermatt' },
    ]
    renderPollVoting({ poll: pollOutOfOrder, proposals: proposalsOutOfOrder })
    const resortNames = screen.getAllByText(/Chamonix|Verbier|Zermatt/)
    expect(resortNames[0].textContent).toBe('Chamonix')
    expect(resortNames[1].textContent).toBe('Verbier')
    expect(resortNames[2].textContent).toBe('Zermatt')
  })

  it('Save button disabled after incrementing then decrementing back to saved value', async () => {
    const user = userEvent.setup()
    const myVote = { proposalIds: ['p-1'], tokenCounts: [1] }
    renderPollVoting({ myVote })
    await user.click(
      screen.getByRole('button', { name: /add vote to Chamonix/i })
    )
    expect(
      screen.getByRole('button', { name: /save vote/i })
    ).not.toBeDisabled()
    await user.click(
      screen.getByRole('button', { name: /remove vote from Chamonix/i })
    )
    expect(screen.getByRole('button', { name: /save vote/i })).toBeDisabled()
  })
})
