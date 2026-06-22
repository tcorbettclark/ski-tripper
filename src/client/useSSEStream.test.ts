import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { browser_get_api_url } from '../shared/env'
import useSSEStream from './useSSEStream'

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
    process.env.PUBLIC_DOMAIN = 'test-host'
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
    expect(result.current.status).toBeNull()
    expect(result.current.thinking).toBe('')
    expect(result.current.content).toBe('')
    expect(result.current.model).toBe('')
    expect(result.current.error).toBeNull()
    expect(typeof result.current.refetch).toBe('function')
  })

  it('does not fetch when disabled', () => {
    renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1', enabled: false })
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches SSE endpoint when enabled for analysis', async () => {
    await act(() => {
      renderHook(() =>
        useSSEStream({
          type: 'analysis',
          tripId: 'trip-1',
          proposalId: 'prop-1',
        })
      )
    })
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(browser_get_api_url('/api/analyse-proposal'))
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      tripId: 'trip-1',
      proposalId: 'prop-1',
    })
  })

  it('fetches preference-search endpoint', async () => {
    await act(() => {
      renderHook(() =>
        useSSEStream({ type: 'preference-search', tripId: 'trip-1' })
      )
    })
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe(browser_get_api_url('/api/preference-search'))
  })

  it('accumulates thinking events', async () => {
    const stream = createSSEStream([
      sseLine('thinking', { text: 'Hello ' }),
      sseLine('thinking', { text: 'World' }),
      sseLine('done', {
        status: 'complete',
        thinking: 'Hello World',
        content: 'result',
        model: 'test',
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

    expect(result.current.thinking).toBe('Hello World')
    expect(result.current.status).toBe('complete')
  })

  it('accumulates content events', async () => {
    const stream = createSSEStream([
      sseLine('content', { text: 'Part 1 ' }),
      sseLine('content', { text: 'Part 2' }),
      sseLine('done', {
        status: 'complete',
        thinking: '',
        content: 'Part 1 Part 2',
        model: 'test',
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

    expect(result.current.content).toBe('Part 1 Part 2')
    expect(result.current.status).toBe('complete')
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

    expect(result.current.status).toBe('complete')
    expect(result.current.thinking).toBe('thoughts')
    expect(result.current.content).toBe('result')
    expect(result.current.model).toBe('gpt-4')
    expect(result.current.error).toBeNull()
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

    let unmount: () => void
    await act(() => {
      const result = renderHook(() =>
        useSSEStream({ type: 'analysis', tripId: 'trip-1' })
      )
      unmount = result.unmount
    })
    await act(() => new Promise((r) => setTimeout(r, 0)))

    unmount!()

    const { result } = renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1' })
    )

    await act(() => new Promise((r) => setTimeout(r, 50)))

    expect(result.current.status).not.toBe('error')
  })

  it('sends authorization header', async () => {
    await act(() => {
      renderHook(() => useSSEStream({ type: 'analysis', tripId: 'trip-1' }))
    })
    await act(() => new Promise((r) => setTimeout(r, 0)))
    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers.Authorization).toMatch(/^Bearer /)
  })

  it('does not refetch for same params', async () => {
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
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(() => {
      rerender({ type: 'analysis', tripId: 'trip-1', proposalId: 'prop-1' })
    })
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches when params change', async () => {
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
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(() => {
      rerender({ type: 'analysis', tripId: 'trip-1', proposalId: 'prop-2' })
    })
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('handles done event split across network chunks', async () => {
    const encoder = new TextEncoder()
    const donePayload = JSON.stringify({
      status: 'complete',
      thinking: 'long thinking text',
      content: 'final content',
      model: 'test-model',
    })
    const chunk1 = encoder.encode(
      `event: content\ndata: {"text":"hello"}\n\nevent: done\ndata: ${donePayload.slice(0, 20)}`
    )
    const chunk2 = encoder.encode(`${donePayload.slice(20)}\n\n`)
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk1)
        controller.enqueue(chunk2)
        controller.close()
      },
    })
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

    expect(result.current.status).toBe('complete')
    expect(result.current.thinking).toBe('long thinking text')
    expect(result.current.content).toBe('final content')
    expect(result.current.model).toBe('test-model')
    expect(result.current.error).toBeNull()
  })

  it('handles done event arriving in final chunk without trailing newline', async () => {
    const encoder = new TextEncoder()
    const contentEvent = `event: content\ndata: {"text":"hello"}\n\n`
    const donePayload = JSON.stringify({
      status: 'complete',
      thinking: 'thoughts',
      content: 'hello',
      model: 'gpt-4',
    })
    const doneEvent = `event: done\ndata: ${donePayload}\n\n`
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(contentEvent))
        controller.enqueue(encoder.encode(doneEvent))
        controller.close()
      },
    })
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

    expect(result.current.status).toBe('complete')
    expect(result.current.thinking).toBe('thoughts')
    expect(result.current.content).toBe('hello')
    expect(result.current.model).toBe('gpt-4')
    expect(result.current.error).toBeNull()
  })

  it('refetch resets state and fetches again', async () => {
    const stream = createSSEStream([
      sseLine('content', { text: 'first result' }),
      sseLine('done', {
        status: 'complete',
        thinking: '',
        content: 'first result',
        model: 'test-model',
      }),
    ])
    const stream2 = createSSEStream([
      sseLine('content', { text: 'second result' }),
      sseLine('done', {
        status: 'complete',
        thinking: '',
        content: 'second result',
        model: 'test-model-2',
      }),
    ])
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      const s = callCount === 1 ? stream : stream2
      return Promise.resolve(
        new Response(s, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      )
    }) as unknown as typeof globalThis.fetch

    const { result } = renderHook(() =>
      useSSEStream({ type: 'analysis', tripId: 'trip-1' })
    )

    await act(() => new Promise((r) => setTimeout(r, 100)))
    expect(result.current.content).toBe('first result')

    act(() => {
      result.current.refetch()
    })

    await act(() => new Promise((r) => setTimeout(r, 100)))
    expect(callCount).toBe(2)
    expect(result.current.content).toBe('second result')
  })

  it('detects stream ending without done event and no content', async () => {
    const stream = createSSEStream([
      sseLine('thinking', { text: 'Hmm let me think...' }),
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
    expect(result.current.error).toBe(
      'Model produced no output. Please try again.'
    )
    expect(result.current.thinking).toBe('')
    expect(result.current.content).toBe('')
  })

  it('detects stream ending without done event with partial content', async () => {
    const encoder = new TextEncoder()
    const contentChunk = encoder.encode(
      `event: content\ndata: {"text":"## Analysis\\nSome partial"}\n\n`
    )
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(contentChunk)
        controller.close()
      },
    })
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
    expect(result.current.error).toBe(
      'Connection closed before response was complete.'
    )
  })
})
