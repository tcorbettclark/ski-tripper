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
  createProposal,
  listProposals,
  getProposal,
  updateProposal,
  deleteProposal,
  submitProposal,
  rejectProposal,
  createPoll,
  closePoll,
  listPolls,
  upsertVote,
  listVotes,
} from './backend'
import type { Databases } from 'appwrite'

interface MockDb {
  listDocuments: ReturnType<typeof mock>
  createDocument: ReturnType<typeof mock>
  updateDocument: ReturnType<typeof mock>
  deleteDocument: ReturnType<typeof mock>
  getDocument: ReturnType<typeof mock>
}

function makeDb(overrides: Partial<MockDb> = {}): MockDb {
  return {
    listDocuments: mock(() => Promise.resolve({ documents: [] })),
    createDocument: mock(() =>
      Promise.resolve({ $id: 'new-id', name: 'New Trip' })
    ),
    updateDocument: mock(() =>
      Promise.resolve({ $id: '1', name: 'Updated Trip' })
    ),
    deleteDocument: mock(() => Promise.resolve()),
    getDocument: mock(() =>
      Promise.resolve({ $id: 'trip-1', name: 'Ski Alps' })
    ),
    ...overrides,
  }
}

function asDb(db: MockDb): Databases {
  return db as unknown as Databases
}

describe('listTrips', () => {
  it('returns documents and coordinatorUserIds from participant query', async () => {
    const listDocuments = mock()
    listDocuments
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [
            { $id: 'p-1', ParticipantUserId: 'user-1', tripId: 'trip-1' },
          ],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'trip-1', name: 'Trip 1' }] })
      )
    const db = makeDb({ listDocuments })
    const result = await listTrips('user-1', asDb(db))
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0].name).toBe('Trip 1')
    expect(result.coordinatorUserIds).toEqual({ 'trip-1': 'user-1' })
  })

  it('returns empty when user has no coordinated trips', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.resolve({ documents: [] })),
    })
    const result = await listTrips('user-1', asDb(db))
    expect(result.documents).toHaveLength(0)
    expect(result.coordinatorUserIds).toEqual({})
  })

  it('propagates errors', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.reject(new Error('Network error'))),
    })
    await expect(listTrips('user-1', asDb(db))).rejects.toThrow('Network error')
  })
})

describe('getTrip', () => {
  it('calls getDocument with the trip id', async () => {
    const db = makeDb()
    await getTrip('trip-1', asDb(db))
    expect(db.getDocument).toHaveBeenCalledTimes(1)
    const [, , tripId] = db.getDocument.mock.calls[0]
    expect(tripId).toBe('trip-1')
  })

  it('returns the trip document', async () => {
    const db = makeDb()
    const result = await getTrip('trip-1', asDb(db))
    expect(result.$id).toBe('trip-1')
    expect(result.name).toBe('Ski Alps')
  })

  it('propagates errors', async () => {
    const db = makeDb({
      getDocument: mock(() => Promise.reject(new Error('Not found'))),
    })
    await expect(getTrip('trip-1', asDb(db))).rejects.toThrow('Not found')
  })
})

describe('getTripByCode', () => {
  it('calls listDocuments with a code filter', async () => {
    const db = makeDb({
      listDocuments: mock(() =>
        Promise.resolve({ documents: [{ $id: 'trip-1', code: 'abc-def-ghi' }] })
      ),
    })
    const result = await getTripByCode('abc-def-ghi', asDb(db))
    expect(db.listDocuments).toHaveBeenCalledTimes(1)
    expect(result.documents[0].code).toBe('abc-def-ghi')
  })

  it('returns empty documents when code is not found', async () => {
    const db = makeDb()
    const result = await getTripByCode('unknown-code', asDb(db))
    expect(result.documents).toHaveLength(0)
  })

  it('propagates errors', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.reject(new Error('Network error'))),
    })
    await expect(getTripByCode('abc-def-ghi', asDb(db))).rejects.toThrow(
      'Network error'
    )
  })
})

