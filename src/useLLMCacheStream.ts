import { Channel, Realtime } from 'appwrite'
import { useCallback, useEffect, useRef, useState } from 'react'
import client, { listLlmCacheByTripAndType } from './backend'
import type { LlmCache } from './types.d'

const DATABASE_ID = process.env.PUBLIC_APPWRITE_DATABASE_ID as string
const LLM_CACHE_TABLE_ID = process.env
  .PUBLIC_APPWRITE_LLM_CACHE_TABLE_ID as string

const TIMEOUT_MS = 60_000

export interface UseLLMCacheStreamParams {
  type: 'analysis' | 'preference-search'
  proposalId?: string
  tripId: string
}

export interface UseLLMCacheStreamResult {
  status: LlmCache['status'] | null
  thinking: string
  content: string
  model: string
  error: string | null
}

const INITIAL_STATE: UseLLMCacheStreamResult = {
  status: null,
  thinking: '',
  content: '',
  model: '',
  error: null,
}

export default function useLLMCacheStream(
  params: UseLLMCacheStreamParams,
  options?: {
    realtime?: Realtime
    listLlmCacheByTripAndType?: typeof listLlmCacheByTripAndType
  }
): UseLLMCacheStreamResult {
  const { type, proposalId, tripId } = params
  const realtimeRef = useRef(options?.realtime ?? new Realtime(client))
  const listRef = useRef(
    options?.listLlmCacheByTripAndType ?? listLlmCacheByTripAndType
  )

  const [state, setState] = useState<UseLLMCacheStreamResult>(INITIAL_STATE)
  const subscriptionRef = useRef<{ close: () => Promise<void> } | null>(null)
  const rowIdRef = useRef<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const paramsKeyRef = useRef('')

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const resetTimeout = useCallback(() => {
    clearTimer()
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current && rowIdRef.current) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Timed out waiting for response.',
        }))
      }
    }, TIMEOUT_MS)
  }, [clearTimer])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const key = `${type}:${tripId}:${proposalId ?? ''}`
    if (key === paramsKeyRef.current) return
    paramsKeyRef.current = key

    setState(INITIAL_STATE)
    rowIdRef.current = null
    clearTimer()

    if (subscriptionRef.current) {
      subscriptionRef.current.close().catch(() => {})
      subscriptionRef.current = null
    }

    let cancelled = false

    const channel = Channel.tablesdb(DATABASE_ID)
      .table(LLM_CACHE_TABLE_ID)
      .row()

    const subscribe = async () => {
      const sub = await realtimeRef.current.subscribe(
        channel,
        (response: { payload: LlmCache }) => {
          if (!mountedRef.current) return

          const row = response.payload

          if (type === 'analysis' && row.proposalId !== proposalId) return
          if (row.tripId !== tripId) return
          if (row.type !== type) return

          if (rowIdRef.current && row.$id !== rowIdRef.current) return

          if (!rowIdRef.current) {
            rowIdRef.current = row.$id
          }

          resetTimeout()

          setState((prev) => ({
            status: row.status,
            thinking: row.thinking ?? prev.thinking,
            content: row.content ?? prev.content,
            model: row.model ?? prev.model,
            error:
              row.status === 'error'
                ? (row.content ?? 'An error occurred.')
                : null,
          }))

          if (row.status === 'complete' || row.status === 'error') {
            clearTimer()
          }
        }
      )

      if (cancelled) {
        sub.close().catch(() => {})
        return
      }

      subscriptionRef.current = sub
    }

    subscribe().catch(() => {})

    listRef
      .current(tripId, type)
      .then((rows) => {
        if (!mountedRef.current) return

        const matching = rows.filter((row) => {
          if (type === 'analysis' && row.proposalId !== proposalId) return false
          return true
        })

        const active = matching.find(
          (row) => row.status === 'generating' || row.status === 'complete'
        )

        if (active) {
          if (!rowIdRef.current) {
            rowIdRef.current = active.$id
          }

          if (active.status === 'generating') {
            resetTimeout()
          }

          setState({
            status: active.status,
            thinking: active.thinking ?? '',
            content: active.content ?? '',
            model: active.model ?? '',
            error:
              active.status === 'error'
                ? (active.content ?? 'An error occurred.')
                : null,
          })
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
      clearTimer()
      if (subscriptionRef.current) {
        subscriptionRef.current.close().catch(() => {})
        subscriptionRef.current = null
      }
    }
  }, [type, tripId, proposalId, clearTimer, resetTimeout])

  return state
}
