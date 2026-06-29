import PocketBase from 'pocketbase'
import {
  server_get_pocketbase_admin_email,
  server_get_pocketbase_admin_password,
  server_get_pocketbase_hostname,
  server_get_pocketbase_port,
} from './env'
import { log } from './log'

let adminClient: PocketBase | null = null

export async function getAdminClient(): Promise<PocketBase> {
  if (adminClient?.authStore.isValid) {
    return adminClient
  }

  const hostname = server_get_pocketbase_hostname()
  const port = server_get_pocketbase_port()
  const url = `http://${hostname}:${port}`
  const email = server_get_pocketbase_admin_email()
  const password = server_get_pocketbase_admin_password()

  log(`[pocketbase] Authenticating admin client to ${url}`)
  adminClient = new PocketBase(url)
  await adminClient.collection('_superusers').authWithPassword(email, password)
  log('[pocketbase] Admin client authenticated')
  return adminClient
}

export async function verifyTokenAndGetUserId(
  authToken: string
): Promise<string | null> {
  const hostname = server_get_pocketbase_hostname()
  const port = server_get_pocketbase_port()
  const url = `http://${hostname}:${port}`

  const pb = new PocketBase(url)
  pb.authStore.save(authToken, null)

  try {
    const authResponse = await pb.collection('users').authRefresh()
    return authResponse.record.id
  } catch {
    pb.authStore.clear()
    return null
  }
}