describe('createTrip', () => {
  it('checks for code uniqueness before creating', async () => {
    const db = makeDb()
    await createTrip(
      'user-1',
      'Alice',
      { name: 'New Trip', description: '' },
      asDb(db)
    )
    expect(db.listDocuments).toHaveBeenCalledTimes(1)
    expect(db.createDocument).toHaveBeenCalledTimes(2)
  })

  it('includes a three-word code in the created document', async () => {
    const db = makeDb()
    await createTrip('user-1', 'Alice', { name: 'New Trip' }, asDb(db))
    const [, , , data] = db.createDocument.mock.calls[0]
    expect(data.code).toMatch(/^\w+-\w+-\w+$/)
  })

  it('generates a lowercase code', async () => {
    const db = makeDb()
    await createTrip('user-1', 'Alice', { name: 'New Trip' }, asDb(db))
    const [, , , data] = db.createDocument.mock.calls[0]
    expect(data.code).toBe(data.code.toLowerCase())
  })

  it('retries if the first code is already taken', async () => {
    const listDocuments = mock()
    listDocuments
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'x' }] })
      )
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
    const db = makeDb({ listDocuments })
    await createTrip('user-1', 'Alice', { name: 'New Trip' }, asDb(db))
    expect(db.listDocuments).toHaveBeenCalledTimes(2)
    expect(db.createDocument).toHaveBeenCalledTimes(2)
  })

  it('throws after 100 failed attempts', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.resolve({ documents: [{ $id: 'x' }] })),
    })
    await expect(
      createTrip('user-1', 'Alice', { name: 'New Trip' }, asDb(db))
    ).rejects.toThrow(
      'Could not generate a unique trip code after 100 attempts.'
    )
    expect(db.listDocuments).toHaveBeenCalledTimes(100)
    expect(db.createDocument).not.toHaveBeenCalled()
  })

  it('returns the new trip', async () => {
    const db = makeDb()
    const result = await createTrip(
      'user-1',
      'Alice',
      { name: 'New Trip', description: '' },
      asDb(db)
    )
    expect(result.$id).toBe('new-id')
  })

  it('creates the initial participant with role coordinator', async () => {
    const db = makeDb()
    await createTrip('user-1', 'Alice', { name: 'New Trip' }, asDb(db))
    const participantData = db.createDocument.mock.calls[1][3]
    expect(participantData.role).toBe('coordinator')
    expect(participantData.ParticipantUserId).toBe('user-1')
    expect(participantData.ParticipantUserName).toBe('Alice')
  })

  it('propagates createDocument errors', async () => {
    const db = makeDb({
      createDocument: mock(() => Promise.reject(new Error('Create failed'))),
    })
    await expect(
      createTrip('user-1', 'Alice', { name: 'Trip' }, asDb(db))
    ).rejects.toThrow('Create failed')
  })
})

describe('updateTrip', () => {
  it('calls updateDocument and returns the updated trip when caller is coordinator', async () => {
    const db = makeDb({
      listDocuments: mock(() =>
        Promise.resolve({
          documents: [{ $id: 'p-1', ParticipantUserId: 'user-1' }],
        })
      ),
    })
    const result = await updateTrip(
      'trip-1',
      { name: 'Updated Trip' },
      'user-1',
      asDb(db)
    )
    expect(db.updateDocument).toHaveBeenCalledTimes(1)
    expect(result.name).toBe('Updated Trip')
  })

  it('throws when the caller is not the coordinator', async () => {
    const db = makeDb({
      listDocuments: mock(() =>
        Promise.resolve({
          documents: [{ $id: 'p-1', ParticipantUserId: 'other-user' }],
        })
      ),
    })
    await expect(updateTrip('trip-1', {}, 'user-1', asDb(db))).rejects.toThrow(
      'Only the coordinator can edit this trip.'
    )
  })

  it('throws when there is no coordinator for the trip', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.resolve({ documents: [] })),
    })
    await expect(updateTrip('trip-1', {}, 'user-1', asDb(db))).rejects.toThrow(
      'Only the coordinator can edit this trip.'
    )
  })

  it('propagates errors', async () => {
    const db = makeDb({
      listDocuments: mock(() =>
        Promise.resolve({
          documents: [{ $id: 'p-1', ParticipantUserId: 'user-1' }],
        })
      ),
      updateDocument: mock(() => Promise.reject(new Error('Update failed'))),
    })
    await expect(updateTrip('trip-1', {}, 'user-1', asDb(db))).rejects.toThrow(
      'Update failed'
    )
  })
})

