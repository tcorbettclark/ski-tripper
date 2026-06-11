import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { requireEnv } from '../shared/env'
import useSSEStream from './useSSEStream'

const { PUBLIC_POCKETBASE_URL: PB_URL } = requireEnv('PUBLIC_POCKETBASE_URL')

function sseUrl(endpoint: string): string {
  const base = new URL(PB_URL)
  return `${base.protocol}//${base.host}${endpoint}`
}

function createSSEStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const chunks = events.map((e) => encoder.encode(e))
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

describe('useSSEStream', () => {
  let fetchMock: ReturnType<typeof mock>

  beforeEach(() => {
    fetchMock = mock(() =>
      Promise.resolve(
        new Response(createSSEStream([]), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      )
    )
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
  })

  it('returns initial state', () => {
    const { result } = renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1', enabled: false })
    )
    expect(result.current).toEqual({
      status: null,
      thinking: '',
      content: '',
      model: '',
      error: null,
    })
  })

  it('does not fetch when disabled', () => {
    renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1', enabled: false })
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches SSE endpoint when enabled for analysis', () => {
    renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1', proposalId: 'prop-1' })
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(sseUrl('/api/analyse-proposal'))
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      tripId: 'trip-1',
      proposalId: 'prop-1',
    })
  })

  it('fetches preference-search endpoint', () => {
    renderHook(() =>
      useSSEStream({ type: 'preference-search', tripId: 'trip-1' })
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe(sseUrl('/api/preference-search'))
  })

  it('accumulates thinking events', async () => {
    const stream = createSSEStream([
      sseLine('thinking', { text: 'Hello ' }),
      sseLine('thinking', { text: 'World' }),
    ])
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      )
    ) as unknown as typeof globalThis.fetch

    const { result } = renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1' })
    )

    await act(() => new Promise((r) => setTimeout(r, 100)))

    expect(result.current.thinking).toBe('Hello World')
    expect(result.current.status).toBe('generating')
  })

  it('accumulates content events', async () => {
    const stream = createSSEStream([
      sseLine('content', { text: 'Part 1 ' }),
      sseLine('content', { text: 'Part 2' }),
    ])
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      )
    ) as unknown as typeof globalThis.fetch

    const { result } = renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1' })
    )

    await act(() => new Promise((r) => setTimeout(r, 100)))

    expect(result.current.content).toBe('Part 1 Part 2')
    expect(result.current.status).toBe('generating')
  })

  it('handles done event', async () => {
    const stream = createSSEStream([
      sseLine('content', { text: 'result' }),
      sseLine('done', {
        status: 'complete',
        thinking: 'thoughts',
        content: 'result',
        model: 'gpt-4',
      }),
    ])
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      )
    ) as unknown as typeof globalThis.fetch

    const { result } = renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1' })
    )

    await act(() => new Promise((r) => setTimeout(r, 100)))

    expect(result.current).toEqual({
      status: 'complete',
      thinking: 'thoughts',
      content: 'result',
      model: 'gpt-4',
      error: null,
    })
  })

  it('handles error event from server', async () => {
    const stream = createSSEStream([
      sseLine('error', { message: 'Something went wrong' }),
    ])
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      )
    ) as unknown as typeof globalThis.fetch

    const { result } = renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1' })
    )

    await act(() => new Promise((r) => setTimeout(r, 100)))

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Something went wrong')
  })

  it('handles HTTP error response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('Not Found', { status: 404 }))
    ) as unknown as typeof globalThis.fetch

    const { result } = renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1' })
    )

    await act(() => new Promise((r) => setTimeout(r, 100)))

    expect(result.current.status).toBe('error')
    expect(result.current.error).toContain('404')
  })

  it('handles fetch network error', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Network error'))
    ) as unknown as typeof globalThis.fetch

    const { result } = renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1' })
    )

    await act(() => new Promise((r) => setTimeout(r, 100)))

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Network error')
  })

  it('ignores abort errors on unmount', async () => {
    globalThis.fetch = mock((_url: string, _options: RequestInit) => {
      return Promise.reject(
        new DOMException('The operation was aborted.', 'AbortError')
      )
    }) as unknown as typeof globalThis.fetch

    const { unmount } = renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1' })
    )

    unmount()

    const { result } = renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1' })
    )

    await act(() => new Promise((r) => setTimeout(r, 50)))

    expect(result.current.status).not.toBe('error')
  })

  it('sends authorization header', () => {
    renderHook(() => useSSEStream({ type: 'analysis', tripId: 'trip-1' }))
    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers.Authorization).toMatch(/^Bearer /)
  })

  it('does not refetch for same params', () => {
    const { rerender } = renderHook(
      ({
        type,
        tripId,
        proposalId,
      }: {
        type: 'analysis' | 'preference-search'
        tripId: string
        proposalId: string
      }) => useSSEStream({ type, tripId, proposalId }),
      {
        initialProps: {
          type: 'analysis' as const,
          tripId: 'trip-1',
          proposalId: 'prop-1',
        },
      }
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)

    rerender({ type: 'analysis', tripId: 'trip-1', proposalId: 'prop-1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches when params change', () => {
    const { rerender } = renderHook(
      ({
        type,
        tripId,
        proposalId,
      }: {
        type: 'analysis' | 'preference-search'
        tripId: string
        proposalId: string
      }) => useSSEStream({ type, tripId, proposalId }),
      {
        initialProps: {
          type: 'analysis' as const,
          tripId: 'trip-1',
          proposalId: 'prop-1',
        },
      }
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)

    rerender({ type: 'analysis', tripId: 'trip-1', proposalId: 'prop-2' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
