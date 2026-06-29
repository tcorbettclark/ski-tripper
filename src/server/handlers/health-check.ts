import type PocketBase from 'pocketbase'
import { server_get_ollama_model_health_check } from '../env'
import { log, logError } from '../log'
import {
  buildSystemPrompt,
  buildUserPrompt,
  computeInputHash,
} from '../logic/health-check'
import { getAdminClient, verifyTokenAndGetUserId } from './lib/auth'
import { streamLlmResult } from './lib/llm-stream'

const HEALTH_CHECK_TRIP_ID = '__health_check__'

export async function handleHealthCheck(req: Request): Promise<Response> {
  log('[health-check] Received request')
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    log('[health-check] Missing or invalid Authorization header')
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authToken = authHeader.slice(7)

  const userId = await verifyTokenAndGetUserId(authToken)
  if (!userId) {
    log('[health-check] Invalid auth token - verification failed')
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }
  log(`[health-check] Authenticated user ${userId}`)

  let adminPb: PocketBase

  try {
    adminPb = await getAdminClient()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Admin auth failed'
    logError(`[health-check] Admin auth failed: ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }

  try {
    const existingRows = await adminPb.collection('llm_cache').getFullList({
      filter: adminPb.filter('type = {:type}', {
        type: 'health-check',
      }),
    })
    for (const row of existingRows) {
      try {
        await adminPb.collection('llm_cache').delete(row.id)
      } catch {
        // best effort cleanup
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to clear cache'
    logError(`[health-check] Failed to clear cache: ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }

  const model = server_get_ollama_model_health_check()
  const inputHash = computeInputHash(model)
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt()

  return streamLlmResult({
    label: 'health-check',
    adminPb,
    inputHash,
    cacheType: 'health-check',
    cacheProposal: null,
    tripId: HEALTH_CHECK_TRIP_ID,
    cacheFilter: adminPb.filter('type = {:type}', {
      type: 'health-check',
    }),
    systemPrompt,
    userPrompt,
    model,
    abortSignal: req.signal,
  })
}
