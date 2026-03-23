import { describe, it, expect, mock, beforeEach } from 'bun:test'

const mockListDocuments = mock(() => Promise.resolve({ documents: [] }))
const mockCreateDocument = mock(() => Promise.resolve({ $id: 'new-id', name: 'New Trip' }))
const mockUpdateDocument = mock(() => Promise.resolve({ $id: '1', name: 'Updated Trip' }))
const mockDeleteDocument = mock(() => Promise.resolve())

mock.module('./appwrite', () => ({
  account: {
    get: mock(() => Promise.resolve({})),
    deleteSession: mock(() => Promise.resolve()),
    createEmailPasswordSession: mock(() => Promise.resolve())
  },
  databases: {
    listDocuments: mockListDocuments,
    createDocument: mockCreateDocument,
    updateDocument: mockUpdateDocument,
    deleteDocument: mockDeleteDocument
  }
}))

const { listTrips, createTrip, updateTrip, deleteTrip } = await import('./database')

beforeEach(() => {
  mockListDocuments.mockClear()
  mockCreateDocument.mockClear()
  mockUpdateDocument.mockClear()
  mockDeleteDocument.mockClear()
})

describe('listTrips', () => {
  it('calls listDocuments and returns documents', async () => {
    mockListDocuments.mockImplementationOnce(() =>
      Promise.resolve({ documents: [{ $id: '1', name: 'Trip 1' }] })
    )
    const result = await listTrips('user-1')
    expect(mockListDocuments).toHaveBeenCalledTimes(1)
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0].name).toBe('Trip 1')
  })

  it('propagates errors', async () => {
    mockListDocuments.mockImplementationOnce(() => Promise.reject(new Error('Network error')))
    await expect(listTrips('user-1')).rejects.toThrow('Network error')
  })
})

describe('createTrip', () => {
  it('checks for code uniqueness before creating', async () => {
    await createTrip('user-1', { name: 'New Trip', description: '' })
    // one listDocuments call for the code check, then one createDocument
    expect(mockListDocuments).toHaveBeenCalledTimes(1)
    expect(mockCreateDocument).toHaveBeenCalledTimes(1)
  })

  it('includes a three-word code in the created document', async () => {
    await createTrip('user-1', { name: 'New Trip' })
    const [, , , data] = mockCreateDocument.mock.calls[0]
    expect(data.code).toMatch(/^\w+-\w+-\w+$/)
  })

  it('retries if the first code is already taken', async () => {
    // first code check: taken; second: free
    mockListDocuments
      .mockImplementationOnce(() => Promise.resolve({ documents: [{ $id: 'x' }] }))
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
    await createTrip('user-1', { name: 'New Trip' })
    expect(mockListDocuments).toHaveBeenCalledTimes(2)
    expect(mockCreateDocument).toHaveBeenCalledTimes(1)
  })

  it('throws after 100 failed attempts', async () => {
    mockListDocuments.mockImplementation(() =>
      Promise.resolve({ documents: [{ $id: 'x' }] })
    )
    await expect(createTrip('user-1', { name: 'New Trip' })).rejects.toThrow(
      'Could not generate a unique trip code after 100 attempts.'
    )
    expect(mockListDocuments).toHaveBeenCalledTimes(100)
    expect(mockCreateDocument).not.toHaveBeenCalled()
    mockListDocuments.mockImplementation(() => Promise.resolve({ documents: [] }))
  })

  it('returns the new trip', async () => {
    const result = await createTrip('user-1', { name: 'New Trip', description: '' })
    expect(result.$id).toBe('new-id')
  })

  it('propagates createDocument errors', async () => {
    mockCreateDocument.mockImplementationOnce(() => Promise.reject(new Error('Create failed')))
    await expect(createTrip('user-1', { name: 'Trip' })).rejects.toThrow('Create failed')
  })
})

describe('updateTrip', () => {
  it('calls updateDocument and returns the updated trip', async () => {
    const result = await updateTrip('trip-1', { name: 'Updated Trip' })
    expect(mockUpdateDocument).toHaveBeenCalledTimes(1)
    expect(result.name).toBe('Updated Trip')
  })

  it('propagates errors', async () => {
    mockUpdateDocument.mockImplementationOnce(() => Promise.reject(new Error('Update failed')))
    await expect(updateTrip('trip-1', {})).rejects.toThrow('Update failed')
  })
})

describe('deleteTrip', () => {
  it('calls deleteDocument with the tripId', async () => {
    await deleteTrip('trip-1')
    expect(mockDeleteDocument).toHaveBeenCalledTimes(1)
  })

  it('propagates errors', async () => {
    mockDeleteDocument.mockImplementationOnce(() => Promise.reject(new Error('Delete failed')))
    await expect(deleteTrip('trip-1')).rejects.toThrow('Delete failed')
  })
})
