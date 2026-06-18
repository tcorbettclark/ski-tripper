import { beforeEach, describe, expect, it } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnalysisPopup from './AnalysisPopup'
import type { UseSSEStreamResult } from './useSSEStream'

const onCloseMock = (() => {}) as () => void

let mockStreamResult: UseSSEStreamResult = {
  status: null,
  thinking: '',
  content: '',
  model: '',
  error: null,
}

const defaultStreamResult: UseSSEStreamResult = {
  status: null,
  thinking: '',
  content: '',
  model: '',
  error: null,
}

describe('AnalysisPopup', () => {
  beforeEach(() => {
    mockStreamResult = {
      ...defaultStreamResult,
    }
  })

  it('renders generate button in initial state', async () => {
    await act(async () => {
      render(
        <AnalysisPopup
          proposalId="prop-1"
          tripId="trip-1"
          onClose={onCloseMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(
      screen.getByRole('button', { name: /generate analysis/i })
    ).toBeTruthy()
  })

  it('shows title and description', async () => {
    await act(async () => {
      render(
        <AnalysisPopup
          proposalId="prop-1"
          tripId="trip-1"
          onClose={onCloseMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('AI Analysis')).toBeTruthy()
    expect(
      screen.getByText(
        /Use AI to analyse this proposal against everyone's ski holiday preferences/
      )
    ).toBeTruthy()
  })

  it('shows thinking placeholder while waiting for thinking content', async () => {
    mockStreamResult = {
      status: 'generating',
      thinking: '',
      content: '',
      model: '',
      error: null,
    }

    await act(async () => {
      render(
        <AnalysisPopup
          proposalId="prop-1"
          tripId="trip-1"
          onClose={onCloseMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Thinking…')).toBeTruthy()
  })

  it('shows thinking inline when generating', async () => {
    mockStreamResult = {
      status: 'generating',
      thinking: 'Let me consider the slope preferences...',
      content: '',
      model: '',
      error: null,
    }

    await act(async () => {
      render(
        <AnalysisPopup
          proposalId="prop-1"
          tripId="trip-1"
          onClose={onCloseMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(
      screen.getByText('Let me consider the slope preferences...')
    ).toBeTruthy()
  })

  it('shows content as markdown when complete', async () => {
    mockStreamResult = {
      status: 'complete',
      thinking: 'Some internal reasoning',
      content: '## Analysis\n\nThis resort is **excellent**.',
      model: 'kimi-k2.6:cloud',
      error: null,
    }

    await act(async () => {
      render(
        <AnalysisPopup
          proposalId="prop-1"
          tripId="trip-1"
          onClose={onCloseMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Analysis')).toBeTruthy()
    expect(screen.getByText('excellent')).toBeTruthy()
  })

  it('shows model label when complete', async () => {
    mockStreamResult = {
      status: 'complete',
      thinking: '',
      content: 'Analysis content',
      model: 'kimi-k2.6:cloud',
      error: null,
    }

    await act(async () => {
      render(
        <AnalysisPopup
          proposalId="prop-1"
          tripId="trip-1"
          onClose={onCloseMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Model: kimi-k2.6:cloud')).toBeTruthy()
  })

  it('shows error state with retry button', async () => {
    mockStreamResult = {
      status: 'error',
      thinking: '',
      content: '',
      model: '',
      error: 'Something went wrong',
    }

    await act(async () => {
      render(
        <AnalysisPopup
          proposalId="prop-1"
          tripId="trip-1"
          onClose={onCloseMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('Retry')).toBeTruthy()
  })

  it('expands thinking section on toggle click', async () => {
    mockStreamResult = {
      status: 'complete',
      thinking: 'Internal reasoning here',
      content: 'Final content',
      model: 'test-model',
      error: null,
    }
    const user = userEvent.setup()

    await act(async () => {
      render(
        <AnalysisPopup
          proposalId="prop-1"
          tripId="trip-1"
          onClose={onCloseMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Thinking')).toBeTruthy()
    await user.click(screen.getByText('Thinking'))
    expect(screen.getByText('Internal reasoning here')).toBeTruthy()
  })

  it('calls onClose when close button clicked', async () => {
    let closed = false
    const handleClose = () => {
      closed = true
    }
    const user = userEvent.setup()

    await act(async () => {
      render(
        <AnalysisPopup
          proposalId="prop-1"
          tripId="trip-1"
          onClose={handleClose}
          streamResult={mockStreamResult}
        />
      )
    })

    const closeButtons = screen.getAllByRole('button')
    const closeButton = closeButtons.find((b) =>
      b.getAttribute('aria-label')?.includes('Close')
    )
    if (closeButton) {
      await user.click(closeButton)
    }
    expect(closed).toBe(true)
  })

  it('does not show description once triggered', async () => {
    mockStreamResult = {
      status: 'generating',
      thinking: '',
      content: '',
      model: '',
      error: null,
    }

    await act(async () => {
      render(
        <AnalysisPopup
          proposalId="prop-1"
          tripId="trip-1"
          onClose={onCloseMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(
      screen.queryByText(
        /Use AI to analyse this proposal against everyone's ski holiday preferences/
      )
    ).toBeNull()
  })
})
