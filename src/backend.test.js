import { describe, it, expect, mock } from 'bun:test'
import {
  listTrips,
  getTrip,
  getTripByCode,
  createTrip,
  updateTrip,
  deleteTrip,
  joinTrip,
  listParticipatedTrips,
  leaveTrip,
  getUserById
} from './backend'

function makeDb (overrides = {}) {
  return {
    listDocuments: mock(() => Promise.resolve({ documents: [] })),
    createDocument: mock(() => Promise.resolve({ $id: 'new-id', name: 'New Trip' })),
    updateDocument: mock(() => Promise.resolve({ $id: '1', name: 'Updated Trip' })),
    deleteDocument: mock(() => Promise.resolve()),
    getDocument: mock(() => Promise.resolve({ $id: 'trip-1', name: 'Ski Alps' })),
    ...overrides
  }
}

describe('listTrips', () => {
  it('returns documents and coordinatorUserIds from participant query', async () => {
    const listDocuments = mock()
    listDocuments
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'p-1', userId: 'user-1', tripId: 'trip-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'trip-1', name: 'Trip 1' }] })
      )
    const db = makeDb({ listDocuments })
    const result = await listTrips('user-1', db)
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0].name).toBe('Trip 1')
    expect(result.coordinatorUserIds).toEqual({ 'trip-1': 'user-1' })
  })

  it('returns empty when user has no coordinated trips', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.resolve({ documents: [] }))
    })
    const result = await listTrips('user-1', db)
    expect(result.documents).toHaveLength(0)
    expect(result.coordinatorUserIds).toEqual({})
  })

  it('propagates errors', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.reject(new Error('Network error')))
    })
    await expect(listTrips('user-1', db)).rejects.toThrow('Network error')
  })
})

describe('getTrip', () => {
  it('calls getDocument with the trip id', async () => {
    const db = makeDb()
    await getTrip('trip-1', db)
    expect(db.getDocument).toHaveBeenCalledTimes(1)
    const [, , tripId] = db.getDocument.mock.calls[0]
    expect(tripId).toBe('trip-1')
  })

  it('returns the trip document', async () => {
    const db = makeDb()
    const result = await getTrip('trip-1', db)
    expect(result.$id).toBe('trip-1')
    expect(result.name).toBe('Ski Alps')
  })

  it('propagates errors', async () => {
    const db = makeDb({
      getDocument: mock(() => Promise.reject(new Error('Not found')))
    })
    await expect(getTrip('trip-1', db)).rejects.toThrow('Not found')
  })
})

describe('getTripByCode', () => {
  it('calls listDocuments with a code filter', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.resolve({ documents: [{ $id: 'trip-1', code: 'abc-def-ghi' }] }))
    })
    const result = await getTripByCode('abc-def-ghi', db)
    expect(db.listDocuments).toHaveBeenCalledTimes(1)
    expect(result.documents[0].code).toBe('abc-def-ghi')
  })

  it('returns empty documents when code is not found', async () => {
    const db = makeDb()
    const result = await getTripByCode('unknown-code', db)
    expect(result.documents).toHaveLength(0)
  })

  it('propagates errors', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.reject(new Error('Network error')))
    })
    await expect(getTripByCode('abc-def-ghi', db)).rejects.toThrow('Network error')
  })
})