describe('joinTrip', () => {
  it('creates a participation record with role participant when none exists', async () => {
    const db = makeDb()
    await joinTrip('user-1', 'Alice', 'trip-1', asDb(db))
    expect(db.createDocument).toHaveBeenCalledTimes(1)
    const participantData = db.createDocument.mock.calls[0][3]
    expect(participantData.role).toBe('participant')
    expect(participantData.ParticipantUserName).toBe('Alice')
  })

  it('throws when the user has already joined the trip', async () => {
    const db = makeDb({
      listDocuments: mock(() =>
        Promise.resolve({
          documents: [
            { $id: 'p-1', ParticipantUserId: 'user-1', tripId: 'trip-1' },
          ],
        })
      ),
    })
    await expect(
      joinTrip('user-1', 'Alice', 'trip-1', asDb(db))
    ).rejects.toThrow('You have already joined this trip.')
    expect(db.createDocument).not.toHaveBeenCalled()
  })
})

describe('leaveTrip', () => {
  it('deletes the participation record when it exists', async () => {
    const db = makeDb({
      listDocuments: mock(() =>
        Promise.resolve({
          documents: [{ $id: 'p-1', userId: 'user-1', tripId: 'trip-1' }],
        })
      ),
    })
    await leaveTrip('user-1', 'trip-1', asDb(db))
    expect(db.deleteDocument).toHaveBeenCalledTimes(1)
    const [, , deletedId] = db.deleteDocument.mock.calls[0]
    expect(deletedId).toBe('p-1')
  })

  it('throws when no participation record is found', async () => {
    const db = makeDb()
    await expect(leaveTrip('user-1', 'trip-1', asDb(db))).rejects.toThrow(
      'Participation record not found.'
    )
    expect(db.deleteDocument).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = makeDb({
      listDocuments: mock(() =>
        Promise.resolve({ documents: [{ $id: 'p-1' }] })
      ),
      deleteDocument: mock(() => Promise.reject(new Error('Delete failed'))),
    })
    await expect(leaveTrip('user-1', 'trip-1', asDb(db))).rejects.toThrow(
      'Delete failed'
    )
  })
})

describe('listParticipatedTrips', () => {
  it('returns an empty documents array when the user has no participations', async () => {
    const db = makeDb()
    const result = await listParticipatedTrips('user-1', asDb(db))
    expect(result).toEqual({ documents: [] })
    expect(db.listDocuments).toHaveBeenCalledTimes(1)
  })

  it('fetches and returns trips for each participation', async () => {
    const listDocuments = mock()
    listDocuments
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [{ $id: 'p-1', userId: 'user-1', tripId: 'trip-1' }],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'trip-1', name: 'Ski Alps' }] })
      )
    const db = makeDb({ listDocuments })
    const result = await listParticipatedTrips('user-1', asDb(db))
    expect(db.listDocuments).toHaveBeenCalledTimes(2)
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0].$id).toBe('trip-1')
  })

  it('propagates errors from the first query', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.reject(new Error('Network error'))),
    })
    await expect(listParticipatedTrips('user-1', asDb(db))).rejects.toThrow(
      'Network error'
    )
  })
})

