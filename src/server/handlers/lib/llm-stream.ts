import type { AbortableAsyncIterator, ChatResponse } from 'ollama'
import { Ollama } from 'ollama'
import type PocketBase from 'pocketbase'
import { ClientResponseError } from 'pocketbase'
import { server_get_ollama_api_key } from '../../env'
import { log, logError } from '../../log'

function createOllama(): Ollama {
  const ollamaApiKey = server_get_ollama_api_key()
  return new Ollama({
    host: 'https://ollama.com',
    headers: { Authorization: `Bearer ${ollamaApiKey}` },
  })
}

interface LlmCacheRow {
  id: string
  inputHash: string
  type: string
  proposal: string | null
  trip: string
  status: string
  thinking: string | null
  content: string | null
  model: string
}

async function fetchLlmCache(
  pb: PocketBase,
  filter: string
): Promise<LlmCacheRow[]> {
  const rows = await pb.collection('llm_cache').getFullList({ filter })
  return rows.map((r) => ({
    id: r.id,
    inputHash: r.input_hash as string,
    type: r.type as string,
    proposal: (r.proposal as string) || null,
    trip: r.trip as string,
    status: r.status as string,
    thinking: (r.thinking as string) || null,
    content: (r.content as string) || null,
    model: r.model as string,
  }))
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function streamCachedResponse(
  controller: ReadableStreamDefaultController,
  cacheId: string,
  thinking: string | null,
  content: string | null,
  model: string,
  label: string
): Promise<void> {
  log(`[${label}] Streaming cached result (id: ${cacheId})`)
  if (thinking) {
    const words = thinking.split(/(\s+)/)
    let buffer = ''
    for (const word of words) {
      if (!word) continue
      buffer += word
      if (/\s/.test(word) || buffer.length >= 8) {
        controller.enqueue(sseEvent('thinking', { text: buffer }))
        buffer = ''
        await sleep(8 + Math.random() * 13)
      }
    }
    if (buffer) {
      controller.enqueue(sseEvent('thinking', { text: buffer }))
      await sleep(8 + Math.random() * 13)
    }
  }

  if (content) {
    const trimmed = content.trim()
    const words = trimmed.split(/(\s+)/)
    let buffer = ''
    for (const word of words) {
      if (!word) continue
      buffer += word
      if (/\s/.test(word) || buffer.length >= 8) {
        controller.enqueue(sseEvent('content', { text: buffer }))
        buffer = ''
        await sleep(10 + Math.random() * 20)
      }
    }
    if (buffer) {
      controller.enqueue(sseEvent('content', { text: buffer }))
    }
  }

  log(`[${label}] Completed streaming cached result (id: ${cacheId})`)
  controller.enqueue(
    sseEvent('done', {
      cacheId,
      status: 'complete',
      thinking: thinking || null,
      content: content?.trim() || null,
      model,
    })
  )
  controller.close()
}

const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
}

export interface StreamLlmParams {
  label: string
  adminPb: PocketBase
  inputHash: string
  cacheType: string
  cacheProposal: string | null
  tripId: string
  cacheFilter: string
  systemPrompt: string
  userPrompt: string
  model: string
  abortSignal?: AbortSignal
}

