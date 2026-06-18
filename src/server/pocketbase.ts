import PocketBase from 'pocketbase'
import {
  server_get_pocketbase_admin_email,
  server_get_pocketbase_admin_password,
  server_get_pocketbase_hostname,
  server_get_pocketbase_port,
} from '../shared/env'

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

  console.log(`[pocketbase] Authenticating admin client to ${url}`)
  adminClient = new PocketBase(url)
  await adminClient.collection('_superusers').authWithPassword(email, password)
  console.log('[pocketbase] Admin client authenticated')
  return adminClient
}

export function extractUserIdFromToken(authToken: string): string | null {
  try {
    const parts = authToken.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload.id ?? payload.sub ?? null
  } catch {
    return null
  }
}