describe('createProposal', () => {
  it('creates a proposal document when user is a participant', async () => {
    const listDocuments = mock(() =>
      Promise.resolve({
        documents: [
          { $id: 'p-1', ParticipantUserId: 'user-1', tripId: 'trip-1' },
        ],
      })
    )
    const db = makeDb({ listDocuments })
    const result = await createProposal(
      'trip-1',
      'user-1',
      'Alice',
      { name: 'Alps Trip' },
      asDb(db)
    )
    expect(db.createDocument).toHaveBeenCalledTimes(1)
    const [, , , data] = db.createDocument.mock.calls[0]
    expect(data.tripId).toBe('trip-1')
    expect(data.ProposerUserId).toBe('user-1')
    expect(data.ProposerUserName).toBe('Alice')
    expect(data.state).toBe('DRAFT')
    expect(data.name).toBe('Alps Trip')
    expect(result.$id).toBe('new-id')
  })

  it('throws when user is not a participant', async () => {
    const db = makeDb()
    await expect(
      createProposal(
        'trip-1',
        'user-1',
        'Alice',
        { title: 't', description: 'd' },
        asDb(db)
      )
    ).rejects.toThrow('You must be a participant to access proposals.')
    expect(db.createDocument).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const listDocuments = mock(() =>
      Promise.resolve({ documents: [{ $id: 'p-1' }] })
    )
    const db = makeDb({
      listDocuments,
      createDocument: mock(() => Promise.reject(new Error('Create failed'))),
    })
    await expect(
      createProposal(
        'trip-1',
        'user-1',
        'Alice',
        { title: 't', description: 'd' },
        asDb(db)
      )
    ).rejects.toThrow('Create failed')
  })
})

describe('listProposals', () => {
  it('returns documents when user is a participant', async () => {
    const listDocuments = mock()
    listDocuments
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [{ $id: 'p-1', userId: 'user-1', tripId: 'trip-1' }],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'prop-1', tripId: 'trip-1' }] })
      )
    const db = makeDb({ listDocuments })
    const result = await listProposals('trip-1', 'user-1', asDb(db))
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0].$id).toBe('prop-1')
  })

  it('throws when user is not a participant', async () => {
    const db = makeDb()
    await expect(listProposals('trip-1', 'user-1', asDb(db))).rejects.toThrow(
      'You must be a participant to access proposals.'
    )
  })

  it('propagates errors', async () => {
    const db = makeDb({
      listDocuments: mock(() => Promise.reject(new Error('Network error'))),
    })
    await expect(listProposals('trip-1', 'user-1', asDb(db))).rejects.toThrow(
      'Network error'
    )
  })
})

describe('getProposal', () => {
  it('returns the proposal when user is a participant', async () => {
    const getDocument = mock(() =>
      Promise.resolve({
        $id: 'prop-1',
        tripId: 'trip-1',
        userId: 'user-1',
        state: 'DRAFT',
      })
    )
    const listDocuments = mock(() =>
      Promise.resolve({
        documents: [{ $id: 'p-1', userId: 'user-1', tripId: 'trip-1' }],
      })
    )
    const db = makeDb({ getDocument, listDocuments })
    const result = await getProposal('prop-1', 'user-1', asDb(db))
    expect(result.$id).toBe('prop-1')
  })

  it('throws when user is not a participant in the proposal trip', async () => {
    const getDocument = mock(() =>
      Promise.resolve({
        $id: 'prop-1',
        tripId: 'trip-1',
        userId: 'other-user',
        state: 'DRAFT',
      })
    )
    const db = makeDb({ getDocument })
    await expect(getProposal('prop-1', 'user-1', asDb(db))).rejects.toThrow(
      'You must be a participant to access proposals.'
    )
  })

  it('propagates getDocument errors', async () => {
    const db = makeDb({
      getDocument: mock(() => Promise.reject(new Error('Not found'))),
    })
    await expect(getProposal('prop-1', 'user-1', asDb(db))).rejects.toThrow(
      'Not found'
    )
  })
})