describe('createTrip', () => {
  it('checks for code uniqueness before creating', async () => {
    const db = makeDb()
    await createTrip('user-1', { name: 'New Trip', description: '' }, db)
    // one listDocuments call for the code check, then two createDocument calls (trip + participant)
    expect(db.listDocuments).toHaveBeenCalledTimes(1)
    expect(db.createDocument).toHaveBeenCalledTimes(2)
  })

  it('includes a three-word code in the created document', async () => {
    const db = makeDb()
    await createTrip('user-1', { name: 'New Trip' }, db)
    const [, , , data] = db.createDocument.mock.calls[0]
    expect(data.code).toMatch(/^\w+-\w+-\w+$/)
  })

  it('generates a lowercase code', async () => {
    const db = makeDb()
    await createTrip('user-1', { name: 'New Trip' }, db)
    const [, , , data] = db.createDocument.mock.calls[0]
    expect(data.code).toBe(data.code.toLowerCase())
  })

  it('retries if the first code is already taken', async () => {
    const listDocuments = mock()
    listDocuments
      .mockImplementationOnce(() => Promise.resolve({ documents: [{ $id: 'x' }] }))
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
    const db = makeDb({ listDocuments })
    await createTrip('user-1', { name: 'New Trip' }, db)
    expect(db.listDocuments).toHaveBeenCalledTimes(2)
    expect(db.createDocument).toHaveBeenCalledTimes(2)
  })

  it('throws after 100 failed attempts', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.resolve({ documents: [{ $id: 'x' }] }))
    })
    await expect(createTrip('user-1', { name: 'New Trip' }, db)).rejects.toThrow(
      'Could not generate a unique trip code after 100 attempts.'
    )
    expect(db.listDocuments).toHaveBeenCalledTimes(100)
    expect(db.createDocument).not.toHaveBeenCalled()
  })

  it('returns the new trip', async () => {
    const db = makeDb()
    const result = await createTrip('user-1', { name: 'New Trip', description: '' }, db)
    expect(result.$id).toBe('new-id')
  })

  it('creates the initial participant with role coordinator', async () => {
    const db = makeDb()
    await createTrip('user-1', { name: 'New Trip' }, db)
    const participantData = db.createDocument.mock.calls[1][3]
    expect(participantData.role).toBe('coordinator')
    expect(participantData.userId).toBe('user-1')
  })

  it('propagates createDocument errors', async () => {
    const db = makeDb({
      createDocument: mock(() => Promise.reject(new Error('Create failed')))
    })
    await expect(createTrip('user-1', { name: 'Trip' }, db)).rejects.toThrow('Create failed')
  })
})

describe('updateTrip', () => {
  it('calls updateDocument and returns the updated trip when caller is coordinator', async () => {
    const db = makeDb({
      listDocuments: mock(() =>
        Promise.resolve({ documents: [{ $id: 'p-1', userId: 'user-1' }] })
      )
    })
    const result = await updateTrip('trip-1', { name: 'Updated Trip' }, 'user-1', db)
    expect(db.updateDocument).toHaveBeenCalledTimes(1)
    expect(result.name).toBe('Updated Trip')
  })

  it('throws when the caller is not the coordinator', async () => {
    const db = makeDb({
      listDocuments: mock(() =>
        Promise.resolve({ documents: [{ $id: 'p-1', userId: 'other-user' }] })
      )
    })
    await expect(updateTrip('trip-1', {}, 'user-1', db)).rejects.toThrow('Only the coordinator can edit this trip.')
  })

  it('throws when there is no coordinator for the trip', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.resolve({ documents: [] }))
    })
    await expect(updateTrip('trip-1', {}, 'user-1', db)).rejects.toThrow('Only the coordinator can edit this trip.')
  })

  it('propagates errors', async () => {
    const db = makeDb({
      listDocuments: mock(() =>
        Promise.resolve({ documents: [{ $id: 'p-1', userId: 'user-1' }] })
      ),
      updateDocument: mock(() => Promise.reject(new Error('Update failed')))
    })
    await expect(updateTrip('trip-1', {}, 'user-1', db)).rejects.toThrow('Update failed')
  })
})

describe('joinTrip', () => {
  it('creates a participation record with role participant when none exists', async () => {
    const db = makeDb()
    await joinTrip('user-1', 'trip-1', db)
    expect(db.createDocument).toHaveBeenCalledTimes(1)
    const participantData = db.createDocument.mock.calls[0][3]
    expect(participantData.role).toBe('participant')
  })

  it('throws when the user has already joined the trip', async () => {
    const db = makeDb({
      listDocuments: mock(() =>
        Promise.resolve({ documents: [{ $id: 'p-1', userId: 'user-1', tripId: 'trip-1' }] })
      )
    })
    await expect(joinTrip('user-1', 'trip-1', db)).rejects.toThrow('You have already joined this trip.')
    expect(db.createDocument).not.toHaveBeenCalled()
  })
})

