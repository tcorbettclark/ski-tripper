import { describe, expect, it, mock } from 'bun:test'
import type { TablesDB } from 'appwrite'
import {
  closePoll,
  createAccommodation,
  createPoll,
  createProposal,
  createTrip,
  deleteAccommodation,
  deleteProposal,
  deleteTrip,
  getProposal,
  getTrip,
  getTripByCode,
  joinTrip,
  leaveTrip,
  listAccommodations,
  listParticipatedTrips,
  listPolls,
  listProposals,
  listTrips,
  listVotes,
  rejectProposal,
  submitProposal,
  updateAccommodation,
  updateProposal,
  updateTrip,
  upsertVote,
} from './backend'

interface MockDb {
  listRows: ReturnType<typeof mock>
  createRow: ReturnType<typeof mock>
  updateRow: ReturnType<typeof mock>
  deleteRow: ReturnType<typeof mock>
  getRow: ReturnType<typeof mock>
}

function createMockDb(overrides: Partial<MockDb> = {}): MockDb & TablesDB {
  return {
    listRows: mock(() => Promise.resolve({ rows: [] })),
    createRow: mock(() =>
      Promise.resolve({ $id: 'new-id', description: 'New Trip' })
    ),
    updateRow: mock(() =>
      Promise.resolve({ $id: '1', description: 'Updated Trip' })
    ),
    deleteRow: mock(() => Promise.resolve()),
    getRow: mock(() =>
      Promise.resolve({ $id: 'trip-1', description: 'Ski Alps' })
    ),
    ...overrides,
  } as MockDb & TablesDB
}

describe('toRow runtime type guard', () => {
  it('throws when getRow returns null', async () => {
    const db = createMockDb({
      getRow: mock(() => Promise.resolve(null as unknown as { $id: string })),
    })
    expect(getTrip('trip-1', db)).rejects.toThrow(
      'Failed to fetch row: expected $id'
    )
  })

  it('throws when getRow returns a row with a non-string $id', async () => {
    const db = createMockDb({
      getRow: mock(() => Promise.resolve({ $id: 123 })),
    })
    expect(getTrip('trip-1', db)).rejects.toThrow(
      'Failed to fetch row: expected $id'
    )
  })

  it('throws when listRows returns a row with a non-string $id', async () => {
    const listRows = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'p-1', participantUserId: 'user-1', tripId: 'trip-1' }],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ rows: [{ $id: 999 }] }))
    const db = createMockDb({ listRows })
    expect(listTrips('user-1', db)).rejects.toThrow(
      'Failed to fetch row: expected $id'
    )
  })
})

describe('listTrips', () => {
  it('returns documents and coordinatorUserIds from participant query', async () => {
    const listRows = mock()
    listRows
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'p-1', participantUserId: 'user-1', tripId: 'trip-1' }],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'trip-1', description: 'Trip 1' }],
        })
      )
    const db = createMockDb({ listRows })
    const result = await listTrips('user-1', db)
    expect(result.trips).toHaveLength(1)
    expect(result.trips[0].description).toBe('Trip 1')
    expect(result.coordinatorUserIds).toEqual({ 'trip-1': 'user-1' })
  })

  it('returns empty when user has no coordinated trips', async () => {
    const db = createMockDb({
      listRows: mock(() => Promise.resolve({ rows: [] })),
    })
    const result = await listTrips('user-1', db)
    expect(result.trips).toHaveLength(0)
    expect(result.coordinatorUserIds).toEqual({})
  })

  it('propagates errors', async () => {
    const db = createMockDb({
      listRows: mock(() => Promise.reject(new Error('Network error'))),
    })
    expect(listTrips('user-1', db)).rejects.toThrow('Network error')
  })
})

describe('getTrip', () => {
  it('calls getRow with the trip id', async () => {
    const db = createMockDb()
    await getTrip('trip-1', db)
    expect(db.getRow).toHaveBeenCalledTimes(1)
    const [{ rowId: tripId }] = db.getRow.mock.calls[0]
    expect(tripId).toBe('trip-1')
  })

  it('returns the trip document', async () => {
    const db = createMockDb()
    const result = await getTrip('trip-1', db)
    expect(result.$id).toBe('trip-1')
    expect(result.description).toBe('Ski Alps')
  })

  it('propagates errors', async () => {
    const db = createMockDb({
      getRow: mock(() => Promise.reject(new Error('Not found'))),
    })
    expect(getTrip('trip-1', db)).rejects.toThrow('Not found')
  })
})

describe('getTripByCode', () => {
  it('calls listRows with a code filter', async () => {
    const db = createMockDb({
      listRows: mock(() =>
        Promise.resolve({ rows: [{ $id: 'trip-1', code: 'abc-def-ghi' }] })
      ),
    })
    const result = await getTripByCode('abc-def-ghi', db)
    expect(db.listRows).toHaveBeenCalledTimes(1)
    expect(result.trips[0].code).toBe('abc-def-ghi')
  })

  it('returns empty documents when code is not found', async () => {
    const db = createMockDb()
    const result = await getTripByCode('unknown-code', db)
    expect(result.trips).toHaveLength(0)
  })

  it('propagates errors', async () => {
    const db = createMockDb({
      listRows: mock(() => Promise.reject(new Error('Network error'))),
    })
    expect(getTripByCode('abc-def-ghi', db)).rejects.toThrow('Network error')
  })
})

