import { Ollama } from 'ollama'
import type PocketBase from 'pocketbase'
import {
  server_get_ollama_api_key,
  server_get_ollama_model,
} from '../shared/env'
import {
  type Accommodation,
  buildSystemPrompt as buildAnalysisSystemPrompt,
  buildUserPrompt as buildAnalysisUserPrompt,
  computeInputHash as computeAnalysisInputHash,
  type Participant,
  type Preferences,
  type Proposal,
} from './logic/analyse-proposal'
import {
  buildSystemPrompt as buildPreferenceSearchSystemPrompt,
  buildUserPrompt as buildPreferenceSearchUserPrompt,
  computeInputHash as computePreferenceSearchInputHash,
  type Participant as PSParticipant,
  type Preferences as PSPreferences,
} from './logic/preference-search'
import { extractUserIdFromToken, getAdminClient } from './pocketbase'

function createOllama(): Ollama {
  const ollamaApiKey = server_get_ollama_api_key()
  return new Ollama({
    host: 'https://ollama.com',
    headers: { Authorization: `Bearer ${ollamaApiKey}` },
  })
}

async function verifyParticipantMembership(
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

async function fetchProposal(
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
    summitAltitude: row.summit_altitude as number,
    baseAltitude: row.base_altitude as number,
    pisteKm: row.piste_km as number,
    beginnerPct: row.beginner_pct as number,
    intermediatePct: row.intermediate_pct as number,
    advancedPct: row.advanced_pct as number,
    liftCount: row.lift_count as number,
    snowReliability: row.snow_reliability as Proposal['snowReliability'],
    skiSeasonMonths: row.ski_season_months as string,
    websites: row.websites as string[],
    linkedResortsDescription: row.linked_resorts_description as string,
  }
}

async function fetchAccommodations(
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

async function fetchParticipants(
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

async function fetchPreferences(
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
        await sleep(15 + Math.random() * 25)
      }
    }
    if (buffer) {
      controller.enqueue(sseEvent('thinking', { text: buffer }))
      await sleep(15 + Math.random() * 25)
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
        await sleep(20 + Math.random() * 40)
      }
    }
    if (buffer) {
      controller.enqueue(sseEvent('content', { text: buffer }))
    }
  }

  console.log(`[${label}] Returning cached result (id: ${cacheId})`)
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