describe('updateProposal', () => {
  it('updates the proposal when user is the creator and state is DRAFT', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
    })
    const result = await updateProposal(
      'prop-1',
      'user-1',
      { name: 'Updated' },
      asDb(db)
    )
    expect(db.updateDocument).toHaveBeenCalledTimes(1)
    expect(result.$id).toBe('1')
  })

  it('strips state, tripId, and userId from data before updating', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
    })
    await updateProposal(
      'prop-1',
      'user-1',
      {
        name: 'Updated',
        state: 'SUBMITTED',
        tripId: 'other-trip',
        ProposerUserId: 'other-user',
      },
      asDb(db)
    )
    expect(db.updateDocument).toHaveBeenCalledTimes(1)
    const [, , , data] = db.updateDocument.mock.calls[0]
    expect(data.name).toBe('Updated')
    expect(data.state).toBeUndefined()
    expect(data.tripId).toBeUndefined()
    expect(data.ProposerUserId).toBeUndefined()
  })

  it('throws when user is not the creator', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'other-user',
          state: 'DRAFT',
        })
      ),
    })
    await expect(
      updateProposal('prop-1', 'user-1', {}, asDb(db))
    ).rejects.toThrow('Only the creator can edit this proposal.')
    expect(db.updateDocument).not.toHaveBeenCalled()
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'user-1',
          state: 'SUBMITTED',
        })
      ),
    })
    await expect(
      updateProposal('prop-1', 'user-1', {}, asDb(db))
    ).rejects.toThrow('Only draft proposals can be edited.')
    expect(db.updateDocument).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
      updateDocument: mock(() => Promise.reject(new Error('Update failed'))),
    })
    await expect(
      updateProposal('prop-1', 'user-1', {}, asDb(db))
    ).rejects.toThrow('Update failed')
  })
})

describe('deleteProposal', () => {
  it('deletes the proposal when user is the creator and state is DRAFT', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
    })
    await deleteProposal('prop-1', 'user-1', asDb(db))
    expect(db.deleteDocument).toHaveBeenCalledTimes(1)
    const [, , deletedId] = db.deleteDocument.mock.calls[0]
    expect(deletedId).toBe('prop-1')
  })

  it('throws when user is not the creator', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'other-user',
          state: 'DRAFT',
        })
      ),
    })
    await expect(deleteProposal('prop-1', 'user-1', asDb(db))).rejects.toThrow(
      'Only the creator can delete this proposal.'
    )
    expect(db.deleteDocument).not.toHaveBeenCalled()
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'user-1',
          state: 'SUBMITTED',
        })
      ),
    })
    await expect(deleteProposal('prop-1', 'user-1', asDb(db))).rejects.toThrow(
      'Only draft proposals can be deleted.'
    )
    expect(db.deleteDocument).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
      deleteDocument: mock(() => Promise.reject(new Error('Delete failed'))),
    })
    await expect(deleteProposal('prop-1', 'user-1', asDb(db))).rejects.toThrow(
      'Delete failed'
    )
  })
})

describe('submitProposal', () => {
  it('updates state to SUBMITTED when user is the creator and state is DRAFT', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
    })
    await submitProposal('prop-1', 'user-1', asDb(db))
    expect(db.updateDocument).toHaveBeenCalledTimes(1)
    const [, , , data] = db.updateDocument.mock.calls[0]
    expect(data.state).toBe('SUBMITTED')
  })

  it('throws when user is not the creator', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'other-user',
          state: 'DRAFT',
        })
      ),
    })
    await expect(submitProposal('prop-1', 'user-1', asDb(db))).rejects.toThrow(
      'Only the creator can submit this proposal.'
    )
    expect(db.updateDocument).not.toHaveBeenCalled()
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'user-1',
          state: 'SUBMITTED',
        })
      ),
    })
    await expect(submitProposal('prop-1', 'user-1', asDb(db))).rejects.toThrow(
      'Only draft proposals can be submitted.'
    )
    expect(db.updateDocument).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          ProposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
      updateDocument: mock(() => Promise.reject(new Error('Update failed'))),
    })
    await expect(submitProposal('prop-1', 'user-1', asDb(db))).rejects.toThrow(
      'Update failed'
    )
  })
})