describe('createTrip', () => {
  it('checks for code uniqueness before creating', async () => {
    const db = createMockDb()
    await createTrip('user-1', 'Alice', { description: 'New Trip' }, db)
    expect(db.listRows).toHaveBeenCalledTimes(1)
    expect(db.createRow).toHaveBeenCalledTimes(2)
  })

  it('includes a three-word code in the created document', async () => {
    const db = createMockDb()
    await createTrip('user-1', 'Alice', { description: 'New Trip' }, db)
    const [{ data }] = db.createRow.mock.calls[0]
    expect(data.code).toMatch(/^\w+-\w+-\w+$/)
  })

  it('generates a lowercase code', async () => {
    const db = createMockDb()
    await createTrip('user-1', 'Alice', { description: 'New Trip' }, db)
    const [{ data }] = db.createRow.mock.calls[0]
    expect(data.code).toBe(data.code.toLowerCase())
  })

  it('retries if the first code is already taken', async () => {
    const listRows = mock()
    listRows
      .mockImplementationOnce(() => Promise.resolve({ rows: [{ $id: 'x' }] }))
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
    const db = createMockDb({ listRows })
    await createTrip('user-1', 'Alice', { description: 'New Trip' }, db)
    expect(db.listRows).toHaveBeenCalledTimes(2)
    expect(db.createRow).toHaveBeenCalledTimes(2)
  })

  it('throws after 100 failed attempts', async () => {
    const db = createMockDb({
      listRows: mock(() => Promise.resolve({ rows: [{ $id: 'x' }] })),
    })
    expect(
      createTrip('user-1', 'Alice', { description: 'New Trip' }, db)
    ).rejects.toThrow(
      'Could not generate a unique trip code after 100 attempts.'
    )
    expect(db.listRows).toHaveBeenCalledTimes(100)
    expect(db.createRow).not.toHaveBeenCalled()
  })

  it('returns the new trip', async () => {
    const db = createMockDb()
    const result = await createTrip(
      'user-1',
      'Alice',
      { description: 'New Trip' },
      db
    )
    expect(result.$id).toBe('new-id')
  })

  it('creates the initial participant with role coordinator', async () => {
    const db = createMockDb()
    await createTrip('user-1', 'Alice', { description: 'New Trip' }, db)
    const { data: participantData } = db.createRow.mock.calls[1][0]
    expect(participantData.role).toBe('coordinator')
    expect(participantData.participantUserId).toBe('user-1')
    expect(participantData.participantUserName).toBe('Alice')
  })

  it('propagates createRow errors', async () => {
    const db = createMockDb({
      createRow: mock(() => Promise.reject(new Error('Create failed'))),
    })
    expect(
      createTrip('user-1', 'Alice', { description: 'Trip' }, db)
    ).rejects.toThrow('Create failed')
  })
})

describe('updateTrip', () => {
  it('calls updateRow and returns the updated trip when caller is coordinator', async () => {
    const db = createMockDb({
      listRows: mock(() =>
        Promise.resolve({
          rows: [{ $id: 'p-1', participantUserId: 'user-1' }],
        })
      ),
    })
    const result = await updateTrip(
      'trip-1',
      { description: 'Updated Trip' },
      'user-1',
      db
    )
    expect(db.updateRow).toHaveBeenCalledTimes(1)
    expect(result.description).toBe('Updated Trip')
  })

  it('throws when the caller is not the coordinator', async () => {
    const db = createMockDb({
      listRows: mock(() =>
        Promise.resolve({
          rows: [{ $id: 'p-1', participantUserId: 'other-user' }],
        })
      ),
    })
    expect(updateTrip('trip-1', {}, 'user-1', db)).rejects.toThrow(
      'Only the coordinator can edit this trip.'
    )
  })

  it('throws when there is no coordinator for the trip', async () => {
    const db = createMockDb({
      listRows: mock(() => Promise.resolve({ rows: [] })),
    })
    expect(updateTrip('trip-1', {}, 'user-1', db)).rejects.toThrow(
      'Only the coordinator can edit this trip.'
    )
  })

  it('propagates errors', async () => {
    const db = createMockDb({
      listRows: mock(() =>
        Promise.resolve({
          rows: [{ $id: 'p-1', participantUserId: 'user-1' }],
        })
      ),
      updateRow: mock(() => Promise.reject(new Error('Update failed'))),
    })
    expect(updateTrip('trip-1', {}, 'user-1', db)).rejects.toThrow(
      'Update failed'
    )
  })
})

describe('joinTrip', () => {
  it('creates a participation record with role participant when none exists', async () => {
    const db = createMockDb()
    await joinTrip('user-1', 'Alice', 'trip-1', db)
    expect(db.createRow).toHaveBeenCalledTimes(1)
    const { data: participantData } = db.createRow.mock.calls[0][0]
    expect(participantData.role).toBe('participant')
    expect(participantData.participantUserName).toBe('Alice')
  })

  it('throws when the trip does not exist', async () => {
    const db = createMockDb({
      getRow: mock(() => Promise.reject(new Error('Not found'))),
    })
    expect(joinTrip('user-1', 'Alice', 'trip-1', db)).rejects.toThrow(
      'Trip not found.'
    )
    expect(db.createRow).not.toHaveBeenCalled()
  })

  it('throws when the user has already joined the trip', async () => {
    const db = createMockDb({
      listRows: mock(() =>
        Promise.resolve({
          rows: [{ $id: 'p-1', participantUserId: 'user-1', tripId: 'trip-1' }],
        })
      ),
    })
    expect(joinTrip('user-1', 'Alice', 'trip-1', db)).rejects.toThrow(
      'You have already joined this trip.'
    )
    expect(db.createRow).not.toHaveBeenCalled()
  })
})

