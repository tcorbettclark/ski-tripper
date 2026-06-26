import type PocketBase from 'pocketbase'
import { server_get_ollama_model_preference_search } from '../env'
import {
  buildSystemPrompt as buildPreferenceSearchSystemPrompt,
  buildUserPrompt as buildPreferenceSearchUserPrompt,
  computeInputHash as computePreferenceSearchInputHash,
} from '../logic/preference-search'
import type { Participant, Preferences } from '../types'
import {
  fetchParticipants,
  fetchPreferences,
  getAdminClient,
  streamLlmResult,
  verifyParticipantMembership,
  verifyTokenAndGetUserId,
} from './shared'

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

  const userId = await verifyTokenAndGetUserId(authToken)
  if (!userId) {
    console.log('[preference-search] Invalid auth token - verification failed')
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

  let participantsRaw: Participant[]

  try {
    participantsRaw = (await fetchParticipants(
      adminPb,
      tripId
    )) as Participant[]
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
    participant: Participant
    preferences: Preferences
  }> = []

  for (const participant of participantsRaw) {
    try {
      const prefs = await fetchPreferences(adminPb, participant.user)
      if (prefs) {
        participantPrefsData.push({
          participant,
          preferences: prefs as unknown as Preferences,
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
  const systemPrompt = buildPreferenceSearchSystemPrompt()
  const userPrompt = buildPreferenceSearchUserPrompt(participantPrefsData)

  return streamLlmResult({
    label: 'preference-search',
    adminPb,
    inputHash,
    cacheType: 'preference-search',
    cacheProposal: null,
    tripId,
    cacheFilter: adminPb.filter('trip = {:tripId} && type = {:type}', {
      tripId,
      type: 'preference-search',
    }),
    systemPrompt,
    userPrompt,
    model: server_get_ollama_model_preference_search(),
    abortSignal: req.signal,
  })
}
