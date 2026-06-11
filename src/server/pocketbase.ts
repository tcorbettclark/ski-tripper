import PocketBase from 'pocketbase'
import { requireEnv } from '../shared/env'

let adminClient: PocketBase | null = null

export async function getAdminClient(): Promise<PocketBase> {
  if (adminClient?.authStore.isValid) {
    return adminClient
  }

  const {
    POCKETBASE_URL: url,
    POCKETBASE_ADMIN_EMAIL: email,
    POCKETBASE_ADMIN_PASSWORD: password,
  } = requireEnv(
    'POCKETBASE_URL',
    'POCKETBASE_ADMIN_EMAIL',
    'POCKETBASE_ADMIN_PASSWORD'
  )

  adminClient = new PocketBase(url)
  await adminClient.collection('_superusers').authWithPassword(email, password)
  return adminClient
}

export function createClient(authToken: string): PocketBase {
  const { PUBLIC_POCKETBASE_URL: url } = requireEnv('PUBLIC_POCKETBASE_URL')
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
