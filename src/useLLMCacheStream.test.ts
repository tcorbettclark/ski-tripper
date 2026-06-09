import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import type { LlmCache } from './types.d'
import useLLMCacheStream from './useLLMCacheStream'

function createMockRow(
  overrides: Partial<LlmCache> & Pick<LlmCache, '$id' | 'tripId' | 'type'>
): LlmCache {
  return {
    $createdAt: '2025-01-01T00:00:00.000Z',
    $updatedAt: '2025-01-01T00:00:00.000Z',
    inputHash: 'hash123',
    proposalId: null,
    status: 'generating',
    thinking: null,
    content: null,
    model: 'test-model',
    ...overrides,
  }
}

function createMockRealtime() {
  const subscriptions: {
    channel: unknown
    callback: (event: unknown) => void
  }[] = []

  const mockSubscribe = mock(
    (channel: unknown, callback: (event: unknown) => void) => {
      const sub = { channel, callback }
      subscriptions.push(sub)
      return Promise.resolve({
        close: mock(() => Promise.resolve()),
        unsubscribe: mock(() => Promise.resolve()),
      })
    }
  )

  const mockDisconnect = mock(() => Promise.resolve())

  return {
    subscribe: mockSubscribe,
    disconnect: mockDisconnect,
    subscriptions,
    emit(payload: LlmCache) {
      for (const sub of subscriptions) {
        sub.callback({
          events: ['tablesdb.*.tables.*.rows.*.update'],
          channels: [],
          timestamp: new Date().toISOString(),
          payload,
          subscriptions: [],
        })
      }
    },
  }
}

function createMockListFn(rows: LlmCache[] = []) {
  return mock(() => Promise.resolve(rows))
}

