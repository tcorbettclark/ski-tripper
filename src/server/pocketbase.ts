import PocketBase from 'pocketbase'

let adminClient: PocketBase | null = null

export async function getAdminClient(): Promise<PocketBase> {
  if (adminClient?.authStore.isValid) {
    return adminClient
  }

  const url = process.env.POCKETBASE_URL
  if (!url) throw new Error('POCKETBASE_URL env var is required')

  const email = process.env.POCKETBASE_ADMIN_EMAIL
  const password = process.env.POCKETBASE_ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error(
      'POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD env vars are required'
    )
  }

  adminClient = new PocketBase(url)
  await adminClient.collection('_superusers').authWithPassword(email, password)
  return adminClient
}

export function createClient(authToken: string): PocketBase {
  const url = process.env.PUBLIC_POCKETBASE_URL ?? process.env.POCKETBASE_URL
  if (!url) throw new Error('POCKETBASE_URL env var is required')
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