describe('leaveTrip', () => {
  it('deletes the participation record when it exists', async () => {
    const db = createMockDb({
      listRows: mock(() =>
        Promise.resolve({
          rows: [{ $id: 'p-1', userId: 'user-1', tripId: 'trip-1' }],
        })
      ),
    })
    await leaveTrip('user-1', 'trip-1', db)
    expect(db.deleteRow).toHaveBeenCalledTimes(1)
    const [{ rowId: deletedId }] = db.deleteRow.mock.calls[0]
    expect(deletedId).toBe('p-1')
  })

  it('throws when no participation record is found', async () => {
    const db = createMockDb()
    expect(leaveTrip('user-1', 'trip-1', db)).rejects.toThrow(
      'Participation record not found.'
    )
    expect(db.deleteRow).not.toHaveBeenCalled()
  })

  it('throws when the coordinator tries to leave', async () => {
    const db = createMockDb({
      listRows: mock(() =>
        Promise.resolve({
          rows: [
            { $id: 'p-1', participantUserId: 'user-1', role: 'coordinator' },
          ],
        })
      ),
    })
    expect(leaveTrip('user-1', 'trip-1', db)).rejects.toThrow(
      'The coordinator cannot leave the trip.'
    )
    expect(db.deleteRow).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = createMockDb({
      listRows: mock(() => Promise.resolve({ rows: [{ $id: 'p-1' }] })),
      deleteRow: mock(() => Promise.reject(new Error('Delete failed'))),
    })
    expect(leaveTrip('user-1', 'trip-1', db)).rejects.toThrow('Delete failed')
  })
})

describe('listParticipatedTrips', () => {
  it('returns an empty documents array when the user has no participations', async () => {
    const db = createMockDb()
    const result = await listParticipatedTrips('user-1', db)
    expect(result).toEqual({ trips: [] })
    expect(db.listRows).toHaveBeenCalledTimes(1)
  })

  it('fetches and returns trips for each participation', async () => {
    const listRows = mock()
    listRows
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'p-1', userId: 'user-1', tripId: 'trip-1' }],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'trip-1', description: 'Ski Alps' }],
        })
      )
    const db = createMockDb({ listRows })
    const result = await listParticipatedTrips('user-1', db)
    expect(db.listRows).toHaveBeenCalledTimes(2)
    expect(result.trips).toHaveLength(1)
    expect(result.trips[0].$id).toBe('trip-1')
  })

  it('propagates errors from the first query', async () => {
    const db = createMockDb({
      listRows: mock(() => Promise.reject(new Error('Network error'))),
    })
    expect(listParticipatedTrips('user-1', db)).rejects.toThrow('Network error')
  })
})

describe('createProposal', () => {
  it('creates a proposal document when user is a participant', async () => {
    const listRows = mock(() =>
      Promise.resolve({
        rows: [{ $id: 'p-1', participantUserId: 'user-1', tripId: 'trip-1' }],
      })
    )
    const db = createMockDb({ listRows })
    const result = await createProposal(
      'trip-1',
      'user-1',
      'Alice',
      { description: 'Alps Trip' },
      db
    )
    expect(db.createRow).toHaveBeenCalledTimes(1)
    const [{ data }] = db.createRow.mock.calls[0]
    expect(data.tripId).toBe('trip-1')
    expect(data.proposerUserId).toBe('user-1')
    expect(data.proposerUserName).toBe('Alice')
    expect(data.state).toBe('DRAFT')
    expect(data.description).toBe('Alps Trip')
    expect(result.$id).toBe('new-id')
  })

  it('throws when user is not a participant', async () => {
    const db = createMockDb()
    expect(
      createProposal(
        'trip-1',
        'user-1',
        'Alice',
        { title: 't', description: 'd' },
        db
      )
    ).rejects.toThrow('You must be a participant to access this trip.')
    expect(db.createRow).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const listRows = mock(() => Promise.resolve({ rows: [{ $id: 'p-1' }] }))
    const db = createMockDb({
      listRows,
      createRow: mock(() => Promise.reject(new Error('Create failed'))),
    })
    expect(
      createProposal(
        'trip-1',
        'user-1',
        'Alice',
        { title: 't', description: 'd' },
        db
      )
    ).rejects.toThrow('Create failed')
  })
})

describe('listProposals', () => {
  it('returns documents when user is a participant', async () => {
    const listRows = mock()
    listRows
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'p-1', userId: 'user-1', tripId: 'trip-1' }],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'prop-1', tripId: 'trip-1' }] })
      )
    const db = createMockDb({ listRows })
    const result = await listProposals('trip-1', 'user-1', db)
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0].$id).toBe('prop-1')
  })

  it('throws when user is not a participant', async () => {
    const db = createMockDb()
    expect(listProposals('trip-1', 'user-1', db)).rejects.toThrow(
      'You must be a participant to access this trip.'
    )
  })

  it('propagates errors', async () => {
    const db = createMockDb({
      listRows: mock(() => Promise.reject(new Error('Network error'))),
    })
    expect(listProposals('trip-1', 'user-1', db)).rejects.toThrow(
      'Network error'
    )
  })
})

describe('getProposal', () => {
  it('returns the proposal when user is a participant', async () => {
    const getRow = mock(() =>
      Promise.resolve({
        $id: 'prop-1',
        tripId: 'trip-1',
        userId: 'user-1',
        state: 'DRAFT',
      })
    )
    const listRows = mock(() =>
      Promise.resolve({
        rows: [{ $id: 'p-1', userId: 'user-1', tripId: 'trip-1' }],
      })
    )
    const db = createMockDb({ getRow, listRows })
    const result = await getProposal('prop-1', 'user-1', db)
    expect(result.$id).toBe('prop-1')
  })

  it('throws when user is not a participant in the proposal trip', async () => {
    const getRow = mock(() =>
      Promise.resolve({
        $id: 'prop-1',
        tripId: 'trip-1',
        userId: 'other-user',
        state: 'DRAFT',
      })
    )
    const db = createMockDb({ getRow })
    expect(getProposal('prop-1', 'user-1', db)).rejects.toThrow(
      'You must be a participant to access this trip.'
    )
  })

  it('propagates getRow errors', async () => {
    const db = createMockDb({
      getRow: mock(() => Promise.reject(new Error('Not found'))),
    })
    expect(getProposal('prop-1', 'user-1', db)).rejects.toThrow('Not found')
  })
})

