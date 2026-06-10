import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import type { LlmCache } from './types.d'
import useLLMCacheStream from './useLLMCacheStream'

function createMockRow(
  overrides: Partial<LlmCache> & Pick<LlmCache, 'id' | 'tripId' | 'type'>
): LlmCache {
  return {
    created: '2025-01-01T00:00:00.000Z',
    updated: '2025-01-01T00:00:00.000Z',
    inputHash: 'hash123',
    proposalId: null,
    status: 'generating',
    thinking: null,
    content: null,
    model: 'test-model',
    ...overrides,
  }
}

function createMockListFn(rows: LlmCache[] = []) {
  return mock(() => Promise.resolve(rows))
}

describe('useLLMCacheStream', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 200 }))
    ) as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns initial state', () => {
    const listFn = createMockListFn()
    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        { listLlmCacheByTripAndType: listFn }
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
        { listLlmCacheByTripAndType: listFn }
      )
    )

    expect(listFn).toHaveBeenCalledWith('t1', 'analysis')
  })

  it('loads existing generating row from list', async () => {
    const row = createMockRow({
      id: 'row1',
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
        { listLlmCacheByTripAndType: listFn }
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
      id: 'row1',
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
        { listLlmCacheByTripAndType: listFn }
      )
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.status).toBe('complete')
    expect(result.current.content).toBe('final content')
  })

  it('handles error status from cache', async () => {
    const listFn = createMockListFn([])

    const { result } = renderHook(() =>
      useLLMCacheStream(
        { type: 'analysis', proposalId: 'p1', tripId: 't1' },
        { listLlmCacheByTripAndType: listFn }
      )
    )

    expect(result.current.status).toBeNull()
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
      await Promise.resolve()
    })

    rerender({ type: 'preference-search', proposalId: 'p2', tripId: 't2' })

    expect(result.current.status).toBeNull()
    expect(result.current.thinking).toBe('')
    expect(result.current.content).toBe('')
  })

  it('handles preference-search type', async () => {
    const listFn = createMockListFn([])

    renderHook(() =>
      useLLMCacheStream(
        { type: 'preference-search', tripId: 't1' },
        { listLlmCacheByTripAndType: listFn }
      )
    )

    expect(listFn).toHaveBeenCalledWith('t1', 'preference-search')
  })
})
