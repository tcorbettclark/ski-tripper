import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type PocketBase from 'pocketbase'

const mockDelete = mock(() => Promise.resolve())
const mockGetFullList = mock(() => Promise.resolve([]))
const mockCollection = mock(() => ({
  getFullList: mockGetFullList,
  delete: mockDelete,
}))
const mockFilter = mock((...args: unknown[]) => args)

const mockAdminPbInstance = {
  collection: mockCollection,
  filter: mockFilter,
} as unknown as PocketBase

const mockAuthRefresh = mock()
const mockAuthStoreSave = mock()
const mockAuthStoreClear = mock()

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
const mockStreamLlmResult = mock<() => Promise<Response>>()

mock.module('pocketbase', () => ({
  default: MockPocketBase,
}))

mock.module('../pocketbase', () => ({
  verifyTokenAndGetUserId: mockVerifyTokenAndGetUserId,
  getAdminClient: mockGetAdminClient,
}))

mock.module('../env', () => ({
  server_get_ollama_model_health_check: () => 'test-health-model',
}))

mock.module('./shared', () => ({
  streamLlmResult: mockStreamLlmResult,
  verifyTokenAndGetUserId: mockVerifyTokenAndGetUserId,
  getAdminClient: mockGetAdminClient,
}))

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.POCKETBASE_HOSTNAME = 'localhost'
  process.env.POCKETBASE_PORT = '8090'
  mockVerifyTokenAndGetUserId.mockReset()
  mockGetAdminClient.mockReset()
  mockStreamLlmResult.mockReset()
  mockGetFullList.mockReset().mockResolvedValue([])
  mockDelete.mockReset().mockResolvedValue(undefined)
  mockCollection.mockClear()
  mockFilter.mockClear()
  MockPocketBase.mockClear()
  mockAuthRefresh.mockReset()
  mockAuthStoreSave.mockReset()
  mockAuthStoreClear.mockReset()
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('handleHealthCheck', () => {
  async function callHandler(authToken?: string) {
    const { handleHealthCheck } = await import('./health-check')
    const headers = new Headers()
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`)
    }
    const request = new Request('https://test.local/api/health-check', {
      method: 'POST',
      headers,
    })
    return handleHealthCheck(request)
  }

  it('returns 405 for non-POST methods', async () => {
    const { handleHealthCheck } = await import('./health-check')
    const request = new Request('https://test.local/api/health-check', {
      method: 'GET',
    })
    const response = await handleHealthCheck(request)
    expect(response.status).toBe(405)
    const data = await response.json()
    expect(data.error).toMatch(/method not allowed/i)
  })

  it('returns 401 when authorization header is missing', async () => {
    const response = await callHandler()
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toMatch(/unauthorized/i)
  })

  it('returns 401 when auth token is invalid', async () => {
    mockVerifyTokenAndGetUserId.mockResolvedValueOnce(null)
    const response = await callHandler('invalid-token')
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toMatch(/invalid token/i)
  })

  it('returns 500 when admin client fails', async () => {
    mockVerifyTokenAndGetUserId.mockResolvedValueOnce('user-1')
    mockGetAdminClient.mockRejectedValueOnce(new Error('Admin auth failed'))
    const errorSpy = mock(() => {})
    const originalError = console.error
    console.error = errorSpy

    const response = await callHandler('valid-token')

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toMatch(/admin auth failed/i)
    console.error = originalError
  })

  it('clears health-check cache and calls streamLlmResult with correct params', async () => {
    mockVerifyTokenAndGetUserId.mockResolvedValueOnce('user-1')
    mockGetAdminClient.mockResolvedValueOnce(mockAdminPbInstance)
    const fakeResponse = new Response('stream', { status: 200 })
    mockStreamLlmResult.mockResolvedValueOnce(fakeResponse)

    const response = await callHandler('valid-token')

    expect(response).toBe(fakeResponse)
    expect(mockGetFullList).toHaveBeenCalled()
    expect(mockStreamLlmResult).toHaveBeenCalledTimes(1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = (mockStreamLlmResult.mock.calls[0] as any[])[0] as {
      label: string
      cacheType: string
      cacheProposal: string | null
      tripId: string
      systemPrompt: string
      userPrompt: string
      model: string
      abortSignal: AbortSignal
    }
    expect(callArgs.label).toBe('health-check')
    expect(callArgs.cacheType).toBe('health-check')
    expect(callArgs.cacheProposal).toBeNull()
    expect(callArgs.tripId).toBe('__health_check__')
    expect(callArgs.systemPrompt).toBe('You are a helpful assistant.')
    expect(callArgs.userPrompt).toBe('Say hello in one sentence.')
    expect(callArgs.model).toBe('test-health-model')
    expect(callArgs.abortSignal).toBeDefined()
  })
})
