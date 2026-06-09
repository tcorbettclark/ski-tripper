import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PreferenceSearchPopup from './PreferenceSearchPopup'
import type { Participant, Preferences } from './types.d'
import type { UseLLMCacheStreamResult } from './useLLMCacheStream'

const mockParticipants: Participant[] = [
  {
    $id: 'p1',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    participantUserId: 'user-1',
    participantUserName: 'Alice',
    tripId: 'trip-1',
    role: 'coordinator',
  },
  {
    $id: 'p2',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    participantUserId: 'user-2',
    participantUserName: 'Bob',
    tripId: 'trip-1',
    role: 'participant',
  },
  {
    $id: 'p3',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    participantUserId: 'user-3',
    participantUserName: 'Carol',
    tripId: 'trip-1',
    role: 'participant',
  },
]

const mockPreferences: Record<string, Preferences | null> = {
  'user-1': {
    $id: 'pref-1',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    userId: 'user-1',
    skiSnowboard: ['Ski'],
    difficulty: ['Red'],
    piste: ['On-piste'],
    timeSlopes: 60,
    timeEating: 20,
    timeApres: 10,
    timeHotel: 10,
    accommodation: ['Hotel'],
    notes: '',
  },
  'user-2': {
    $id: 'pref-2',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    userId: 'user-2',
    skiSnowboard: ['Ski', 'Snowboard'],
    difficulty: ['Blue', 'Red'],
    piste: ['On-piste', 'Off-piste'],
    timeSlopes: 50,
    timeEating: 25,
    timeApres: 15,
    timeHotel: 10,
    accommodation: ['Chalet'],
    notes: 'Love après-ski',
  },
  'user-3': null,
}

const listTripParticipantsMock = mock(
  async (_tripId: string): Promise<{ participants: Participant[] }> => ({
    participants: mockParticipants,
  })
)

const getPreferencesMock = mock(
  async (userId: string): Promise<Preferences | null> => {
    return mockPreferences[userId] ?? null
  }
)

const triggerPreferenceSearchMock = mock(async () => {})

const onCloseMock = mock(() => {})
const onSearchMock = mock((_query: string) => {})

let mockStreamResult: UseLLMCacheStreamResult = {
  status: null,
  thinking: '',
  content: '',
  model: '',
  error: null,
}

const defaultStreamResult: UseLLMCacheStreamResult = {
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
    listTripParticipantsMock.mockClear()
    getPreferencesMock.mockClear()
    triggerPreferenceSearchMock.mockClear()
    onCloseMock.mockClear()
    onSearchMock.mockClear()
  })

  it('renders empty state when no preference search available', async () => {
    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('No preference search available yet.')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /search from preferences/i })
    ).toBeTruthy()
  })

  it('shows included participants with preferences', async () => {
    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
  })

  it('shows excluded participants without preferences', async () => {
    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Carol')).toBeTruthy()
  })

  it('shows loading state when generating', async () => {
    mockStreamResult = {
      status: 'generating',
      thinking: 'Let me think...',
      content: '',
      model: '',
      error: null,
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Generating search query…')).toBeTruthy()
  })

  it('shows thinking section with collapsed toggle', async () => {
    mockStreamResult = {
      status: 'generating',
      thinking: 'I should consider the slope preferences...',
      content: '',
      model: '',
      error: null,
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Thinking…')).toBeTruthy()
  })

  it('shows content as markdown when complete', async () => {
    mockStreamResult = {
      status: 'complete',
      thinking: 'Some internal reasoning',
      content: 'A ski resort with good intermediate slopes and après-ski',
      model: 'kimi-k2.6:cloud',
      error: null,
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
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
      status: 'complete',
      thinking: '',
      content: 'Search query content',
      model: 'kimi-k2.6:cloud',
      error: null,
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Model: kimi-k2.6:cloud')).toBeTruthy()
  })

  it('shows Search button when complete', async () => {
    mockStreamResult = {
      status: 'complete',
      thinking: '',
      content: 'A resort suitable for intermediate skiers',
      model: 'test-model',
      error: null,
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Search')).toBeTruthy()
  })

  it('calls onSearch with content and onClose when Search button clicked', async () => {
    const user = userEvent.setup()
    mockStreamResult = {
      status: 'complete',
      thinking: '',
      content: 'Resort with great après-ski',
      model: 'test-model',
      error: null,
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    await user.click(screen.getByText('Search'))
    expect(onSearchMock).toHaveBeenCalledWith('Resort with great après-ski')
    expect(onCloseMock).toHaveBeenCalled()
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
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('Retry')).toBeTruthy()
  })

  it('calls triggerPreferenceSearch when trigger button clicked', async () => {
    const user = userEvent.setup()

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    await user.click(
      screen.getByRole('button', { name: /search from preferences/i })
    )
    expect(triggerPreferenceSearchMock).toHaveBeenCalledWith('trip-1')
  })

  it('calls triggerPreferenceSearch when Retry button clicked', async () => {
    mockStreamResult = {
      status: 'error',
      thinking: '',
      content: '',
      model: '',
      error: 'Something went wrong',
    }
    const user = userEvent.setup()

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    await user.click(screen.getByText('Retry'))
    expect(triggerPreferenceSearchMock).toHaveBeenCalledWith('trip-1')
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
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
      status: 'complete',
      thinking: 'Internal reasoning here',
      content: 'Final content',
      model: 'test-model',
      error: null,
    }
    const user = userEvent.setup()

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Thinking')).toBeTruthy()
    await user.click(screen.getByText('Thinking'))
    expect(screen.getByText('Internal reasoning here')).toBeTruthy()
  })

  it('does not show Search button while generating', async () => {
    mockStreamResult = {
      status: 'generating',
      thinking: '',
      content: 'Some partial content',
      model: '',
      error: null,
    }

    await act(async () => {
      render(
        <PreferenceSearchPopup
          tripId="trip-1"
          onClose={onCloseMock}
          onSearch={onSearchMock}
          triggerPreferenceSearch={triggerPreferenceSearchMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.queryByText('Search')).toBeNull()
  })
})
