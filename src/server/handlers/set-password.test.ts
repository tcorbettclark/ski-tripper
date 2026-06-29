import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type PocketBase from 'pocketbase'

const mockUpdate = mock(() => Promise.resolve({ id: 'user-1' }))
const mockCollection = mock(() => ({ update: mockUpdate }))
const mockAuthRefresh = mock()
const mockAuthStoreSave = mock()
const mockAuthStoreClear = mock()

const mockAdminPbInstance = {
  collection: mockCollection,
  filter: (...args: unknown[]) => args,
} as unknown as PocketBase

const mockVerifyPbInstance = {
  collection: mock(() => ({ authRefresh: mockAuthRefresh })),
  authStore: {
    save: mockAuthStoreSave,
    clear: mockAuthStoreClear,
  },
} as unknown as PocketBase

const MockPocketBase = mock(() => {
  if (MockPocketBase.mock.calls.length === 1) {
    return mockVerifyPbInstance
  }
  return mockAdminPbInstance
})

const mockVerifyTokenAndGetUserId =
  mock<(token: string) => Promise<string | null>>()
const mockGetAdminClient = mock<() => Promise<PocketBase>>()

mock.module('pocketbase', () => ({
  default: MockPocketBase,
}))

mock.module('../pocketbase', () => ({
  verifyTokenAndGetUserId: mockVerifyTokenAndGetUserId,
  getAdminClient: mockGetAdminClient,
}))

mock.module('../env', () => ({
  server_get_ollama_api_key: () => 'test-key',
  server_get_ollama_model_analysis: () => 'test-model',
  server_get_ollama_model_preference_search: () => 'test-model',
}))

mock.module('../log', () => {
  let logs: string[] = []
  let errors: string[] = []
  const captured: { logs: string[]; errors: string[] } = {
    get logs() {
      return logs
    },
    get errors() {
      return errors
    },
  }
  const log = mock((message: string) => {
    logs.push(message)
  })
  const logError = mock((message: string) => {
    errors.push(message)
  })
  const captureLogs = () => {
    logs = []
    errors = []
    return captured
  }
  const restoreLogs = () => {
    logs = []
    errors = []
  }
  return { log, logError, captureLogs, restoreLogs, __captured: captured }
})

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.POCKETBASE_HOSTNAME = 'localhost'
  process.env.POCKETBASE_PORT = '8090'
  process.env.PUBLIC_POCKETBASE_DOMAIN = 'pb.test.local'
  process.env.PUBLIC_EXTERNAL_URL = 'https://test.local'
  mockUpdate.mockReset()
  mockVerifyTokenAndGetUserId.mockReset()
  mockGetAdminClient.mockReset()
  mockAuthRefresh.mockReset()
  mockAuthStoreSave.mockReset()
  mockAuthStoreClear.mockReset()
  MockPocketBase.mockClear()
  mockCollection.mockClear()
})

afterEach(async () => {
  process.env = { ...originalEnv }
  const { restoreLogs } = await import('../log')
  restoreLogs()
})

describe('handleSetPassword', () => {
  async function callHandler(
    body: Record<string, unknown>,
    authToken?: string
  ) {
    const { handleSetPassword } = await import('./set-password')
    const headers = new Headers()
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`)
    }
    const request = new Request('https://test.local/api/set-password', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    return handleSetPassword(request)
  }

  it('returns 405 for non-POST methods', async () => {
    const { handleSetPassword } = await import('./set-password')
    const request = new Request('https://test.local/api/set-password', {
      method: 'GET',
    })
    const response = await handleSetPassword(request)
    expect(response.status).toBe(405)
  })

  it('returns 400 for invalid JSON body', async () => {
    const { handleSetPassword } = await import('./set-password')
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    const request = new Request('https://test.local/api/set-password', {
      method: 'POST',
      headers,
      body: 'not json',
    })
    const response = await handleSetPassword(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const response = await callHandler({ passwordConfirm: 'newpass123' })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/password is required/i)
  })

  it('returns 400 when password is too short', async () => {
    const response = await callHandler({
      password: 'short',
      passwordConfirm: 'short',
    })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/at least 8 characters/i)
  })

  it('returns 400 when passwords do not match', async () => {
    const response = await callHandler({
      password: 'newpass123',
      passwordConfirm: 'different456',
    })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/passwords do not match/i)
  })

  it('returns 401 when authorization header is missing', async () => {
    const response = await callHandler({
      password: 'newpass123',
      passwordConfirm: 'newpass123',
    })
    expect(response.status).toBe(401)
  })

  it('returns 401 when auth token is invalid', async () => {
    mockVerifyTokenAndGetUserId.mockResolvedValueOnce(null)
    const response = await callHandler(
      { password: 'newpass123', passwordConfirm: 'newpass123' },
      'invalid-token'
    )
    expect(response.status).toBe(401)
    expect(mockVerifyTokenAndGetUserId).toHaveBeenCalledWith('invalid-token')
  })

  it('returns 200 and updates password with valid token', async () => {
    mockVerifyTokenAndGetUserId.mockResolvedValueOnce('user-1')
    mockGetAdminClient.mockResolvedValueOnce(mockAdminPbInstance)
    const { captureLogs } = await import('../log')
    const captured = captureLogs()

    const response = await callHandler(
      { password: 'newpass123', passwordConfirm: 'newpass123' },
      'valid-token'
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith('user-1', {
      password: 'newpass123',
      passwordConfirm: 'newpass123',
    })
    expect(captured.logs).toContain(
      '[set-password] Password updated for user user-1'
    )
  })

  it('returns 500 when admin client fails', async () => {
    mockVerifyTokenAndGetUserId.mockResolvedValueOnce('user-1')
    mockGetAdminClient.mockRejectedValueOnce(new Error('Admin auth failed'))
    const { captureLogs } = await import('../log')
    const captured = captureLogs()

    const response = await callHandler(
      { password: 'newpass123', passwordConfirm: 'newpass123' },
      'valid-token'
    )

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toMatch(/admin auth failed/i)
    expect(captured.errors).toContain(
      '[set-password] Admin auth failed: Admin auth failed'
    )
  })

  it('returns 500 when password update fails', async () => {
    mockVerifyTokenAndGetUserId.mockResolvedValueOnce('user-1')
    mockGetAdminClient.mockResolvedValueOnce(mockAdminPbInstance)
    mockUpdate.mockRejectedValueOnce(new Error('Update failed'))
    const { captureLogs } = await import('../log')
    const captured = captureLogs()

    const response = await callHandler(
      { password: 'newpass123', passwordConfirm: 'newpass123' },
      'valid-token'
    )

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toMatch(/update failed/i)
    expect(captured.errors).toContain(
      '[set-password] Failed for user user-1: Update failed'
    )
  })
})