describe('rejectProposal', () => {
  it('sets state to REJECTED when caller is coordinator and proposal is SUBMITTED', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'p-1',
          ProposerUserId: 'creator-1',
          tripId: 'trip-1',
          state: 'SUBMITTED',
        })
      ),
      listDocuments: mock(() =>
        Promise.resolve({
          documents: [{ $id: 'part-1', ParticipantUserId: 'coord-1' }],
        })
      ),
    })
    await rejectProposal('p-1', 'coord-1', asDb(db))
    expect(db.updateDocument).toHaveBeenCalledTimes(1)
    const [, , , data] = db.updateDocument.mock.calls[0]
    expect(data.state).toBe('REJECTED')
  })

  it('throws when proposal state is not SUBMITTED', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'p-1',
          ProposerUserId: 'creator-1',
          tripId: 'trip-1',
          state: 'DRAFT',
        })
      ),
    })
    await expect(rejectProposal('p-1', 'coord-1', asDb(db))).rejects.toThrow(
      'Only submitted proposals can be rejected.'
    )
    expect(db.updateDocument).not.toHaveBeenCalled()
  })

  it('throws when caller is not the coordinator', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'p-1',
          ProposerUserId: 'creator-1',
          tripId: 'trip-1',
          state: 'SUBMITTED',
        })
      ),
      listDocuments: mock(() =>
        Promise.resolve({
          documents: [{ $id: 'part-1', ParticipantUserId: 'other-coord' }],
        })
      ),
    })
    await expect(rejectProposal('p-1', 'user-1', asDb(db))).rejects.toThrow(
      'Only the coordinator can reject this proposal.'
    )
    expect(db.updateDocument).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = makeDb({
      getDocument: mock(() => Promise.reject(new Error('Not found'))),
    })
    await expect(rejectProposal('p-1', 'coord-1', asDb(db))).rejects.toThrow(
      'Not found'
    )
  })
})

describe('createPoll', () => {
  it('creates a poll with OPEN state and proposal snapshot when caller is coordinator', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [{ $id: 'part-1', ParticipantUserId: 'coord-1' }],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'prop-1' }, { $id: 'prop-2' }] })
      )
    const db = makeDb({ listDocuments })
    await createPoll('trip-1', 'coord-1', 'Coordinator Name', asDb(db))
    expect(db.createDocument).toHaveBeenCalledTimes(1)
    const [, , , data] = db.createDocument.mock.calls[0]
    expect(data.state).toBe('OPEN')
    expect(data.proposalIds).toEqual(['prop-1', 'prop-2'])
    expect(data.tripId).toBe('trip-1')
    expect(data.PollCreatorUserId).toBe('coord-1')
    expect(data.PollCreatorUserName).toBe('Coordinator Name')
  })

  it('throws when caller is not the coordinator', async () => {
    const listDocuments = mock(() =>
      Promise.resolve({
        documents: [{ $id: 'part-1', ParticipantUserId: 'other-user' }],
      })
    )
    const db = makeDb({ listDocuments })
    await expect(
      createPoll('trip-1', 'user-1', 'User Name', asDb(db))
    ).rejects.toThrow('Only the coordinator can create a poll.')
    expect(db.createDocument).not.toHaveBeenCalled()
  })

  it('throws when a poll is already open for this trip', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [{ $id: 'part-1', ParticipantUserId: 'coord-1' }],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'poll-1', state: 'OPEN' }] })
      )
    const db = makeDb({ listDocuments })
    await expect(
      createPoll('trip-1', 'coord-1', 'Coordinator Name', asDb(db))
    ).rejects.toThrow('A poll is already open for this trip.')
    expect(db.createDocument).not.toHaveBeenCalled()
  })

  it('throws when there are no submitted proposals', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [{ $id: 'part-1', ParticipantUserId: 'coord-1' }],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
    const db = makeDb({ listDocuments })
    await expect(
      createPoll('trip-1', 'coord-1', 'Coordinator Name', asDb(db))
    ).rejects.toThrow('No submitted proposals to poll on.')
    expect(db.createDocument).not.toHaveBeenCalled()
  })
})

