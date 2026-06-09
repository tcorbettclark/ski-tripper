import { Client, ID, Permission, Query, Role, TablesDB } from 'node-appwrite'
import { Ollama } from 'ollama'
import {
  type Accommodation,
  buildSystemPrompt,
  buildUserPrompt,
  computeInputHash,
  type LlmCacheRow,
  type Participant,
  type Preferences,
  type Proposal,
} from './logic'

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID as string
const PROPOSALS_TABLE_ID = process.env.APPWRITE_PROPOSALS_TABLE_ID as string
const ACCOMMODATIONS_TABLE_ID = process.env
  .APPWRITE_ACCOMMODATIONS_TABLE_ID as string
const PARTICIPANTS_TABLE_ID = process.env
  .APPWRITE_PARTICIPANTS_TABLE_ID as string
const PREFERENCES_TABLE_ID = process.env.APPWRITE_PREFERENCES_TABLE_ID as string
const LLM_CACHE_TABLE_ID = process.env.APPWRITE_LLM_CACHE_TABLE_ID as string

const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'kimi-k2.6:cloud'

function createClient(): Client {
  return new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT as string)
    .setProject(process.env.APPWRITE_PROJECT_ID as string)
    .setKey(process.env.APPWRITE_API_KEY as string)
}

function createOllama(): Ollama {
  return new Ollama({
    host: 'https://ollama.com',
    headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
  })
}

async function fetchProposal(
  db: TablesDB,
  proposalId: string
): Promise<Proposal> {
  const row = await db.getRow({
    databaseId: DATABASE_ID,
    tableId: PROPOSALS_TABLE_ID,
    rowId: proposalId,
  })
  return row as unknown as Proposal
}

async function fetchAccommodations(
  db: TablesDB,
  proposalId: string
): Promise<Accommodation[]> {
  const result = await db.listRows({
    databaseId: DATABASE_ID,
    tableId: ACCOMMODATIONS_TABLE_ID,
    queries: [Query.equal('proposalId', proposalId), Query.limit(100)],
  })
  return result.rows as unknown as Accommodation[]
}

async function fetchParticipants(
  db: TablesDB,
  tripId: string
): Promise<Participant[]> {
  const result = await db.listRows({
    databaseId: DATABASE_ID,
    tableId: PARTICIPANTS_TABLE_ID,
    queries: [Query.equal('tripId', tripId), Query.limit(100)],
  })
  return result.rows as unknown as Participant[]
}

async function fetchPreferences(
  db: TablesDB,
  userId: string
): Promise<Preferences | null> {
  const result = await db.listRows({
    databaseId: DATABASE_ID,
    tableId: PREFERENCES_TABLE_ID,
    queries: [Query.equal('userId', userId), Query.limit(1)],
  })
  const rows = result.rows as unknown as Preferences[]
  return rows.length > 0 ? rows[0] : null
}

async function fetchLlmCache(
  db: TablesDB,
  proposalId: string
): Promise<LlmCacheRow[]> {
  const result = await db.listRows({
    databaseId: DATABASE_ID,
    tableId: LLM_CACHE_TABLE_ID,
    queries: [
      Query.equal('proposalId', proposalId),
      Query.equal('type', 'analysis'),
      Query.limit(10),
    ],
  })
  return result.rows as unknown as LlmCacheRow[]
}

async function createLlmCacheRow(
  db: TablesDB,
  data: Omit<LlmCacheRow, '$id'>
): Promise<LlmCacheRow> {
  const row = await db.createRow({
    databaseId: DATABASE_ID,
    tableId: LLM_CACHE_TABLE_ID,
    rowId: ID.unique(),
    data: data as unknown as Record<string, unknown>,
    permissions: [Permission.read(Role.users())],
  })
  return row as unknown as LlmCacheRow
}

async function updateLlmCacheRow(
  db: TablesDB,
  rowId: string,
  data: Partial<LlmCacheRow>
): Promise<LlmCacheRow> {
  const row = await db.updateRow({
    databaseId: DATABASE_ID,
    tableId: LLM_CACHE_TABLE_ID,
    rowId,
    data: data as unknown as Record<string, unknown>,
  })
  return row as unknown as LlmCacheRow
}

async function deleteLlmCacheRow(db: TablesDB, rowId: string): Promise<void> {
  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: LLM_CACHE_TABLE_ID,
    rowId,
  })
}

