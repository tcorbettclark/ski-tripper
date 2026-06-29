import type PocketBase from 'pocketbase'
import { log, logError } from '../log'
import { getAdminClient, verifyTokenAndGetUserId } from './shared'

export async function handleSetPassword(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let body: { password?: string; passwordConfirm?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { password, passwordConfirm } = body

  if (!password || typeof password !== 'string') {
    return Response.json({ error: 'Password is required' }, { status: 400 })
  }

  if (password.length < 8) {
    return Response.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 }
    )
  }

  if (password !== passwordConfirm) {
    return Response.json({ error: 'Passwords do not match' }, { status: 400 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authToken = authHeader.slice(7)

  const userId = await verifyTokenAndGetUserId(authToken)
  if (!userId) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  let adminPb: PocketBase
  try {
    adminPb = await getAdminClient()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Admin auth failed'
    logError(`[set-password] Admin auth failed: ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }

  try {
    await adminPb.collection('users').update(userId, {
      password,
      passwordConfirm: passwordConfirm as string,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update password'
    logError(`[set-password] Failed for user ${userId}: ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }

  log(`[set-password] Password updated for user ${userId}`)
  return Response.json({ success: true })
}