describe('closePoll', () => {
  it('sets state to CLOSED when caller is coordinator and poll is OPEN', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({ $id: 'poll-1', tripId: 'trip-1', state: 'OPEN' })
      ),
      listDocuments: mock(() =>
        Promise.resolve({
          documents: [{ $id: 'part-1', ParticipantUserId: 'coord-1' }],
        })
      ),
    })
    await closePoll('poll-1', 'coord-1', asDb(db))
    expect(db.updateDocument).toHaveBeenCalledTimes(1)
    const [, , , data] = db.updateDocument.mock.calls[0]
    expect(data.state).toBe('CLOSED')
  })

  it('throws when poll is not OPEN', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({ $id: 'poll-1', tripId: 'trip-1', state: 'CLOSED' })
      ),
    })
    await expect(closePoll('poll-1', 'coord-1', asDb(db))).rejects.toThrow(
      'Only open polls can be closed.'
    )
    expect(db.updateDocument).not.toHaveBeenCalled()
  })

  it('throws when caller is not the coordinator', async () => {
    const db = makeDb({
      getDocument: mock(() =>
        Promise.resolve({ $id: 'poll-1', tripId: 'trip-1', state: 'OPEN' })
      ),
      listDocuments: mock(() =>
        Promise.resolve({
          documents: [{ $id: 'part-1', ParticipantUserId: 'other-coord' }],
        })
      ),
    })
    await expect(closePoll('poll-1', 'user-1', asDb(db))).rejects.toThrow(
      'Only the coordinator can close a poll.'
    )
    expect(db.updateDocument).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = makeDb({
      getDocument: mock(() => Promise.reject(new Error('Not found'))),
    })
    await expect(closePoll('poll-1', 'coord-1', asDb(db))).rejects.toThrow(
      'Not found'
    )
  })
})

describe('listPolls', () => {
  it('returns polls when user is a participant', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [{ $id: 'part-1', userId: 'user-1', tripId: 'trip-1' }],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [{ $id: 'poll-1', tripId: 'trip-1', state: 'OPEN' }],
        })
      )
    const db = makeDb({ listDocuments })
    const result = await listPolls('trip-1', 'user-1', asDb(db))
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0].$id).toBe('poll-1')
  })

  it('throws when user is not a participant', async () => {
    const db = makeDb()
    await expect(listPolls('trip-1', 'user-1', asDb(db))).rejects.toThrow(
      'You must be a participant to access proposals.'
    )
  })
})

