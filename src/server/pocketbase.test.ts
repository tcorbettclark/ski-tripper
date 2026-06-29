import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type PocketBase from 'pocketbase'

const mockAuthRefresh = mock()
const mockAuthStoreSave = mock()
const mockAuthStoreClear = mock()

const mockPbInstance = {
  collection: mock(() => ({
    authRefresh: mockAuthRefresh,
  })),
  authStore: {
    save: mockAuthStoreSave,
    clear: mockAuthStoreClear,
  },
} as unknown as PocketBase

const MockPocketBase = mock(() => mockPbInstance)

mock.module('pocketbase', () => ({
  default: MockPocketBase,
}))

mock.module('./log', () => {
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
  mockAuthRefresh.mockReset()
  mockAuthStoreSave.mockReset()
  mockAuthStoreClear.mockReset()
  MockPocketBase.mockClear()
})

afterEach(async () => {
  process.env = { ...originalEnv }
  const { restoreLogs } = await import('./log')
  restoreLogs()
})

describe('verifyTokenAndGetUserId', () => {
  it('returns user ID when token is valid', async () => {
    const { verifyTokenAndGetUserId } = await import('./pocketbase')

    mockAuthRefresh.mockResolvedValueOnce({
      record: { id: 'user123' },
    })

    const result = await verifyTokenAndGetUserId('valid.jwt.token')
    expect(result).toBe('user123')
    expect(mockAuthStoreSave).toHaveBeenCalledWith('valid.jwt.token', null)
  })

  it('returns null when token is invalid', async () => {
    const { verifyTokenAndGetUserId } = await import('./pocketbase')

    mockAuthRefresh.mockRejectedValueOnce(new Error('Invalid token'))

    const result = await verifyTokenAndGetUserId('invalid.jwt.token')
    expect(result).toBeNull()
    expect(mockAuthStoreClear).toHaveBeenCalled()
  })

  it('returns null when token has wrong format', async () => {
    const { verifyTokenAndGetUserId } = await import('./pocketbase')

    mockAuthRefresh.mockRejectedValueOnce(new Error('Unauthorized'))

    const result = await verifyTokenAndGetUserId('not-a-jwt')
    expect(result).toBeNull()
  })
})