describe('updateProposal', () => {
  it('updates the proposal when user is the creator and state is DRAFT', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
    })
    const result = await updateProposal(
      'prop-1',
      'user-1',
      { description: 'Updated' },
      db
    )
    expect(db.updateRow).toHaveBeenCalledTimes(1)
    expect(result.$id).toBe('1')
  })

  it('strips state, tripId, and userId from data before updating', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
    })
    await updateProposal(
      'prop-1',
      'user-1',
      {
        description: 'Updated',
        state: 'SUBMITTED',
        tripId: 'other-trip',
        proposerUserId: 'other-user',
      },
      db
    )
    expect(db.updateRow).toHaveBeenCalledTimes(1)
    const [{ data }] = db.updateRow.mock.calls[0]
    expect(data.description).toBe('Updated')
    expect(data.state).toBeUndefined()
    expect(data.tripId).toBeUndefined()
    expect(data.proposerUserId).toBeUndefined()
  })

  it('throws when user is not the creator', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'other-user',
          state: 'DRAFT',
        })
      ),
    })
    expect(updateProposal('prop-1', 'user-1', {}, db)).rejects.toThrow(
      'Only the creator can edit this proposal.'
    )
    expect(db.updateRow).not.toHaveBeenCalled()
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'SUBMITTED',
        })
      ),
    })
    expect(updateProposal('prop-1', 'user-1', {}, db)).rejects.toThrow(
      'Only draft proposals can be edited.'
    )
    expect(db.updateRow).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
      updateRow: mock(() => Promise.reject(new Error('Update failed'))),
    })
    expect(updateProposal('prop-1', 'user-1', {}, db)).rejects.toThrow(
      'Update failed'
    )
  })
})

describe('deleteProposal', () => {
  it('deletes the proposal when user is the creator and state is DRAFT', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
    })
    await deleteProposal('prop-1', 'user-1', db)
    expect(db.deleteRow).toHaveBeenCalledTimes(1)
    const [{ rowId: deletedId }] = db.deleteRow.mock.calls[0]
    expect(deletedId).toBe('prop-1')
  })

  it('throws when user is not the creator', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'other-user',
          state: 'DRAFT',
        })
      ),
    })
    expect(deleteProposal('prop-1', 'user-1', db)).rejects.toThrow(
      'Only the creator can delete this proposal.'
    )
    expect(db.deleteRow).not.toHaveBeenCalled()
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'SUBMITTED',
        })
      ),
    })
    expect(deleteProposal('prop-1', 'user-1', db)).rejects.toThrow(
      'Only draft proposals can be deleted.'
    )
    expect(db.deleteRow).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
      deleteRow: mock(() => Promise.reject(new Error('Delete failed'))),
    })
    expect(deleteProposal('prop-1', 'user-1', db)).rejects.toThrow(
      'Delete failed'
    )
  })
})

describe('submitProposal', () => {
  it('updates state to SUBMITTED when user is the creator and state is DRAFT', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
      listRows: mock(() => Promise.resolve({ rows: [{ $id: 'acc-1' }] })),
    })
    await submitProposal('prop-1', 'user-1', db)
    expect(db.updateRow).toHaveBeenCalledTimes(1)
    const [{ data }] = db.updateRow.mock.calls[0]
    expect(data.state).toBe('SUBMITTED')
  })

  it('throws when user is not the creator', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'other-user',
          state: 'DRAFT',
        })
      ),
    })
    expect(submitProposal('prop-1', 'user-1', db)).rejects.toThrow(
      'Only the creator can submit this proposal.'
    )
    expect(db.updateRow).not.toHaveBeenCalled()
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'SUBMITTED',
        })
      ),
    })
    expect(submitProposal('prop-1', 'user-1', db)).rejects.toThrow(
      'Only draft proposals can be submitted.'
    )
    expect(db.updateRow).not.toHaveBeenCalled()
  })

  it('throws when there are no accommodations', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
      listRows: mock(() => Promise.resolve({ rows: [] })),
    })
    expect(submitProposal('prop-1', 'user-1', db)).rejects.toThrow(
      'At least one accommodation is required to submit a proposal.'
    )
    expect(db.updateRow).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
      listRows: mock(() => Promise.resolve({ rows: [{ $id: 'acc-1' }] })),
      updateRow: mock(() => Promise.reject(new Error('Update failed'))),
    })
    expect(submitProposal('prop-1', 'user-1', db)).rejects.toThrow(
      'Update failed'
    )
  })
})

describe('rejectProposal', () => {
  it('sets state to REJECTED when caller is coordinator and proposal is SUBMITTED', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'p-1',
          proposerUserId: 'creator-1',
          tripId: 'trip-1',
          state: 'SUBMITTED',
        })
      ),
      listRows: mock(() =>
        Promise.resolve({
          rows: [{ $id: 'part-1', participantUserId: 'coord-1' }],
        })
      ),
    })
    await rejectProposal('p-1', 'coord-1', db)
    expect(db.updateRow).toHaveBeenCalledTimes(1)
    const [{ data }] = db.updateRow.mock.calls[0]
    expect(data.state).toBe('REJECTED')
  })

  it('throws when proposal state is not SUBMITTED', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'p-1',
          proposerUserId: 'creator-1',
          tripId: 'trip-1',
          state: 'DRAFT',
        })
      ),
    })
    expect(rejectProposal('p-1', 'coord-1', db)).rejects.toThrow(
      'Only submitted proposals can be rejected.'
    )
    expect(db.updateRow).not.toHaveBeenCalled()
  })

  it('throws when caller is not the coordinator', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'p-1',
          proposerUserId: 'creator-1',
          tripId: 'trip-1',
          state: 'SUBMITTED',
        })
      ),
      listRows: mock(() =>
        Promise.resolve({
          rows: [{ $id: 'part-1', participantUserId: 'other-coord' }],
        })
      ),
    })
    expect(rejectProposal('p-1', 'user-1', db)).rejects.toThrow(
      'Only the coordinator can reject this proposal.'
    )
    expect(db.updateRow).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = createMockDb({
      getRow: mock(() => Promise.reject(new Error('Not found'))),
    })
    expect(rejectProposal('p-1', 'coord-1', db)).rejects.toThrow('Not found')
  })
})