describe('useLLMCacheStream', () => {
  let mockRealtime: ReturnType<typeof createMockRealtime>

  beforeEach(() => {
    mockRealtime = createMockRealtime()
  })

  it('returns initial state', () => {
    const listFn = createMockListFn()
    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    expect(result.current.status).toBeNull()
    expect(result.current.thinking).toBe('')
    expect(result.current.content).toBe('')
    expect(result.current.model).toBe('')
    expect(result.current.error).toBeNull()
  })

  it('calls listLlmCacheByTripAndType with correct params', () => {
    const listFn = createMockListFn()
    renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    expect(listFn).toHaveBeenCalledWith('t1', 'analysis')
  })

  it('subscribes to the llm_cache table channel', () => {
    const listFn = createMockListFn()
    renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    expect(mockRealtime.subscribe).toHaveBeenCalledTimes(1)
  })

  it('loads existing generating row from list', async () => {
    const row = createMockRow({
      $id: 'row1',
      tripId: 't1',
      type: 'analysis',
      proposalId: 'p1',
      status: 'generating',
      thinking: 'thinking...',
      content: 'content...',
      model: 'test-model',
    })
    const listFn = createMockListFn([row])

    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.status).toBe('generating')
    expect(result.current.thinking).toBe('thinking...')
    expect(result.current.content).toBe('content...')
  })

  it('loads existing complete row from list', async () => {
    const row = createMockRow({
      $id: 'row1',
      tripId: 't1',
      type: 'analysis',
      proposalId: 'p1',
      status: 'complete',
      thinking: 'final thinking',
      content: 'final content',
      model: 'test-model',
    })
    const listFn = createMockListFn([row])

    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.status).toBe('complete')
    expect(result.current.content).toBe('final content')
  })

  it('updates state when realtime event arrives', async () => {
    const listFn = createMockListFn([])

    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    await act(async () => {
      mockRealtime.emit(
        createMockRow({
          $id: 'row1',
          tripId: 't1',
          type: 'analysis',
          proposalId: 'p1',
          status: 'generating',
          thinking: 'starting...',
          content: null,
          model: 'test-model',
        })
      )
    })

    expect(result.current.status).toBe('generating')
    expect(result.current.thinking).toBe('starting...')
  })

  it('filters out events with wrong type', async () => {
    const listFn = createMockListFn([])

    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    await act(async () => {
      mockRealtime.emit(
        createMockRow({
          $id: 'row1',
          tripId: 't1',
          type: 'preference-search',
          proposalId: null,
          status: 'generating',
          thinking: 'ignored',
          content: null,
          model: 'test-model',
        })
      )
    })

    expect(result.current.status).toBeNull()
  })

  it('filters out events with wrong tripId', async () => {
    const listFn = createMockListFn([])

    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    await act(async () => {
      mockRealtime.emit(
        createMockRow({
          $id: 'row1',
          tripId: 'wrong-trip',
          type: 'analysis',
          proposalId: 'p1',
          status: 'generating',
          thinking: 'ignored',
          content: null,
          model: 'test-model',
        })
      )
    })

    expect(result.current.status).toBeNull()
  })

  it('filters out events with wrong proposalId for analysis type', async () => {
    const listFn = createMockListFn([])

    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    await act(async () => {
      mockRealtime.emit(
        createMockRow({
          $id: 'row1',
          tripId: 't1',
          type: 'analysis',
          proposalId: 'wrong-proposal',
          status: 'generating',
          thinking: 'ignored',
          content: null,
          model: 'test-model',
        })
      )
    })

    expect(result.current.status).toBeNull()
  })

  it('filters out events with different rowId after initial lock', async () => {
    const listFn = createMockListFn([])

    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    await act(async () => {
      mockRealtime.emit(
        createMockRow({
          $id: 'row1',
          tripId: 't1',
          type: 'analysis',
          proposalId: 'p1',
          status: 'generating',
          thinking: 'first',
          content: null,
          model: 'test-model',
        })
      )
    })

    expect(result.current.status).toBe('generating')

    await act(async () => {
      mockRealtime.emit(
        createMockRow({
          $id: 'row2',
          tripId: 't1',
          type: 'analysis',
          proposalId: 'p1',
          status: 'generating',
          thinking: 'stale',
          content: null,
          model: 'test-model',
        })
      )
    })

    expect(result.current.thinking).toBe('first')
  })

  it('progressively accumulates thinking and content', async () => {
    const listFn = createMockListFn([])

    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    await act(async () => {
      mockRealtime.emit(
        createMockRow({
          $id: 'row1',
          tripId: 't1',
          type: 'analysis',
          proposalId: 'p1',
          status: 'generating',
          thinking: 'step 1',
          content: 'content 1',
          model: 'test-model',
        })
      )
    })

    expect(result.current.thinking).toBe('step 1')
    expect(result.current.content).toBe('content 1')

    await act(async () => {
      mockRealtime.emit(
        createMockRow({
          $id: 'row1',
          tripId: 't1',
          type: 'analysis',
          proposalId: 'p1',
          status: 'generating',
          thinking: 'step 1 step 2',
          content: 'content 1 content 2',
          model: 'test-model',
        })
      )
    })

    expect(result.current.thinking).toBe('step 1 step 2')
    expect(result.current.content).toBe('content 1 content 2')
  })

  it('handles error status', async () => {
    const listFn = createMockListFn([])

    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    await act(async () => {
      mockRealtime.emit(
        createMockRow({
          $id: 'row1',
          tripId: 't1',
          type: 'analysis',
          proposalId: 'p1',
          status: 'error',
          thinking: null,
          content: 'Something went wrong',
          model: 'test-model',
        })
      )
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Something went wrong')
  })

  it('sets error to default message when content is null on error row', async () => {
    const listFn = createMockListFn([])

    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    await act(async () => {
      mockRealtime.emit(
        createMockRow({
          $id: 'row1',
          tripId: 't1',
          type: 'analysis',
          proposalId: 'p1',
          status: 'error',
          thinking: null,
          content: null,
          model: 'test-model',
        })
      )
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('An error occurred.')
  })

  it('handles preference-search type', async () => {
    const listFn = createMockListFn([])

    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'preference-search', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    expect(listFn).toHaveBeenCalledWith('t1', 'preference-search')

    await act(async () => {
      mockRealtime.emit(
        createMockRow({
          $id: 'row1',
          tripId: 't1',
          type: 'preference-search',
          proposalId: null,
          status: 'generating',
          thinking: null,
          content: null,
          model: 'test-model',
        })
      )
    })

    expect(result.current.status).toBe('generating')
  })

  it('resets state when params change', async () => {
    const listFn = createMockListFn([])

    const { result, rerender } = renderHook(
      (props: {
        type: 'analysis' | 'preference-search'
        proposalId?: string
        tripId: string
      }) =>
        useLLMCacheStream(props, {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }),
      {
        initialProps: {
          type: 'analysis' as 'analysis' | 'preference-search',
          proposalId: 'p1',
          tripId: 't1',
        },
      }
    )

    await act(async () => {
      mockRealtime.emit(
        createMockRow({
          $id: 'row1',
          tripId: 't1',
          type: 'analysis',
          proposalId: 'p1',
          status: 'complete',
          thinking: 'done thinking',
          content: 'done content',
          model: 'test-model',
        })
      )
    })

    expect(result.current.status).toBe('complete')

    rerender({ type: 'preference-search', proposalId: 'p2', tripId: 't2' })

    expect(result.current.status).toBeNull()
    expect(result.current.thinking).toBe('')
    expect(result.current.content).toBe('')
  })

  it('closes subscription on unmount', async () => {
    const listFn = createMockListFn()

    const { unmount } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        {
          realtime: mockRealtime as unknown as import('appwrite').Realtime,
          listLlmCacheByTripAndType: listFn,
        }
      )
    )

    await act(async () => {
      await Promise.resolve()
    })

    unmount()

    const sub = (await mockRealtime.subscribe.mock.results[0]
      ?.value) as unknown as import('appwrite').RealtimeSubscription | undefined
    expect(sub).toBeDefined()
    expect((sub as { close: () => void }).close).toBeDefined()
  })
})