describe('upsertVote', () => {
  it('creates a vote document when no existing vote', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [
            { $id: 'part-1', ParticipantUserId: 'user-1', tripId: 'trip-1' },
          ],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
    const db = makeDb({
      listDocuments,
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'poll-1',
          state: 'OPEN',
          proposalIds: ['p-1', 'p-2', 'p-3'],
        })
      ),
    })
    await upsertVote('poll-1', 'trip-1', 'user-1', ['p-1'], [2], asDb(db))
    expect(db.createDocument).toHaveBeenCalledTimes(1)
    const [, , , data] = db.createDocument.mock.calls[0]
    expect(data.pollId).toBe('poll-1')
    expect(data.VoterUserId).toBe('user-1')
    expect(data.proposalIds).toEqual(['p-1'])
    expect(data.tokenCounts).toEqual([2])
  })

  it('updates existing vote document when one already exists', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [{ $id: 'part-1', userId: 'user-1', tripId: 'trip-1' }],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'vote-1' }] })
      )
    const db = makeDb({
      listDocuments,
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'poll-1',
          state: 'OPEN',
          proposalIds: ['p-1', 'p-2', 'p-3'],
        })
      ),
    })
    await upsertVote('poll-1', 'trip-1', 'user-1', ['p-2'], [1], asDb(db))
    expect(db.updateDocument).toHaveBeenCalledTimes(1)
    const [, , docId] = db.updateDocument.mock.calls[0]
    expect(docId).toBe('vote-1')
    expect(db.createDocument).not.toHaveBeenCalled()
  })

  it('throws when poll is not OPEN', async () => {
    const listDocuments = mock(() =>
      Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1' }] })
    )
    const db = makeDb({
      listDocuments,
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'poll-1',
          state: 'CLOSED',
          proposalIds: ['p-1'],
        })
      ),
    })
    await expect(
      upsertVote('poll-1', 'trip-1', 'user-1', [], [], asDb(db))
    ).rejects.toThrow('Voting is only allowed on open polls.')
  })

  it('throws when total tokens exceed the number of proposals', async () => {
    const listDocuments = mock(() =>
      Promise.resolve({ documents: [{ $id: 'part-1', userId: 'user-1' }] })
    )
    const db = makeDb({
      listDocuments,
      getDocument: mock(() =>
        Promise.resolve({
          $id: 'poll-1',
          state: 'OPEN',
          proposalIds: ['p-1', 'p-2'],
        })
      ),
    })
    await expect(
      upsertVote('poll-1', 'trip-1', 'user-1', ['p-1'], [3], asDb(db))
    ).rejects.toThrow('Total tokens cannot exceed 2.')
  })

  it('throws when user is not a participant', async () => {
    const db = makeDb()
    await expect(
      upsertVote('poll-1', 'trip-1', 'user-1', [], [], asDb(db))
    ).rejects.toThrow('You must be a participant to access proposals.')
  })
})

describe('listVotes', () => {
  it('returns vote documents when user is a participant', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [
            { $id: 'part-1', ParticipantUserId: 'user-1', tripId: 'trip-1' },
          ],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'v-1', pollId: 'poll-1' }] })
      )
    const db = makeDb({ listDocuments })
    const result = await listVotes('poll-1', 'trip-1', 'user-1', asDb(db))
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0].$id).toBe('v-1')
  })

  it('throws when user is not a participant', async () => {
    const db = makeDb()
    await expect(
      listVotes('poll-1', 'trip-1', 'user-1', asDb(db))
    ).rejects.toThrow('You must be a participant to access proposals.')
  })
})

describe('deleteTrip', () => {
  it('throws when the caller is not the coordinator', async () => {
    const listDocuments = mock().mockImplementationOnce(() =>
      Promise.resolve({
        documents: [{ $id: 'p-1', ParticipantUserId: 'other-user' }],
      })
    )
    const db = makeDb({ listDocuments })
    await expect(deleteTrip('trip-1', 'user-1', asDb(db))).rejects.toThrow(
      'Only the coordinator can delete this trip.'
    )
  })

  it('deletes participants then the trip when caller is coordinator', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [{ $id: 'p-1', ParticipantUserId: 'user-1' }],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ documents: [{ $id: 'p-1' }, { $id: 'p-2' }] })
      )
    const db = makeDb({ listDocuments })
    await deleteTrip('trip-1', 'user-1', asDb(db))
    expect(db.deleteDocument).toHaveBeenCalledTimes(3)
  })

  it('throws when there are no participants (no coordinator)', async () => {
    const listDocuments = mock().mockImplementationOnce(() =>
      Promise.resolve({ documents: [] })
    )
    const db = makeDb({ listDocuments })
    await expect(deleteTrip('trip-1', 'user-1', asDb(db))).rejects.toThrow(
      'Only the coordinator can delete this trip.'
    )
  })

  it('propagates errors', async () => {
    const listDocuments = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          documents: [{ $id: 'p-1', ParticipantUserId: 'user-1' }],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ documents: [] }))
    const db = makeDb({
      listDocuments,
      deleteDocument: mock(() => Promise.reject(new Error('Delete failed'))),
    })
    await expect(deleteTrip('trip-1', 'user-1', asDb(db))).rejects.toThrow(
      'Delete failed'
    )
  })
})