export async function handleAnalyseProposal(req: Request): Promise<Response> {
  console.log('[analysis] Received request')
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let body: { proposalId?: string; tripId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { proposalId, tripId } = body
  if (!proposalId || !tripId) {
    console.log('[analysis] Missing proposalId or tripId')
    return Response.json(
      { error: 'Missing proposalId or tripId' },
      { status: 400 }
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[analysis] Missing or invalid Authorization header')
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authToken = authHeader.slice(7)

  const userId = extractUserIdFromToken(authToken)
  if (!userId) {
    console.log('[analysis] Invalid auth token - could not extract user ID')
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }
  console.log(
    `[analysis] Authenticated user ${userId} for proposal ${proposalId}`
  )

  let adminPb: PocketBase

  try {
    adminPb = await getAdminClient()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Admin auth failed'
    console.error(`[analysis] Admin auth failed: ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }

  try {
    await verifyParticipantMembership(adminPb, tripId, userId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Authorization failed'
    console.log(`[analysis] Participant verification failed: ${msg}`)
    return Response.json({ error: msg }, { status: 403 })
  }

  let proposal: Proposal
  let accommodations: Accommodation[]
  let participants: Participant[]

  try {
    proposal = await fetchProposal(adminPb, proposalId)
    accommodations = await fetchAccommodations(adminPb, proposalId)
    participants = await fetchParticipants(adminPb, tripId)
    console.log(
      `[analysis] Fetched proposal ${proposalId}, ${participants.length} participants`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch data'
    console.error(`[analysis] Failed to fetch data: ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }

  const participantPrefsData: Array<{
    participant: Participant
    preferences: Preferences
  }> = []

  for (const participant of participants) {
    try {
      const prefs = await fetchPreferences(adminPb, participant.user)
      if (prefs) {
        participantPrefsData.push({ participant, preferences: prefs })
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to fetch preferences'
      return Response.json({ error: msg }, { status: 500 })
    }
  }

  const inputHash = computeAnalysisInputHash(
    proposal,
    accommodations,
    participantPrefsData
  )

  let cacheRows: LlmCacheRow[]
  try {
    cacheRows = await fetchLlmCache(
      adminPb,
      adminPb.filter('proposal = {:proposalId} && type = {:type}', {
        proposalId,
        type: 'analysis',
      })
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to check cache'
    console.error(`[analysis] Failed to check cache: ${msg}`)
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
          'analysis'
        )
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
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
        `[analysis] Deleted stale cache row ${row.id} (status: ${row.status})`
      )
    } catch {
      // best effort cleanup
    }
  }

  const systemPrompt = buildAnalysisSystemPrompt()
  const userPrompt = buildAnalysisUserPrompt(
    proposal,
    accommodations,
    participantPrefsData
  )

  console.log(`[analysis] Starting LLM stream for proposal ${proposalId}`)
  const ollama = createOllama()

  const stream = new ReadableStream({
    async start(controller) {
      let accumulatedThinking = ''
      let accumulatedContent = ''

      try {
        const llmStream = await ollama.chat({
          model: server_get_ollama_model(),
          stream: true,
          think: true,
          options: { num_predict: 8192 },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        })

        let isThinking = true

        for await (const chunk of llmStream) {
          const thinkPart = (
            chunk.message as unknown as Record<string, unknown>
          ).thinking
          if (typeof thinkPart === 'string' && thinkPart) {
            accumulatedThinking += thinkPart
            isThinking = false
            controller.enqueue(sseEvent('thinking', { text: thinkPart }))
          }

          if (chunk.message.content) {
            if (isThinking) {
              isThinking = false
            }
            accumulatedContent += chunk.message.content
            controller.enqueue(
              sseEvent('content', { text: chunk.message.content })
            )
          }
        }

        const trimmedContent = (accumulatedContent || '').trim()

        console.log(`[analysis] LLM stream complete for proposal ${proposalId}`)

        let cacheId: string
        try {
          const created = await adminPb.collection('llm_cache').create({
            input_hash: inputHash,
            type: 'analysis',
            proposal: proposalId,
            trip: tripId,
            status: 'complete',
            thinking: accumulatedThinking || null,
            content: trimmedContent || null,
            model: server_get_ollama_model(),
          })
          cacheId = created.id
          console.log(
            `[analysis] Cached result for proposal ${proposalId} (id: ${cacheId})`
          )
        } catch (err) {
          cacheId = ''
          console.error(
            `[analysis] Failed to cache result: ${err instanceof Error ? err.message : String(err)}`
          )
        }

        controller.enqueue(
          sseEvent('done', {
            cacheId,
            status: 'complete',
            thinking: accumulatedThinking || null,
            content: trimmedContent || null,
            model: server_get_ollama_model(),
          })
        )
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'LLM generation failed'
        console.error(`[analysis] LLM error: ${errorMsg}`)
        controller.enqueue(sseEvent('error', { message: errorMsg }))
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

export async function handlePreferenceSearch(req: Request): Promise<Response> {
  console.log('[preference-search] Received request')
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let body: { tripId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tripId } = body
  if (!tripId) {
    console.log('[preference-search] Missing tripId')
    return Response.json({ error: 'Missing tripId' }, { status: 400 })
  }

  console.log(`[preference-search] Trip ${tripId}`)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[preference-search] Missing or invalid Authorization header')
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authToken = authHeader.slice(7)

  const userId = extractUserIdFromToken(authToken)
  if (!userId) {
    console.log(
      '[preference-search] Invalid auth token - could not extract user ID'
    )
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }
  console.log(`[preference-search] Authenticated user ${userId}`)

  let adminPb: PocketBase

  try {
    adminPb = await getAdminClient()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Admin auth failed'
    console.error(`[preference-search] Admin auth failed: ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }

  try {
    await verifyParticipantMembership(adminPb, tripId, userId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Authorization failed'
    console.log(`[preference-search] Participant verification failed: ${msg}`)
    return Response.json({ error: msg }, { status: 403 })
  }

  let participantsRaw: PSParticipant[]

  try {
    participantsRaw = (await fetchParticipants(
      adminPb,
      tripId
    )) as PSParticipant[]
    console.log(
      `[preference-search] Fetched ${participantsRaw.length} participants for trip ${tripId}`
    )
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Failed to fetch participants'
    console.error(`[preference-search] Failed to fetch participants: ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }

  const participantPrefsData: Array<{
    participant: PSParticipant
    preferences: PSPreferences
  }> = []

  for (const participant of participantsRaw) {
    try {
      const prefs = await fetchPreferences(adminPb, participant.user)
      if (prefs) {
        participantPrefsData.push({
          participant,
          preferences: prefs as unknown as PSPreferences,
        })
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to fetch preferences'
      return Response.json({ error: msg }, { status: 500 })
    }
  }

  if (participantPrefsData.length === 0) {
    console.log(
      `[preference-search] No participants with preferences for trip ${tripId}`
    )
    return Response.json(
      { error: 'No participants with preferences found' },
      { status: 400 }
    )
  }

  const inputHash = computePreferenceSearchInputHash(participantPrefsData)

  let cacheRows: LlmCacheRow[]
  try {
    cacheRows = await fetchLlmCache(
      adminPb,
      adminPb.filter('trip = {:tripId} && type = {:type}', {
        tripId,
        type: 'preference-search',
      })
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to check cache'
    console.error(`[preference-search] Failed to check cache: ${msg}`)
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
          'preference-search'
        )
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
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
        `[preference-search] Deleted stale cache row ${row.id} (status: ${row.status})`
      )
    } catch {
      // best effort cleanup
    }
  }

  const systemPrompt = buildPreferenceSearchSystemPrompt()
  const userPrompt = buildPreferenceSearchUserPrompt(participantPrefsData)
  console.log(
    `[preference-search] Starting LLM stream for trip ${tripId} with ${participantPrefsData.length} participants`
  )
  const ollama = createOllama()

  const stream = new ReadableStream({
    async start(controller) {
      let accumulatedThinking = ''
      let accumulatedContent = ''

      try {
        const llmStream = await ollama.chat({
          model: server_get_ollama_model(),
          stream: true,
          think: true,
          options: { num_predict: 8192 },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        })

        let isThinking = true

        for await (const chunk of llmStream) {
          const thinkPart = (
            chunk.message as unknown as Record<string, unknown>
          ).thinking
          if (typeof thinkPart === 'string' && thinkPart) {
            accumulatedThinking += thinkPart
            isThinking = false
            controller.enqueue(sseEvent('thinking', { text: thinkPart }))
          }

          if (chunk.message.content) {
            if (isThinking) {
              isThinking = false
            }
            accumulatedContent += chunk.message.content
            controller.enqueue(
              sseEvent('content', { text: chunk.message.content })
            )
          }
        }

        const trimmedContent = (accumulatedContent || '').trim()

        console.log(
          `[preference-search] LLM stream complete for trip ${tripId}`
        )

        let cacheId: string
        try {
          const created = await adminPb.collection('llm_cache').create({
            input_hash: inputHash,
            type: 'preference-search',
            proposal: null,
            trip: tripId,
            status: 'complete',
            thinking: accumulatedThinking || null,
            content: trimmedContent || null,
            model: server_get_ollama_model(),
          })
          cacheId = created.id
          console.log(
            `[preference-search] Cached result for trip ${tripId} (id: ${cacheId})`
          )
        } catch (err) {
          cacheId = ''
          console.error(
            `[preference-search] Failed to cache result: ${err instanceof Error ? err.message : String(err)}`
          )
        }

        controller.enqueue(
          sseEvent('done', {
            cacheId,
            status: 'complete',
            thinking: accumulatedThinking || null,
            content: trimmedContent || null,
            model: server_get_ollama_model(),
          })
        )
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'LLM generation failed'
        console.error(`[preference-search] LLM error: ${errorMsg}`)
        controller.enqueue(sseEvent('error', { message: errorMsg }))
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
