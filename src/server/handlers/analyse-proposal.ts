import type PocketBase from 'pocketbase'
import { server_get_ollama_model_analysis } from '../env'
import { log, logError } from '../log'
import {
  buildSystemPrompt as buildAnalysisSystemPrompt,
  buildUserPrompt as buildAnalysisUserPrompt,
  computeInputHash as computeAnalysisInputHash,
} from '../logic/analyse-proposal'
import type {
  Accommodation,
  Participant,
  Preferences,
  Proposal,
} from '../types'
import {
  fetchAccommodations,
  fetchParticipants,
  fetchPreferences,
  fetchProposal,
  getAdminClient,
  streamLlmResult,
  verifyParticipantMembership,
  verifyTokenAndGetUserId,
} from './shared'

export async function handleAnalyseProposal(req: Request): Promise<Response> {
  log('[analysis] Received request')
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
    log('[analysis] Missing proposalId or tripId')
    return Response.json(
      { error: 'Missing proposalId or tripId' },
      { status: 400 }
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    log('[analysis] Missing or invalid Authorization header')
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authToken = authHeader.slice(7)

  const userId = await verifyTokenAndGetUserId(authToken)
  if (!userId) {
    log('[analysis] Invalid auth token - verification failed')
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }
  log(`[analysis] Authenticated user ${userId} for proposal ${proposalId}`)

  let adminPb: PocketBase

  try {
    adminPb = await getAdminClient()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Admin auth failed'
    logError(`[analysis] Admin auth failed: ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }

  try {
    await verifyParticipantMembership(adminPb, tripId, userId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Authorization failed'
    log(`[analysis] Participant verification failed: ${msg}`)
    return Response.json({ error: msg }, { status: 403 })
  }

  let proposal: Proposal
  let accommodations: Accommodation[]
  let participants: Participant[]

  try {
    proposal = await fetchProposal(adminPb, proposalId)
    accommodations = await fetchAccommodations(adminPb, proposalId)
    participants = await fetchParticipants(adminPb, tripId)
    log(
      `[analysis] Fetched proposal ${proposalId}, ${participants.length} participants`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch data'
    logError(`[analysis] Failed to fetch data: ${msg}`)
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
  const systemPrompt = buildAnalysisSystemPrompt()
  const userPrompt = buildAnalysisUserPrompt(
    proposal,
    accommodations,
    participantPrefsData
  )

  return streamLlmResult({
    label: 'analysis',
    adminPb,
    inputHash,
    cacheType: 'analysis',
    cacheProposal: proposalId,
    tripId,
    cacheFilter: adminPb.filter('proposal = {:proposalId} && type = {:type}', {
      proposalId,
      type: 'analysis',
    }),
    systemPrompt,
    userPrompt,
    model: server_get_ollama_model_analysis(),
    abortSignal: req.signal,
  })
}