describe('createPoll', () => {
  it('creates a poll with OPEN state and proposal snapshot when caller is coordinator', async () => {
    const listRows = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'part-1', participantUserId: 'coord-1' }],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'prop-1' }, { $id: 'prop-2' }] })
      )
    const db = createMockDb({ listRows })
    await createPoll('trip-1', 'coord-1', 'Coordinator Name', 7, db)
    expect(db.createRow).toHaveBeenCalledTimes(1)
    const [{ data }] = db.createRow.mock.calls[0]
    expect(data.state).toBe('OPEN')
    expect(data.proposalIds).toEqual(['prop-1', 'prop-2'])
    expect(data.tripId).toBe('trip-1')
    expect(data.pollCreatorUserId).toBe('coord-1')
    expect(data.pollCreatorUserName).toBe('Coordinator Name')
    expect(data.startDate).toBeDefined()
    expect(data.endDate).toBeDefined()
  })

  it('throws when caller is not the coordinator', async () => {
    const listRows = mock(() =>
      Promise.resolve({
        rows: [{ $id: 'part-1', participantUserId: 'other-user' }],
      })
    )
    const db = createMockDb({ listRows })
    expect(createPoll('trip-1', 'user-1', 'User Name', 7, db)).rejects.toThrow(
      'Only the coordinator can create a poll.'
    )
    expect(db.createRow).not.toHaveBeenCalled()
  })

  it('throws when a poll is already open for this trip', async () => {
    const listRows = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'part-1', participantUserId: 'coord-1' }],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'poll-1', state: 'OPEN' }] })
      )
    const db = createMockDb({ listRows })
    expect(
      createPoll('trip-1', 'coord-1', 'Coordinator Name', 7, db)
    ).rejects.toThrow('A poll is already open for this trip.')
    expect(db.createRow).not.toHaveBeenCalled()
  })

  it('throws when there are no submitted proposals', async () => {
    const listRows = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'part-1', participantUserId: 'coord-1' }],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
    const db = createMockDb({ listRows })
    expect(
      createPoll('trip-1', 'coord-1', 'Coordinator Name', 7, db)
    ).rejects.toThrow('No submitted proposals to poll on.')
    expect(db.createRow).not.toHaveBeenCalled()
  })
})

describe('closePoll', () => {
  it('sets state to CLOSED when caller is coordinator and poll is OPEN', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({ $id: 'poll-1', tripId: 'trip-1', state: 'OPEN' })
      ),
      listRows: mock(() =>
        Promise.resolve({
          rows: [{ $id: 'part-1', participantUserId: 'coord-1' }],
        })
      ),
    })
    await closePoll('poll-1', 'coord-1', db)
    expect(db.updateRow).toHaveBeenCalledTimes(1)
    const [{ data }] = db.updateRow.mock.calls[0]
    expect(data.state).toBe('CLOSED')
  })

  it('throws when poll is not OPEN', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({ $id: 'poll-1', tripId: 'trip-1', state: 'CLOSED' })
      ),
    })
    expect(closePoll('poll-1', 'coord-1', db)).rejects.toThrow(
      'Only open polls can be closed.'
    )
    expect(db.updateRow).not.toHaveBeenCalled()
  })

  it('throws when caller is not the coordinator', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({ $id: 'poll-1', tripId: 'trip-1', state: 'OPEN' })
      ),
      listRows: mock(() =>
        Promise.resolve({
          rows: [{ $id: 'part-1', participantUserId: 'other-coord' }],
        })
      ),
    })
    expect(closePoll('poll-1', 'user-1', db)).rejects.toThrow(
      'Only the coordinator can close a poll.'
    )
    expect(db.updateRow).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    const db = createMockDb({
      getRow: mock(() => Promise.reject(new Error('Not found'))),
    })
    expect(closePoll('poll-1', 'coord-1', db)).rejects.toThrow('Not found')
  })
})

describe('listPolls', () => {
  it('returns polls when user is a participant', async () => {
    const listRows = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'part-1', userId: 'user-1', tripId: 'trip-1' }],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'poll-1', tripId: 'trip-1', state: 'OPEN' }],
        })
      )
    const db = createMockDb({ listRows })
    const result = await listPolls('trip-1', 'user-1', db)
    expect(result.polls).toHaveLength(1)
    expect(result.polls[0].$id).toBe('poll-1')
  })

  it('throws when user is not a participant', async () => {
    const db = createMockDb()
    expect(listPolls('trip-1', 'user-1', db)).rejects.toThrow(
      'You must be a participant to access this trip.'
    )
  })
})

