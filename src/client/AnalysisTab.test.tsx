import { beforeEach, describe, expect, it } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnalysisTab from './AnalysisTab'
import type { UseSSEStreamResult } from './useSSEStream'

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

describe('AnalysisTab', () => {
  beforeEach(() => {
    mockStreamResult = {
      ...defaultStreamResult,
    }
  })

  it('renders generate button in initial state', async () => {
    await act(async () => {
      render(
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
          streamResult={mockStreamResult}
        />
      )
    })

    expect(
      screen.getByRole('button', { name: /generate analysis/i })
    ).toBeTruthy()
  })

  it('shows description in initial state', async () => {
    await act(async () => {
      render(
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
          streamResult={mockStreamResult}
        />
      )
    })

    expect(
      screen.getByText(
        /Generate an AI analysis of this proposal against everyone's ski holiday preferences/
      )
    ).toBeTruthy()
  })

  it('shows thinking placeholder while generating with no thinking content', async () => {
    mockStreamResult = {
      status: 'generating',
      thinking: '',
      content: '',
      model: '',
      error: null,
    }

    await act(async () => {
      render(
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Thinking…')).toBeTruthy()
  })

  it('shows thinking inline when generating', async () => {
    mockStreamResult = {
      status: 'generating',
      thinking: 'I should consider the slope preferences...',
      content: '',
      model: '',
      error: null,
    }

    await act(async () => {
      render(
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
          streamResult={mockStreamResult}
        />
      )
    })

    expect(
      screen.getByText('I should consider the slope preferences...')
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
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
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
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
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
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
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
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Thinking')).toBeTruthy()
    await user.click(screen.getByText('Thinking'))
    expect(screen.getByText('Internal reasoning here')).toBeTruthy()
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
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
          streamResult={mockStreamResult}
        />
      )
    })

    expect(
      screen.queryByText(
        /Generate an AI analysis of this proposal against everyone's ski holiday preferences/
      )
    ).toBeNull()
  })
})
