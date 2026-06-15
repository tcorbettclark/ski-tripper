import PocketBase from 'pocketbase'
import {
  server_get_pocketbase_admin_email,
  server_get_pocketbase_admin_password,
  server_get_pocketbase_url,
  server_get_public_pocketbase_url,
} from '../shared/env'

let adminClient: PocketBase | null = null

export async function getAdminClient(): Promise<PocketBase> {
  if (adminClient?.authStore.isValid) {
    return adminClient
  }

  const url = server_get_pocketbase_url()
  const email = server_get_pocketbase_admin_email()
  const password = server_get_pocketbase_admin_password()

  adminClient = new PocketBase(url)
  await adminClient.collection('_superusers').authWithPassword(email, password)
  return adminClient
}

export function createClient(authToken: string): PocketBase {
  const url = server_get_public_pocketbase_url()
  const client = new PocketBase(url)
  client.authStore.save(authToken, {
    id: '',
    email: '',
    name: '',
    collectionId: '',
    collectionName: '',
  })
  return client
}