describe('upsertVote', () => {
  it('creates a vote document when no existing vote', async () => {
    const listRows = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [
            { $id: 'part-1', participantUserId: 'user-1', tripId: 'trip-1' },
          ],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
    const db = createMockDb({
      listRows,
      getRow: mock(() =>
        Promise.resolve({
          $id: 'poll-1',
          state: 'OPEN',
          proposalIds: ['p-1', 'p-2', 'p-3'],
        })
      ),
    })
    await upsertVote('poll-1', 'trip-1', 'user-1', ['p-1'], [2], db)
    expect(db.createRow).toHaveBeenCalledTimes(1)
    const [{ data }] = db.createRow.mock.calls[0]
    expect(data.pollId).toBe('poll-1')
    expect(data.voterUserId).toBe('user-1')
    expect(data.proposalIds).toEqual(['p-1'])
    expect(data.tokenCounts).toEqual([2])
  })

  it('updates existing vote document when one already exists', async () => {
    const listRows = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'part-1', userId: 'user-1', tripId: 'trip-1' }],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'vote-1' }] })
      )
    const db = createMockDb({
      listRows,
      getRow: mock(() =>
        Promise.resolve({
          $id: 'poll-1',
          state: 'OPEN',
          proposalIds: ['p-1', 'p-2', 'p-3'],
        })
      ),
    })
    await upsertVote('poll-1', 'trip-1', 'user-1', ['p-2'], [1], db)
    expect(db.updateRow).toHaveBeenCalledTimes(1)
    const [{ rowId: docId }] = db.updateRow.mock.calls[0]
    expect(docId).toBe('vote-1')
    expect(db.createRow).not.toHaveBeenCalled()
  })

  it('throws when poll is not OPEN', async () => {
    const listRows = mock(() =>
      Promise.resolve({ rows: [{ $id: 'part-1', userId: 'user-1' }] })
    )
    const db = createMockDb({
      listRows,
      getRow: mock(() =>
        Promise.resolve({
          $id: 'poll-1',
          state: 'CLOSED',
          proposalIds: ['p-1'],
        })
      ),
    })
    expect(
      upsertVote('poll-1', 'trip-1', 'user-1', [], [], db)
    ).rejects.toThrow('Voting is only allowed on open polls.')
  })

  it('throws when total tokens exceed the number of proposals', async () => {
    const listRows = mock(() =>
      Promise.resolve({ rows: [{ $id: 'part-1', userId: 'user-1' }] })
    )
    const db = createMockDb({
      listRows,
      getRow: mock(() =>
        Promise.resolve({
          $id: 'poll-1',
          state: 'OPEN',
          proposalIds: ['p-1', 'p-2'],
        })
      ),
    })
    expect(
      upsertVote('poll-1', 'trip-1', 'user-1', ['p-1'], [3], db)
    ).rejects.toThrow('Total tokens cannot exceed 2.')
  })

  it('throws when a voted proposalId is not in the poll', async () => {
    const listRows = mock(() =>
      Promise.resolve({
        rows: [{ $id: 'part-1', participantUserId: 'user-1' }],
      })
    )
    const db = createMockDb({
      listRows,
      getRow: mock(() =>
        Promise.resolve({
          $id: 'poll-1',
          state: 'OPEN',
          proposalIds: ['p-1', 'p-2'],
        })
      ),
    })
    expect(
      upsertVote('poll-1', 'trip-1', 'user-1', ['p-99'], [1], db)
    ).rejects.toThrow('Vote contains proposal IDs not in this poll.')
    expect(db.createRow).not.toHaveBeenCalled()
    expect(db.updateRow).not.toHaveBeenCalled()
  })

  it('throws when proposalIds and tokenCounts have different lengths', async () => {
    const listRows = mock(() =>
      Promise.resolve({
        rows: [{ $id: 'part-1', participantUserId: 'user-1' }],
      })
    )
    const db = createMockDb({
      listRows,
      getRow: mock(() =>
        Promise.resolve({
          $id: 'poll-1',
          state: 'OPEN',
          proposalIds: ['p-1', 'p-2'],
        })
      ),
    })
    expect(
      upsertVote('poll-1', 'trip-1', 'user-1', ['p-1', 'p-2'], [1], db)
    ).rejects.toThrow('proposalIds and tokenCounts must have the same length.')
    expect(db.createRow).not.toHaveBeenCalled()
    expect(db.updateRow).not.toHaveBeenCalled()
  })

  it('throws when user is not a participant', async () => {
    const db = createMockDb()
    expect(
      upsertVote('poll-1', 'trip-1', 'user-1', [], [], db)
    ).rejects.toThrow('You must be a participant to access this trip.')
  })
})

describe('listVotes', () => {
  it('returns vote documents when user is a participant', async () => {
    const listRows = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [
            { $id: 'part-1', participantUserId: 'user-1', tripId: 'trip-1' },
          ],
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'v-1', pollId: 'poll-1' }] })
      )
    const db = createMockDb({ listRows })
    const result = await listVotes('poll-1', 'trip-1', 'user-1', db)
    expect(result.votes).toHaveLength(1)
    expect(result.votes[0].$id).toBe('v-1')
  })

  it('throws when user is not a participant', async () => {
    const db = createMockDb()
    expect(listVotes('poll-1', 'trip-1', 'user-1', db)).rejects.toThrow(
      'You must be a participant to access this trip.'
    )
  })
})

