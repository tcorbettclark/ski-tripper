import { useCallback, useEffect, useRef, useState } from 'react'
import { browser_get_api_url } from '../shared/env'
import type { LlmStreamStatus } from '../shared/types.d'
import { getPb } from './backend'

const TIMEOUT_MS = 120_000

export interface UseSSEStreamParams {
  type: 'analysis' | 'preference-search'
  proposalId?: string
  tripId: string
  enabled?: boolean
}

export interface UseSSEStreamResult {
  status: LlmStreamStatus | null
  thinking: string
  content: string
  model: string
  error: string | null
}

const INITIAL_STATE: UseSSEStreamResult = {
  status: null,
  thinking: '',
  content: '',
  model: '',
  error: null,
}

export default function useSSEStream(
  params: UseSSEStreamParams
): UseSSEStreamResult & { refetch: () => void } {
  const { type, proposalId, tripId, enabled = true } = params

  const [state, setState] = useState<UseSSEStreamResult>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const paramsKeyRef = useRef('')
  const fetchCountRef = useRef(0)

  const [fetchCount, setFetchCount] = useState(0)

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const resetTimeout = useCallback(() => {
    clearTimer()
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Timed out waiting for response.',
        }))
      }
    }, TIMEOUT_MS)
  }, [clearTimer])

  const refetch = useCallback(() => {
    setFetchCount((c) => c + 1)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
      clearTimer()
    }
  }, [clearTimer])

  useEffect(() => {
    if (!enabled) return

    const key = `${type}:${tripId}:${proposalId ?? ''}`
    if (key === paramsKeyRef.current && fetchCount === fetchCountRef.current)
      return
    paramsKeyRef.current = key
    fetchCountRef.current = fetchCount

    setState({ ...INITIAL_STATE, status: 'generating' })
    clearTimer()

    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }

    resetTimeout()

    const endpoint =
      type === 'analysis' ? '/api/analyse-proposal' : '/api/preference-search'

    const body: Record<string, string> = { tripId }
    if (type === 'analysis' && proposalId) {
      body.proposalId = proposalId
    }

    const controller = new AbortController()
    abortRef.current = controller

    fetch(browser_get_api_url(endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getPb().authStore.token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text()
          if (mountedRef.current) {
            setState((prev) => ({
              ...prev,
              status: 'error',
              error: `Request failed: ${response.status} ${text}`,
            }))
          }
          return
        }

        if (!response.body) return

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let currentEvent = ''

        function processLine(line: string): void {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)

              if (currentEvent === 'thinking') {
                resetTimeout()
                setState((prev) => ({
                  ...prev,
                  status: 'generating',
                  thinking: (prev.thinking ?? '') + (parsed.text ?? ''),
                }))
              } else if (currentEvent === 'content') {
                resetTimeout()
                setState((prev) => ({
                  ...prev,
                  status: 'generating',
                  content: (prev.content ?? '') + (parsed.text ?? ''),
                }))
              } else if (currentEvent === 'done') {
                clearTimer()
                setState({
                  status: parsed.status ?? 'complete',
                  thinking: parsed.thinking ?? '',
                  content: parsed.content ?? '',
                  model: parsed.model ?? '',
                  error: null,
                })
              } else if (currentEvent === 'error') {
                clearTimer()
                setState({
                  status: 'error',
                  thinking: '',
                  content: '',
                  model: '',
                  error: parsed.message ?? 'An error occurred.',
                })
              }
            } catch {
              // ignore parse errors
            }
            currentEvent = ''
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (!mountedRef.current) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            processLine(line)
          }
        }

        buffer += decoder.decode()
        if (buffer.trim()) {
          for (const line of buffer.split('\n')) {
            processLine(line)
          }
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: err instanceof Error ? err.message : 'Connection failed',
          }))
        }
      })
  }, [type, tripId, proposalId, enabled, fetchCount, clearTimer, resetTimeout])

  return { ...state, refetch }
}
