import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PreferenceSearchPopup from './PreferenceSearchPopup'
import type { UseSSEStreamResult } from './useSSEStream'

const onCloseMock = mock(() => {})
const onSearchMock = mock((_query: string) => {})
const onTriggerMock = mock(() => {})
const onRetryMock = mock(() => {})

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

describe('PreferenceSearchPopup', () => {
  beforeEach(() => {
    mockStreamResult = {
      ...defaultStreamResult,
    }
    onCloseMock.mockClear()
    onSearchMock.mockClear()
    onTriggerMock.mockClear()
    onRetryMock.mockClear()
  })

  it('renders generate button in initial state', async () => {
    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(
      screen.getByRole('button', { name: /generate search/i })
    ).toBeTruthy()
  })

  it('shows title and description', async () => {
    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('AI assist')).toBeTruthy()
    expect(
      screen.getByText(
        "Generate resort search text from everyone's ski holiday preferences"
      )
    ).toBeTruthy()
  })

  it('shows thinking inline when generating', async () => {
    mockStreamResult = {
      ...mockStreamResult,
      status: 'generating',
      thinking: 'Let me think...',
      content: '',
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Let me think...')).toBeTruthy()
  })

  it('shows thinking placeholder while waiting for thinking content', async () => {
    mockStreamResult = {
      ...mockStreamResult,
      status: 'generating',
      thinking: '',
      content: '',
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Thinking…')).toBeTruthy()
  })

  it('shows content as markdown when complete', async () => {
    mockStreamResult = {
      ...mockStreamResult,
      status: 'complete',
      thinking: 'Some internal reasoning',
      content: 'A ski resort with good intermediate slopes and après-ski',
      model: 'kimi-k2.6:cloud',
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(
      screen.getByText(
        'A ski resort with good intermediate slopes and après-ski'
      )
    ).toBeTruthy()
  })

  it('shows model label when complete', async () => {
    mockStreamResult = {
      ...mockStreamResult,
      status: 'complete',
      content: 'Search query content',
      model: 'kimi-k2.6:cloud',
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Model: kimi-k2.6:cloud')).toBeTruthy()
  })

  it('shows Apply button when complete', async () => {
    mockStreamResult = {
      ...mockStreamResult,
      status: 'complete',
      content: 'A resort suitable for intermediate skiers',
      model: 'test-model',
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Apply')).toBeTruthy()
  })

  it('calls onSearch with content and onClose when Apply button clicked', async () => {
    const user = userEvent.setup()
    mockStreamResult = {
      ...mockStreamResult,
      status: 'complete',
      content: 'Resort with great après-ski',
      model: 'test-model',
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          streamResult={mockStreamResult}
        />
      )
    })

    await user.click(screen.getByText('Apply'))
    expect(onSearchMock).toHaveBeenCalledWith('Resort with great après-ski')
    expect(onCloseMock).toHaveBeenCalled()
  })

  it('shows error state with retry button', async () => {
    mockStreamResult = {
      ...mockStreamResult,
      status: 'error',
      error: 'Something went wrong',
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('Retry')).toBeTruthy()
  })

  it('calls onTrigger when Generate search button clicked', async () => {
    const user = userEvent.setup()

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          onTrigger={onTriggerMock}
          streamResult={mockStreamResult}
        />
      )
    })

    await user.click(screen.getByRole('button', { name: /generate search/i }))
    expect(onTriggerMock).toHaveBeenCalled()
  })

  it('calls onRetry when Retry button clicked with streamResult', async () => {
    mockStreamResult = {
      ...mockStreamResult,
      status: 'error',
      error: 'Something went wrong',
    }
    const user = userEvent.setup()

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          onRetry={onRetryMock}
          streamResult={mockStreamResult}
        />
      )
    })

    await user.click(screen.getByText('Retry'))
    expect(onRetryMock).toHaveBeenCalled()
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
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
    expect(onCloseMock).toHaveBeenCalled()
  })

  it('expands thinking section on toggle click', async () => {
    mockStreamResult = {
      ...mockStreamResult,
      status: 'complete',
      thinking: 'Internal reasoning here',
      content: 'Final content',
      model: 'test-model',
    }
    const user = userEvent.setup()

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Thinking')).toBeTruthy()
    expect(screen.queryByText('Internal reasoning here')).toBeNull()
    await user.click(screen.getByText('Thinking'))
    expect(screen.getByText('Internal reasoning here')).toBeTruthy()
  })

  it('does not show Apply button while generating', async () => {
    mockStreamResult = {
      ...mockStreamResult,
      status: 'generating',
      content: 'Some partial content',
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.queryByText('Apply')).toBeNull()
  })
})