describe('deleteTrip', () => {
  it('throws when the caller is not the coordinator', async () => {
    const listRows = mock().mockImplementationOnce(() =>
      Promise.resolve({
        rows: [{ $id: 'p-1', participantUserId: 'other-user' }],
      })
    )
    const db = createMockDb({ listRows })
    expect(deleteTrip('trip-1', 'user-1', db)).rejects.toThrow(
      'Only the coordinator can delete this trip.'
    )
  })

  it('throws when there are no participants (no coordinator)', async () => {
    const listRows = mock().mockImplementationOnce(() =>
      Promise.resolve({ rows: [] })
    )
    const db = createMockDb({ listRows })
    expect(deleteTrip('trip-1', 'user-1', db)).rejects.toThrow(
      'Only the coordinator can delete this trip.'
    )
  })

  it('deletes the trip first, then accommodations, participants, proposals, votes, and polls', async () => {
    const listRows = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'p-1', participantUserId: 'user-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'p-1' }, { $id: 'p-2' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'prop-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'vote-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'poll-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'acc-1' }, { $id: 'acc-2' }] })
      )
    const db = createMockDb({ listRows })
    await deleteTrip('trip-1', 'user-1', db)
    expect(db.deleteRow).toHaveBeenCalledTimes(8)
    const deleteCalls = (
      db.deleteRow as ReturnType<typeof mock>
    ).mock.calls.map((call) => (call[0] as { rowId: string }).rowId)
    expect(deleteCalls).toContain('trip-1')
    expect(deleteCalls).toContain('acc-1')
    expect(deleteCalls).toContain('acc-2')
    const listCalls = (listRows as ReturnType<typeof mock>).mock.calls
    expect(listCalls).toHaveLength(6)
    const accCall = listCalls[5]
    const accommodationQuery = accCall[0].queries[0].toString()
    expect(accommodationQuery).toContain('"method":"equal"')
    expect(accommodationQuery).toContain('"attribute":"proposalId"')
    expect(accommodationQuery).toContain('"values":["prop-1"]')
  })

  it('propagates errors from trip deletion', async () => {
    const listRows = mock().mockImplementationOnce(() =>
      Promise.resolve({ rows: [{ $id: 'p-1', participantUserId: 'user-1' }] })
    )
    const db = createMockDb({
      listRows,
      deleteRow: mock(() => Promise.reject(new Error('Delete failed'))),
    })
    expect(deleteTrip('trip-1', 'user-1', db)).rejects.toThrow('Delete failed')
  })

  it('propagates errors from participant deletion', async () => {
    const listRows = mock()
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'p-1', participantUserId: 'user-1' }] })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'p-1' }, { $id: 'p-2' }] })
      )
      .mockImplementation(() => Promise.resolve({ rows: [] }))
    let callCount = 0
    const deleteRow = mock(() => {
      callCount++
      if (callCount === 1) return Promise.resolve()
      return Promise.reject(new Error('Participant delete failed'))
    })
    const db = createMockDb({ listRows, deleteRow })
    expect(deleteTrip('trip-1', 'user-1', db)).rejects.toThrow(
      'Participant delete failed'
    )
  })

  it('throws when there are too many participants', async () => {
    const manyParticipants = Array.from({ length: 5000 }, (_, i) => ({
      $id: `p-${i}`,
    }))
    const listRows = mock<
      (args: Record<string, unknown>) => Promise<{ rows: { $id: string }[] }>
    >(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'coord-1', participantUserId: 'user-1' }],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ rows: manyParticipants }))
    const db = createMockDb({ listRows })
    expect(deleteTrip('trip-1', 'user-1', db)).rejects.toThrow(
      'Too many participants to delete.'
    )
  })

  it('throws when there are too many proposals', async () => {
    const manyProposals = Array.from({ length: 1000 }, (_, i) => ({
      $id: `prop-${i}`,
    }))
    const listRows = mock<
      (args: Record<string, unknown>) => Promise<{ rows: { $id: string }[] }>
    >(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'coord-1', participantUserId: 'user-1' }],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() => Promise.resolve({ rows: manyProposals }))
    const db = createMockDb({ listRows })
    expect(deleteTrip('trip-1', 'user-1', db)).rejects.toThrow(
      'Too many proposals to delete.'
    )
  })

  it('throws when there are too many votes', async () => {
    const manyVotes = Array.from({ length: 5000 }, (_, i) => ({
      $id: `v-${i}`,
    }))
    const listRows = mock<
      (args: Record<string, unknown>) => Promise<{ rows: { $id: string }[] }>
    >(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'coord-1', participantUserId: 'user-1' }],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() => Promise.resolve({ rows: manyVotes }))
    const db = createMockDb({ listRows })
    expect(deleteTrip('trip-1', 'user-1', db)).rejects.toThrow(
      'Too many votes to delete.'
    )
  })

  it('throws when there are too many polls', async () => {
    const manyPolls = Array.from({ length: 100 }, (_, i) => ({
      $id: `poll-${i}`,
    }))
    const listRows = mock<
      (args: Record<string, unknown>) => Promise<{ rows: { $id: string }[] }>
    >(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'coord-1', participantUserId: 'user-1' }],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() => Promise.resolve({ rows: manyPolls }))
    const db = createMockDb({ listRows })
    expect(deleteTrip('trip-1', 'user-1', db)).rejects.toThrow(
      'Too many polls to delete.'
    )
  })

  it('throws when there are too many accommodations', async () => {
    const manyAccommodations = Array.from({ length: 5000 }, (_, i) => ({
      $id: `acc-${i}`,
    }))
    const listRows = mock<
      (args: Record<string, unknown>) => Promise<{ rows: { $id: string }[] }>
    >(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() =>
        Promise.resolve({
          rows: [{ $id: 'coord-1', participantUserId: 'user-1' }],
        })
      )
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: [{ $id: 'prop-1' }] })
      )
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() => Promise.resolve({ rows: [] }))
      .mockImplementationOnce(() =>
        Promise.resolve({ rows: manyAccommodations })
      )
    const db = createMockDb({ listRows })
    expect(deleteTrip('trip-1', 'user-1', db)).rejects.toThrow(
      'Too many accommodations to delete.'
    )
  })
})

