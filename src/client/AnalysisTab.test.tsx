import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Participant, Preferences } from '../shared/types.d'
import AnalysisTab from './AnalysisTab'
import type { UseSSEStreamResult } from './useSSEStream'

const mockParticipants: Participant[] = [
  {
    id: 'p1',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    user: 'user-1',
    userName: 'Alice',
    trip: 'trip-1',
    role: 'coordinator',
  },
  {
    id: 'p2',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    user: 'user-2',
    userName: 'Bob',
    trip: 'trip-1',
    role: 'participant',
  },
  {
    id: 'p3',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    user: 'user-3',
    userName: 'Carol',
    trip: 'trip-1',
    role: 'participant',
  },
]

const mockPreferences: Record<string, Preferences | null> = {
  'user-1': {
    id: 'pref-1',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    user: 'user-1',
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
    id: 'pref-2',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    user: 'user-2',
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

const triggerAnalysisMock = mock(async () => {})

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
    listTripParticipantsMock.mockClear()
    getPreferencesMock.mockClear()
    triggerAnalysisMock.mockClear()
  })

  it('renders empty state when no analysis available', async () => {
    await act(async () => {
      render(
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
          triggerAnalysis={triggerAnalysisMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('No analysis available yet.')).toBeTruthy()
    expect(screen.getByText('Generate Analysis')).toBeTruthy()
  })

  it('shows included participants with preferences', async () => {
    await act(async () => {
      render(
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
          triggerAnalysis={triggerAnalysisMock}
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
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
          triggerAnalysis={triggerAnalysisMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Carol')).toBeTruthy()
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
          triggerAnalysis={triggerAnalysisMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
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
          triggerAnalysis={triggerAnalysisMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
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
          triggerAnalysis={triggerAnalysisMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
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
          triggerAnalysis={triggerAnalysisMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
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
          triggerAnalysis={triggerAnalysisMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('Retry')).toBeTruthy()
  })

  it('calls triggerAnalysis when Generate Analysis button clicked', async () => {
    const user = userEvent.setup()

    await act(async () => {
      render(
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
          triggerAnalysis={triggerAnalysisMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    await user.click(screen.getByText('Generate Analysis'))
    expect(triggerAnalysisMock).toHaveBeenCalledWith('prop-1', 'trip-1')
  })

  it('calls triggerAnalysis when Retry button clicked', async () => {
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
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
          triggerAnalysis={triggerAnalysisMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    await user.click(screen.getByText('Retry'))
    expect(triggerAnalysisMock).toHaveBeenCalledWith('prop-1', 'trip-1')
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
          triggerAnalysis={triggerAnalysisMock}
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

  it('shows participants list alongside analysis content', async () => {
    mockStreamResult = {
      status: 'complete',
      thinking: '',
      content: 'Great resort!',
      model: 'test-model',
      error: null,
    }

    await act(async () => {
      render(
        <AnalysisTab
          proposalId="prop-1"
          tripId="trip-1"
          triggerAnalysis={triggerAnalysisMock}
          listTripParticipants={listTripParticipantsMock}
          getPreferences={getPreferencesMock}
          streamResult={mockStreamResult}
        />
      )
    })

    expect(screen.getByText('Included:', { exact: false })).toBeTruthy()
    expect(screen.getByText('No preferences:', { exact: false })).toBeTruthy()
  })
})