export default async function handler({
  req,
  res,
  log,
  error,
}: {
  req: {
    body: string
    bodyJson: Record<string, unknown> | undefined
    headers: Record<string, string>
    method: string
    path: string
    query: Record<string, string>
    queryString: string
  }
  res: {
    json: (data: unknown, status?: number) => unknown
    text: (data: string, status?: number) => unknown
    empty: () => unknown
    send: (
      data: string,
      status?: number,
      headers?: Record<string, string>
    ) => unknown
    redirect: (url: string) => unknown
  }
  log: (message: string) => void
  error: (message: string) => void
}): Promise<unknown> {
  if (req.method !== 'POST') {
    return res.json({ error: 'Method not allowed' }, 405)
  }

  const data = req.bodyJson
  const proposalId = data?.proposalId as string | undefined
  const tripId = data?.tripId as string | undefined

  if (!proposalId || !tripId) {
    return res.json({ error: 'Missing proposalId or tripId' }, 400)
  }

  log(`Analysing proposal ${proposalId} for trip ${tripId}`)

  const client = createClient()
  const db = new TablesDB(client)
  const ollama = createOllama()

  let proposal: Proposal
  let accommodations: Accommodation[]
  let participants: Participant[]

  try {
    proposal = await fetchProposal(db, proposalId)
    accommodations = await fetchAccommodations(db, proposalId)
    participants = await fetchParticipants(db, tripId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch data'
    error(msg)
    return res.json({ error: msg }, 500)
  }

  const participantPrefsData: Array<{
    participant: Participant
    preferences: Preferences
  }> = []

  for (const participant of participants) {
    try {
      const prefs = await fetchPreferences(db, participant.participantUserId)
      if (prefs) {
        participantPrefsData.push({ participant, preferences: prefs })
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to fetch preferences'
      error(msg)
      return res.json({ error: msg }, 500)
    }
  }

  const inputHash = computeInputHash(
    proposal,
    accommodations,
    participantPrefsData
  )
  log(`Computed inputHash: ${inputHash}`)

  let cacheRows: LlmCacheRow[]
  try {
    cacheRows = await fetchLlmCache(db, proposalId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to check cache'
    error(msg)
    return res.json({ error: msg }, 500)
  }

  const generatingRow = cacheRows.find((r) => r.status === 'generating')
  if (generatingRow) {
    log('Another invocation is already generating, returning success')
    return res.json({ success: true })
  }

  const completeRow = cacheRows.find((r) => r.status === 'complete')
  if (completeRow && completeRow.inputHash === inputHash) {
    log('Cache hit with matching inputHash, returning success')
    return res.json({ success: true })
  }

  if (completeRow && completeRow.inputHash !== inputHash) {
    log('Stale cache entry found, deleting')
    try {
      await deleteLlmCacheRow(db, completeRow.$id)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to delete stale cache'
      error(msg)
      return res.json({ error: msg }, 500)
    }
  }

  const errorRow = cacheRows.find((r) => r.status === 'error')
  if (errorRow) {
    log('Error cache entry found, deleting')
    try {
      await deleteLlmCacheRow(db, errorRow.$id)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to delete error cache'
      error(msg)
      return res.json({ error: msg }, 500)
    }
  }

  let cacheRow: LlmCacheRow
  try {
    cacheRow = await createLlmCacheRow(db, {
      inputHash,
      type: 'analysis',
      proposalId,
      tripId,
      status: 'generating',
      thinking: null,
      content: null,
      model: OLLAMA_MODEL,
    })
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Failed to create cache row'
    error(msg)
    return res.json({ error: msg }, 500)
  }

  log(`Created cache row ${cacheRow.$id}, starting LLM generation`)

  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(
    proposal,
    accommodations,
    participantPrefsData
  )

  let accumulatedThinking = ''
  let accumulatedContent = ''
  let lastUpdateTime = Date.now()
  const UPDATE_INTERVAL_MS = 500

  async function flushToDb(): Promise<void> {
    try {
      await updateLlmCacheRow(db, cacheRow.$id, {
        thinking: accumulatedThinking || null,
        content: accumulatedContent || null,
      } as Partial<LlmCacheRow>)
      lastUpdateTime = Date.now()
    } catch (err) {
      error(
        `Failed to update cache row: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  try {
    const stream = await ollama.chat({
      model: OLLAMA_MODEL,
      stream: true,
      think: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    let isThinking = true

    for await (const chunk of stream) {
      const thinkPart = (chunk.message as unknown as Record<string, unknown>)
        .thinking
      if (typeof thinkPart === 'string' && thinkPart) {
        accumulatedThinking += thinkPart
        isThinking = false
      }

      if (chunk.message.content) {
        if (isThinking) {
          isThinking = false
        }
        accumulatedContent += chunk.message.content
      }

      const now = Date.now()
      if (now - lastUpdateTime >= UPDATE_INTERVAL_MS) {
        await flushToDb()
      }
    }

    await flushToDb()

    await updateLlmCacheRow(db, cacheRow.$id, {
      status: 'complete',
      thinking: accumulatedThinking || null,
      content: accumulatedContent || null,
    } as Partial<LlmCacheRow>)

    log('Analysis complete')
    return res.json({ success: true })
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : 'LLM generation failed'

    try {
      await updateLlmCacheRow(db, cacheRow.$id, {
        status: 'error',
        content: errorMsg,
      } as Partial<LlmCacheRow>)
    } catch (updateErr) {
      error(
        `Failed to update cache row on error: ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`
      )
    }

    error(errorMsg)
    return res.json({ error: errorMsg }, 500)
  }
}
