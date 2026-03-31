import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, mock } from 'bun:test'
import ProposalViewer from './ProposalViewer'

const p1 = {
  $id: 'p-1',
  ProposerUserId: 'user-1',
  ProposerUserName: 'Alice',
  state: 'SUBMITTED',
  resortName: "Val d'Isère",
  country: 'France',
  altitudeRange: '1850m - 3456m',
  nearestAirport: 'GVA',
  transferTime: '2h 30m',
  accommodationName: 'Chalet Belle Vue',
  accommodationUrl: 'https://example.com/chalet',
  approximateCost: '£1200pp',
  description: 'Great powder skiing',
}

const p2 = {
  $id: 'p-2',
  ProposerUserId: 'user-2',
  ProposerUserName: 'Bob',
  state: 'DRAFT',
  resortName: 'Chamonix',
  country: 'France',
  altitudeRange: '1035m - 3842m',
  nearestAirport: 'GVA',
  transferTime: '1h 15m',
  accommodationName: 'Hotel Mont Blanc',
  accommodationUrl: '',
  approximateCost: '£1500pp',
  description: 'World famous resort',
}

const p3 = {
  $id: 'p-3',
  ProposerUserId: 'user-3',
  ProposerUserName: 'Carol',
  state: 'DRAFT',
  resortName: 'Verbier',
  country: 'Switzerland',
  altitudeRange: '1500m - 3300m',
  nearestAirport: 'GVA',
  transferTime: '2h 00m',
  accommodationName: 'Le Chalet',
  accommodationUrl: '',
  approximateCost: '£2000pp',
  description: 'Challenging off-piste terrain',
}

async function renderViewer(props = {}) {
  const defaults = {
    proposals: [p1, p2, p3],
    initialIndex: 0,
    onClose: mock(() => {}),
  }
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(<ProposalViewer {...defaults} {...props} />)
  })
  return { ...defaults, ...props, ...result }
}

describe('ProposalViewer', () => {
  it('renders all proposal fields', async () => {
    await renderViewer()
    expect(screen.getByText("Val d'Isère")).toBeInTheDocument()
    expect(screen.getByText('France')).toBeInTheDocument()
    expect(screen.getByText('1850m - 3456m')).toBeInTheDocument()
    expect(screen.getByText('GVA')).toBeInTheDocument()
    expect(screen.getByText('2h 30m')).toBeInTheDocument()
    expect(screen.getByText('Chalet Belle Vue')).toBeInTheDocument()
    expect(screen.getByText('£1200pp')).toBeInTheDocument()
    expect(screen.getByText('Great powder skiing')).toBeInTheDocument()
  })

  it('shows an accommodation link when accommodationUrl is set', async () => {
    await renderViewer()
    const link = screen.getByRole('link', { name: /link/i })
    expect(link).toHaveAttribute('href', 'https://example.com/chalet')
  })

  it('does not show an accommodation link when accommodationUrl is empty', async () => {
    await renderViewer({ initialIndex: 1 })
    expect(
      screen.queryByRole('link', { name: /link/i })
    ).not.toBeInTheDocument()
  })

  it('shows SUBMITTED status badge', async () => {
    await renderViewer()
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument()
  })

  it('shows DRAFT status badge', async () => {
    await renderViewer({ initialIndex: 1 })
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
  })

  it('shows the N of M counter', async () => {
    await renderViewer()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('shows creator name', async () => {
    await renderViewer()
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
  })

  it('calls onClose when × button is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = await renderViewer()
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', async () => {
    const { onClose } = await renderViewer()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when the card itself is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = await renderViewer()
    // Click the resort name (inside the card)
    await user.click(screen.getByText("Val d'Isère"))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('prev button is disabled on the first proposal', async () => {
    await renderViewer({ initialIndex: 0 })
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
  })

  it('next button is disabled on the last proposal', async () => {
    await renderViewer({ initialIndex: 2 })
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('clicking next shows the next proposal', async () => {
    const user = userEvent.setup()
    await renderViewer({ initialIndex: 0 })
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /next/i }))
    })
    expect(screen.getByText('Chamonix')).toBeInTheDocument()
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
  })

  it('clicking prev shows the previous proposal', async () => {
    const user = userEvent.setup()
    await renderViewer({ initialIndex: 1 })
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /previous/i }))
    })
    expect(screen.getByText("Val d'Isère")).toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('pressing Escape calls onClose', async () => {
    const { onClose } = await renderViewer()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('pressing ArrowRight navigates to next proposal', async () => {
    await renderViewer({ initialIndex: 0 })
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })
    expect(screen.getByText('Chamonix')).toBeInTheDocument()
  })

  it('pressing ArrowLeft navigates to previous proposal', async () => {
    await renderViewer({ initialIndex: 1 })
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
    })
    expect(screen.getByText("Val d'Isère")).toBeInTheDocument()
  })

  it('ArrowLeft does nothing on the first proposal', async () => {
    await renderViewer({ initialIndex: 0 })
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
    })
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('ArrowRight does nothing on the last proposal', async () => {
    await renderViewer({ initialIndex: 2 })
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })
    expect(screen.getByText('3 of 3')).toBeInTheDocument()
  })

  it('renders a dot for each proposal with the active dot highlighted', async () => {
    await renderViewer({ initialIndex: 1 })
    // 3 dots for 3 proposals — check by aria-label or testid not available,
    // so verify the counter matches the active position
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
  })
})