describe('leaveTrip', () => {
  it('deletes the participation record when it exists', async () => {
    const db = makeDb({
      listDocuments: mock(() =>
        Promise.resolve({ documents: [{ $id: 'p-1', userId: 'user-1', tripId: 'trip-1' }] })
      )
    })
    await leaveTrip('user-1', 'trip-1', db)
    expect(db.deleteDocument).toHaveBeenCalledTimes(1)
    const [, , deletedId] = db.deleteDocument.mock.calls[0]
    expect(deletedId).toBe('p-1')
  })

  it('throws when no participation record is found', async () => {
    const db = makeDb()
    await expect(leaveTrip('user-1', 'trip-1', db)).rejects.toThrow('Participation record not found.')
    expect(db.deleteDocument).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.resolve({ documents: [{ $id: 'p-1' }] })),
      deleteDocument: mock(() => Promise.reject(new Error('Delete failed')))
    })
    await expect(leaveTrip('user-1', 'trip-1', db)).rejects.toThrow('Delete failed')
  })
})

describe('listParticipatedTrips', () => {
  it('returns an empty array when the user has no participations', async () => {
    const db = makeDb()
    const result = await listParticipatedTrips('user-1', db)
    expect(result).toEqual([])
    expect(db.listDocuments).toHaveBeenCalledTimes(1)
  })

  it('fetches and returns trips for each participation', async () => {
    const listDocuments = mock()
    listDocuments
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'p-1', userId: 'user-1', tripId: 'trip-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'trip-1', name: 'Ski Alps' }] })
      )
    const db = makeDb({ listDocuments })
    const result = await listParticipatedTrips('user-1', db)
    expect(db.listDocuments).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(1)
    expect(result[0].$id).toBe('trip-1')
  })

  it('propagates errors from the first query', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.reject(new Error('Network error')))
    })
    await expect(listParticipatedTrips('user-1', db)).rejects.toThrow('Network error')
  })
})

describe('getUserById', () => {
  it('fetches user data and returns the parsed JSON', async () => {
    global.fetch = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ $id: 'u-1', name: 'Alice' }) })
    )
    const result = await getUserById('u-1')
    expect(result.name).toBe('Alice')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('throws when the response is not ok', async () => {
    global.fetch = mock(() => Promise.resolve({ ok: false }))
    await expect(getUserById('u-1')).rejects.toThrow('Failed to fetch user')
  })
})

describe('deleteTrip', () => {
  it('throws when the caller is not the coordinator', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'p-1', userId: 'other-user' }] })
      )
    const db = makeDb({ listDocuments })
    await expect(deleteTrip('trip-1', 'user-1', db)).rejects.toThrow('Only the coordinator can delete this trip.')
  })

  it('deletes participants then the trip when caller is coordinator', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'p-1', userId: 'user-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'p-1' }, { $id: 'p-2' }] })
      )
    const db = makeDb({ listDocuments })
    await deleteTrip('trip-1', 'user-1', db)
    expect(db.deleteDocument).toHaveBeenCalledTimes(3)
  })

  it('throws when there are no participants (no coordinator)', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
    const db = makeDb({ listDocuments })
    await expect(deleteTrip('trip-1', 'user-1', db)).rejects.toThrow('Only the coordinator can delete this trip.')
  })

  it('propagates errors', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'p-1', userId: 'user-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [] })
      )
    const db = makeDb({ listDocuments, deleteDocument: mock(() => Promise.reject(new Error('Delete failed'))) })
    await expect(deleteTrip('trip-1', 'user-1', db)).rejects.toThrow('Delete failed')
  })
})