export async function streamLlmResult(
  params: StreamLlmParams
): Promise<Response> {
  const {
    label,
    adminPb,
    inputHash,
    cacheType,
    cacheProposal,
    tripId,
    cacheFilter,
    systemPrompt,
    userPrompt,
    model,
    abortSignal,
  } = params

  let cacheRows: LlmCacheRow[]
  try {
    cacheRows = await fetchLlmCache(adminPb, cacheFilter)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to check cache'
    logError(`[${label}] Failed to check cache: ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }

  const completeRow = cacheRows.find((r) => r.status === 'complete')
  if (completeRow && completeRow.inputHash === inputHash) {
    const stream = new ReadableStream({
      async start(controller) {
        await streamCachedResponse(
          controller,
          completeRow.id,
          completeRow.thinking,
          (completeRow.content || '').trim(),
          completeRow.model,
          label
        )
      },
    })
    return new Response(stream, { headers: SSE_HEADERS })
  }

  const matchingComplete = cacheRows.filter(
    (r) => r.status === 'complete' && r.inputHash === inputHash
  )
  const latestCompleteId = matchingComplete[matchingComplete.length - 1]?.id
  for (const row of cacheRows) {
    if (row.id === latestCompleteId) continue
    try {
      await adminPb.collection('llm_cache').delete(row.id)
      log(
        `[${label}] Deleted stale cache row ${row.id} (status: ${row.status})`
      )
    } catch {
      // best effort cleanup
    }
  }

  const ollama = createOllama()

  const stream = new ReadableStream({
    async start(controller) {
      let accumulatedThinking = ''
      let accumulatedContent = ''
      let clientAborted = false
      let llmStream: AbortableAsyncIterator<ChatResponse> | null = null

      const onClientAbort = () => {
        clientAborted = true
        log(`[${label}] Client disconnected, aborting LLM stream`)
        if (llmStream && 'abort' in llmStream) {
          ;(llmStream as { abort: () => void }).abort()
        }
      }

      if (abortSignal) {
        if (abortSignal.aborted) {
          log(`[${label}] Client already disconnected, skipping LLM call`)
          controller.close()
          return
        }
        abortSignal.addEventListener('abort', onClientAbort, { once: true })
      }

      try {
        const chatStream = await ollama.chat({
          model,
          stream: true,
          think: true,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        })
        llmStream = chatStream

        if (clientAborted) {
          log(`[${label}] Client disconnected before LLM stream started`)
          return
        }

        for await (const chunk of chatStream) {
          if (clientAborted) {
            log(`[${label}] Aborting LLM stream due to client disconnect`)
            break
          }

          const thinkPart = (
            chunk.message as unknown as Record<string, unknown>
          ).thinking
          if (typeof thinkPart === 'string' && thinkPart) {
            accumulatedThinking += thinkPart
            controller.enqueue(sseEvent('thinking', { text: thinkPart }))
          }

          if (chunk.message.content) {
            accumulatedContent += chunk.message.content
            controller.enqueue(
              sseEvent('content', { text: chunk.message.content })
            )
          }
        }

        if (clientAborted) {
          log(`[${label}] Stream aborted, closing without caching`)
          return
        }

        const trimmedContent = (accumulatedContent || '').trim()

        if (!trimmedContent) {
          const message = accumulatedThinking
            ? 'Model thought for too long and produced no visible result. Please try again.'
            : 'Model produced no output. Please try again.'
          logError(
            `[${label}] No content produced (thinking: ${accumulatedThinking.length} chars)`
          )
          controller.enqueue(sseEvent('error', { message }))
          return
        }

        log(`[${label}] LLM stream complete`)

        let cacheId: string
        try {
          const created = await adminPb.collection('llm_cache').create({
            input_hash: inputHash,
            type: cacheType,
            proposal: cacheProposal,
            trip: tripId,
            status: 'complete',
            thinking: accumulatedThinking || null,
            content: trimmedContent || null,
            model,
          })
          cacheId = created.id
          log(`[${label}] Cached result (id: ${cacheId})`)
        } catch (err) {
          cacheId = ''
          const errData =
            err instanceof ClientResponseError
              ? JSON.stringify({ status: err.status, response: err.response })
              : ''
          logError(
            `[${label}] Failed to cache result: ${err instanceof Error ? err.message : String(err)}${errData ? ` (${errData})` : ''}`
          )
        }

        controller.enqueue(
          sseEvent('done', {
            cacheId,
            status: 'complete',
            thinking: accumulatedThinking || null,
            content: trimmedContent || null,
            model,
          })
        )
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'LLM generation failed'
        logError(`[${label}] LLM error: ${errorMsg}`)
        controller.enqueue(sseEvent('error', { message: errorMsg }))
      } finally {
        if (abortSignal) {
          abortSignal.removeEventListener('abort', onClientAbort)
        }
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
