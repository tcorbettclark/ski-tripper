import type { AbortableAsyncIterator, ChatResponse } from 'ollama'
import { Ollama } from 'ollama'
import type PocketBase from 'pocketbase'
import { ClientResponseError } from 'pocketbase'
import { server_get_ollama_api_key } from '../env'
import { getAdminClient, verifyTokenAndGetUserId } from '../pocketbase'
import type {
  Accommodation,
  Participant,
  Preferences,
  Proposal,
} from '../types'

export { getAdminClient, verifyTokenAndGetUserId }

function createOllama(): Ollama {
  const ollamaApiKey = server_get_ollama_api_key()
  return new Ollama({
    host: 'https://ollama.com',
    headers: { Authorization: `Bearer ${ollamaApiKey}` },
  })
}

export async function verifyParticipantMembership(
  pb: PocketBase,
  tripId: string,
  userId: string
): Promise<void> {
  const rows = await pb.collection('participants').getFullList({
    filter: pb.filter('trip = {:tripId} && user = {:userId}', {
      tripId,
      userId,
    }),
  })
  if (rows.length === 0) {
    throw new Error('You must be a participant of this trip.')
  }
  console.log(`[auth] User ${userId} verified as participant of trip ${tripId}`)
}

export async function fetchProposal(
  pb: PocketBase,
  proposalId: string
): Promise<Proposal> {
  const row = await pb.collection('proposals').getOne(proposalId)
  return {
    id: row.id,
    updated: row.updated as string,
    proposer: row.proposer as string,
    proposerUserName: row.proposer_name as string,
    trip: row.trip as string,
    state: (row.state as string).toUpperCase() as Proposal['state'],
    description: row.description as string,
    resortName: row.resort_name as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    nearestAirport: row.nearest_airport as string,
    transferTime: row.transfer_time as number | null,
    country: row.country as string,
    region: row.region as string,
    summitAltitude: (row.summit_altitude as number) ?? 0,
    baseAltitude: (row.base_altitude as number) ?? 0,
    pisteKm: (row.piste_km as number) ?? 0,
    beginnerPct: (row.beginner_pct as number) ?? 0,
    intermediatePct: (row.intermediate_pct as number) ?? 0,
    advancedPct: (row.advanced_pct as number) ?? 0,
    liftCount: (row.lift_count as number) ?? 0,
    snowReliability: row.snow_reliability as Proposal['snowReliability'],
    skiSeasonMonths: row.ski_season_months as string,
    websites: row.websites as string[],
    linkedResortsDescription: row.linked_resorts_description as string,
  }
}

export async function fetchAccommodations(
  pb: PocketBase,
  proposalId: string
): Promise<Accommodation[]> {
  const rows = await pb.collection('accommodations').getFullList({
    filter: pb.filter('proposal = {:proposalId}', { proposalId }),
  })
  return rows.map((r) => ({
    id: r.id,
    proposal: r.proposal as string,
    name: r.name as string,
    url: r.url as string,
    cost: r.cost as string,
    description: r.description as string,
  }))
}

export async function fetchParticipants(
  pb: PocketBase,
  tripId: string
): Promise<Participant[]> {
  const rows = await pb.collection('participants').getFullList({
    filter: pb.filter('trip = {:tripId}', { tripId }),
  })
  return rows.map((r) => ({
    id: r.id,
    user: r.user as string,
    userName: r.name as string,
    trip: r.trip as string,
    role: r.role as Participant['role'],
  }))
}

export async function fetchPreferences(
  pb: PocketBase,
  userId: string
): Promise<Preferences | null> {
  const rows = await pb.collection('preferences').getFullList({
    filter: pb.filter('user = {:userId}', { userId }),
  })
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    id: r.id,
    user: r.user as string,
    skiSnowboard: r.ski_snowboard as string[],
    difficulty: r.difficulty as string[],
    piste: r.piste as string[],
    timeSlopes: r.time_slopes as number,
    timeEating: r.time_eating as number,
    timeApres: r.time_apres as number,
    timeHotel: r.time_hotel as number,
    accommodation: r.accommodation as string[],
    notes: r.notes as string,
  }
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
  console.log(`[${label}] Streaming cached result (id: ${cacheId})`)
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

  console.log(`[${label}] Completed streaming cached result (id: ${cacheId})`)
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
    console.error(`[${label}] Failed to check cache: ${msg}`)
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
      console.log(
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
        console.log(`[${label}] Client disconnected, aborting LLM stream`)
        if (llmStream && 'abort' in llmStream) {
          ;(llmStream as { abort: () => void }).abort()
        }
      }

      if (abortSignal) {
        if (abortSignal.aborted) {
          console.log(
            `[${label}] Client already disconnected, skipping LLM call`
          )
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
          console.log(
            `[${label}] Client disconnected before LLM stream started`
          )
          return
        }

        for await (const chunk of chatStream) {
          if (clientAborted) {
            console.log(
              `[${label}] Aborting LLM stream due to client disconnect`
            )
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
          console.log(`[${label}] Stream aborted, closing without caching`)
          return
        }

        const trimmedContent = (accumulatedContent || '').trim()

        if (!trimmedContent) {
          const message = accumulatedThinking
            ? 'Model thought for too long and produced no visible result. Please try again.'
            : 'Model produced no output. Please try again.'
          console.error(
            `[${label}] No content produced (thinking: ${accumulatedThinking.length} chars)`
          )
          controller.enqueue(sseEvent('error', { message }))
          return
        }

        console.log(`[${label}] LLM stream complete`)

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
          console.log(`[${label}] Cached result (id: ${cacheId})`)
        } catch (err) {
          cacheId = ''
          const errData =
            err instanceof ClientResponseError
              ? JSON.stringify({ status: err.status, response: err.response })
              : ''
          console.error(
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
        console.error(`[${label}] LLM error: ${errorMsg}`)
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
