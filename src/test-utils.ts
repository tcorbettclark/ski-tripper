import { mock } from 'bun:test'
import type PocketBase from 'pocketbase'

export function createStrictMockClient(): PocketBase {
  const collections: Record<
    string,
    Record<string, ReturnType<typeof mock>>
  > = {}
  const collectionNames = [
    'trips',
    'participants',
    'proposals',
    'accommodations',
    'polls',
    'votes',
    'preferences',
    'discussion',
    'resorts',
    'users',
  ]
  for (const name of collectionNames) {
    collections[name] = {
      getFullList: mock(() => {
        throw new Error('FORGOT TO MOCK: getFullList()')
      }),
      getOne: mock(() => {
        throw new Error('FORGOT TO MOCK: getOne()')
      }),
      create: mock(() => {
        throw new Error('FORGOT TO MOCK: create()')
      }),
      update: mock(() => {
        throw new Error('FORGOT TO MOCK: update()')
      }),
      delete: mock(() => {
        throw new Error('FORGOT TO MOCK: delete()')
      }),
      authWithPassword: mock(() => {
        throw new Error('FORGOT TO MOCK: authWithPassword()')
      }),
      requestPasswordReset: mock(() => {
        throw new Error('FORGOT TO MOCK: requestPasswordReset()')
      }),
      confirmPasswordReset: mock(() => {
        throw new Error('FORGOT TO MOCK: confirmPasswordReset()')
      }),
      requestVerification: mock(() => {
        throw new Error('FORGOT TO MOCK: requestVerification()')
      }),
      confirmVerification: mock(() => {
        throw new Error('FORGOT TO MOCK: confirmVerification()')
      }),
    }
  }

  const authStoreListeners: Array<(token: string, record: unknown) => void> = []

  return {
    collection: (name: string) => collections[name],
    filter: (template: string, params: Record<string, unknown>) => {
      let result = template
      for (const [key, value] of Object.entries(params)) {
        result = result.replace(`{:${key}}`, String(value))
      }
      return result
    },
    authStore: {
      record: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        verified: true,
      },
      token: 'test-token',
      isValid: true,
      isSuperuser: false,
      clear: mock(() => {
        for (const fn of authStoreListeners) {
          fn('', null)
        }
      }),
      save: mock(() => {}),
      onChange: mock(
        (
          callback: (token: string, record: unknown) => void,
          _fireImmediately?: boolean
        ) => {
          authStoreListeners.push(callback)
          return () => {
            const index = authStoreListeners.indexOf(callback)
            if (index > -1) authStoreListeners.splice(index, 1)
          }
        }
      ),
    },
  } as unknown as PocketBase
}