describe('createAccommodation', () => {
  it('creates an accommodation when user is the proposal creator', async () => {
    const db = createMockDb({
      getRow: mock()
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'prop-1',
            proposerUserId: 'user-1',
            state: 'DRAFT',
          })
        )
        .mockImplementationOnce(() => Promise.resolve({ rows: [] })),
      listRows: mock(() => Promise.resolve({ rows: [] })),
      createRow: mock(() =>
        Promise.resolve({ $id: 'acc-1', name: 'Hotel Nevai' })
      ),
    })
    const result = await createAccommodation(
      'prop-1',
      'user-1',
      { name: 'Hotel Nevai' },
      db
    )
    expect(result.name).toBe('Hotel Nevai')
    expect(db.createRow).toHaveBeenCalledTimes(1)
  })

  it('throws when user is not the proposal creator', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'other-user',
          state: 'DRAFT',
        })
      ),
    })
    expect(
      createAccommodation('prop-1', 'user-1', { name: 'Hotel Nevai' }, db)
    ).rejects.toThrow('Only the creator can add accommodations.')
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'SUBMITTED',
        })
      ),
    })
    expect(
      createAccommodation('prop-1', 'user-1', { name: 'Hotel Nevai' }, db)
    ).rejects.toThrow('Accommodations can only be added to draft proposals.')
  })

  it('throws when maximum accommodations (5) is reached', async () => {
    const db = createMockDb({
      getRow: mock()
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'prop-1',
            proposerUserId: 'user-1',
            state: 'DRAFT',
          })
        )
        .mockImplementationOnce(() => Promise.resolve({ rows: [] })),
      listRows: mock(() =>
        Promise.resolve({
          rows: [
            { $id: 'acc-1' },
            { $id: 'acc-2' },
            { $id: 'acc-3' },
            { $id: 'acc-4' },
            { $id: 'acc-5' },
          ],
        })
      ),
    })
    expect(
      createAccommodation('prop-1', 'user-1', { name: 'Hotel Nevai' }, db)
    ).rejects.toThrow('Maximum of 5 accommodations allowed per proposal.')
  })
})

describe('listAccommodations', () => {
  it('returns accommodations for a proposal', async () => {
    const db = createMockDb({
      listRows: mock(() =>
        Promise.resolve({
          rows: [
            { $id: 'acc-1', name: 'Hotel Nevai' },
            { $id: 'acc-2', name: 'Hotel Verbier' },
          ],
        })
      ),
    })
    const result = await listAccommodations('prop-1', db)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Hotel Nevai')
  })

  it('queries with proposalId filter', async () => {
    const listRows = mock(() => Promise.resolve({ rows: [] }))
    const db = createMockDb({ listRows })
    await listAccommodations('prop-1', db)
    expect(listRows).toHaveBeenCalledTimes(1)
    const [{ queries }] = listRows.mock.calls[0] as unknown as [
      { queries: string[] },
    ]
    const proposalIdQuery = queries.find((q: string) =>
      q.includes('proposalId')
    )
    expect(proposalIdQuery).toBeDefined()
    expect(proposalIdQuery).toContain('prop-1')
  })
})

describe('updateAccommodation', () => {
  it('updates an accommodation when user is the proposal creator', async () => {
    const db = createMockDb({
      getRow: mock()
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'acc-1',
            proposalId: 'prop-1',
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'prop-1',
            proposerUserId: 'user-1',
            state: 'DRAFT',
          })
        ),
      updateRow: mock(() =>
        Promise.resolve({ $id: 'acc-1', name: 'Updated Hotel' })
      ),
    })
    await updateAccommodation('acc-1', 'user-1', { name: 'Updated Hotel' }, db)
    expect(db.updateRow).toHaveBeenCalledTimes(1)
  })

  it('throws when user is not the proposal creator', async () => {
    const db = createMockDb({
      getRow: mock()
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'acc-1',
            proposalId: 'prop-1',
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'prop-1',
            proposerUserId: 'other-user',
            state: 'DRAFT',
          })
        ),
    })
    expect(
      updateAccommodation('acc-1', 'user-1', { name: 'Updated' }, db)
    ).rejects.toThrow('Only the creator can edit accommodations.')
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const db = createMockDb({
      getRow: mock()
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'acc-1',
            proposalId: 'prop-1',
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'prop-1',
            proposerUserId: 'user-1',
            state: 'SUBMITTED',
          })
        ),
    })
    expect(
      updateAccommodation('acc-1', 'user-1', { name: 'Updated' }, db)
    ).rejects.toThrow('Accommodations can only be edited on draft proposals.')
  })
})

describe('deleteAccommodation', () => {
  it('deletes an accommodation when user is the proposal creator', async () => {
    const db = createMockDb({
      getRow: mock()
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'acc-1',
            proposalId: 'prop-1',
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'prop-1',
            proposerUserId: 'user-1',
            state: 'DRAFT',
          })
        ),
    })
    await deleteAccommodation('acc-1', 'user-1', db)
    expect(db.deleteRow).toHaveBeenCalledTimes(1)
  })

  it('throws when user is not the proposal creator', async () => {
    const db = createMockDb({
      getRow: mock()
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'acc-1',
            proposalId: 'prop-1',
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'prop-1',
            proposerUserId: 'other-user',
            state: 'DRAFT',
          })
        ),
    })
    expect(deleteAccommodation('acc-1', 'user-1', db)).rejects.toThrow(
      'Only the creator can delete accommodations.'
    )
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const db = createMockDb({
      getRow: mock()
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'acc-1',
            proposalId: 'prop-1',
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            $id: 'prop-1',
            proposerUserId: 'user-1',
            state: 'SUBMITTED',
          })
        ),
    })
    expect(deleteAccommodation('acc-1', 'user-1', db)).rejects.toThrow(
      'Accommodations can only be deleted from draft proposals.'
    )
  })
})

describe('deleteProposal with cascade delete', () => {
  it('deletes accommodations before deleting proposal', async () => {
    const deleteRow = mock(() => Promise.resolve())
    const db = createMockDb({
      getRow: mock(() =>
        Promise.resolve({
          $id: 'prop-1',
          proposerUserId: 'user-1',
          state: 'DRAFT',
        })
      ),
      listRows: mock(() =>
        Promise.resolve({
          rows: [{ $id: 'acc-1' }, { $id: 'acc-2' }],
        })
      ),
      deleteRow,
    })
    await deleteProposal('prop-1', 'user-1', db)
    expect(deleteRow).toHaveBeenCalledTimes(3)
    const deletedIds = (
      deleteRow.mock.calls as unknown as [{ rowId: string }][]
    ).map(([args]) => args.rowId)
    expect(deletedIds).toContain('acc-1')
    expect(deletedIds).toContain('acc-2')
    expect(deletedIds).toContain('prop-1')
  })
})
