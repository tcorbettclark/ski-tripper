import { describe, expect, it, mock } from 'bun:test'
import type PocketBase from 'pocketbase'
import {
  closePoll,
  createAccommodation,
  createDiscussionComment,
  createPoll,
  createPreferences,
  createProposal,
  createSystemMessage,
  createTrip,
  deleteAccommodation,
  deleteDiscussionComment,
  deleteProposal,
  deleteTrip,
  fetchResortDataWithAuth,
  getPreferences,
  getProposal,
  getTrip,
  getTripByCode,
  joinTrip,
  leaveTrip,
  listAccommodations,
  listDiscussion,
  listParticipatedTrips,
  listPolls,
  listProposals,
  listTrips,
  listVotes,
  rejectProposal,
  submitProposal,
  updateAccommodation,
  updateDiscussionComment,
  updatePreferences,
  updateProposal,
  updateTrip,
  upsertVote,
} from './backend'

type MockFn = ReturnType<typeof mock>

interface MockCollection {
  getFullList: MockFn
  getOne: MockFn
  create: MockFn
  update: MockFn
  delete: MockFn
}

function createMockClient(
  overrides: Partial<Record<string, Partial<MockCollection>>> = {}
): PocketBase {
  const collections: Record<string, MockCollection> = {}
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
    const o = overrides[name]
    collections[name] = {
      getFullList: o?.getFullList ?? mock(() => Promise.resolve([])),
      getOne: o?.getOne ?? mock(() => Promise.resolve({ id: 'mock-id' })),
      create:
        o?.create ??
        mock(() => Promise.resolve({ id: 'new-id', description: 'New Trip' })),
      update:
        o?.update ??
        mock(() => Promise.resolve({ id: '1', description: 'Updated Trip' })),
      delete: o?.delete ?? mock(() => Promise.resolve()),
    }
  }
  const client = {
    collection: (name: string) => collections[name],
    filter: (template: string, params: Record<string, unknown>) => {
      let result = template
      for (const [key, value] of Object.entries(params)) {
        result = result.replace(`{:${key}}`, String(value))
      }
      return result
    },
    authStore: {
      record: { id: 'user-1' },
    },
  } as unknown as PocketBase
  return client
}

describe('listTrips', () => {
  it('returns documents and coordinatorUserIds from participant query', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'p-1', user: 'user-1', trip: 'trip-1' }])
        ),
      },
      trips: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'trip-1', code: 'abc', description: 'Trip 1' },
          ])
        ),
      },
    })
    const result = await listTrips('user-1', client)
    expect(result.trips).toHaveLength(1)
    expect(result.trips[0].description).toBe('Trip 1')
    expect(result.coordinatorUserIds).toEqual({ 'trip-1': 'user-1' })
  })

  it('returns empty when user has no coordinated trips', async () => {
    const client = createMockClient()
    const result = await listTrips('user-1', client)
    expect(result.trips).toHaveLength(0)
    expect(result.coordinatorUserIds).toEqual({})
  })

  it('propagates errors', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() => Promise.reject(new Error('Network error'))),
      },
    })
    expect(listTrips('user-1', client)).rejects.toThrow('Network error')
  })
})

describe('getTrip', () => {
  it('calls getOne with the trip id', async () => {
    const client = createMockClient()
    await getTrip('trip-1', client)
    expect(client.collection('trips').getOne).toHaveBeenCalledTimes(1)
    expect(client.collection('trips').getOne).toHaveBeenCalledWith('trip-1')
  })

  it('returns the trip document', async () => {
    const client = createMockClient({
      trips: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'trip-1',
            code: 'code',
            description: 'Ski Alps',
          })
        ),
      },
    })
    const result = await getTrip('trip-1', client)
    expect(result.id).toBe('trip-1')
    expect(result.description).toBe('Ski Alps')
  })

  it('propagates errors', async () => {
    const client = createMockClient({
      trips: {
        getOne: mock(() => Promise.reject(new Error('Not found'))),
      },
    })
    expect(getTrip('trip-1', client)).rejects.toThrow('Not found')
  })
})

describe('getTripByCode', () => {
  it('calls getFullList with a code filter', async () => {
    const client = createMockClient({
      trips: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'trip-1', code: 'abc-def-ghi', description: '' },
          ])
        ),
      },
    })
    const result = await getTripByCode('abc-def-ghi', client)
    expect(client.collection('trips').getFullList).toHaveBeenCalledTimes(1)
    expect(result.trips[0].code).toBe('abc-def-ghi')
  })

  it('returns empty documents when code is not found', async () => {
    const client = createMockClient()
    const result = await getTripByCode('unknown-code', client)
    expect(result.trips).toHaveLength(0)
  })

  it('propagates errors', async () => {
    const client = createMockClient({
      trips: {
        getFullList: mock(() => Promise.reject(new Error('Network error'))),
      },
    })
    expect(getTripByCode('abc-def-ghi', client)).rejects.toThrow(
      'Network error'
    )
  })
})

describe('createTrip', () => {
  it('creates a trip and a coordinator participant', async () => {
    const client = createMockClient()
    await createTrip('user-1', 'Alice', { description: 'New Trip' }, client)
    expect(client.collection('trips').create).toHaveBeenCalledTimes(1)
    expect(client.collection('participants').create).toHaveBeenCalledTimes(1)
  })

  it('includes a three-word code in the created document', async () => {
    const client = createMockClient()
    await createTrip('user-1', 'Alice', { description: 'New Trip' }, client)
    const createCall = (client.collection('trips').create as MockFn).mock
      .calls[0]
    expect(createCall[0].code).toMatch(/^\w+-\w+-\w+$/)
  })

  it('retries if the first code is already taken', async () => {
    let callCount = 0
    const client = createMockClient({
      trips: {
        getFullList: mock(() => {
          callCount++
          if (callCount === 1) return Promise.resolve([{ id: 'x' }])
          return Promise.resolve([])
        }),
        create: mock(() =>
          Promise.resolve({
            id: 'new-id',
            code: 'new-code',
            description: 'New Trip',
          })
        ),
      },
    })
    await createTrip('user-1', 'Alice', { description: 'New Trip' }, client)
    expect(callCount).toBe(2)
    expect(client.collection('trips').create).toHaveBeenCalledTimes(1)
  })

  it('throws after 100 failed attempts', async () => {
    const client = createMockClient({
      trips: {
        getFullList: mock(() => Promise.resolve([{ id: 'x' }])),
      },
    })
    expect(
      createTrip('user-1', 'Alice', { description: 'New Trip' }, client)
    ).rejects.toThrow(
      'Could not generate a unique trip code after 100 attempts.'
    )
    expect(client.collection('trips').getFullList).toHaveBeenCalledTimes(100)
    expect(client.collection('trips').create).not.toHaveBeenCalled()
  })

  it('creates the initial participant with role coordinator', async () => {
    const client = createMockClient()
    await createTrip('user-1', 'Alice', { description: 'New Trip' }, client)
    const createCall = (client.collection('participants').create as MockFn).mock
      .calls[0]
    expect(createCall[0].role).toBe('coordinator')
    expect(createCall[0].user).toBe('user-1')
    expect(createCall[0].name).toBe('Alice')
  })

  it('propagates create errors', async () => {
    const client = createMockClient({
      trips: {
        create: mock(() => Promise.reject(new Error('Create failed'))),
      },
    })
    expect(
      createTrip('user-1', 'Alice', { description: 'Trip' }, client)
    ).rejects.toThrow('Create failed')
  })
})

describe('updateTrip', () => {
  it('calls update and returns the updated trip when caller is coordinator', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'p-1', user: 'user-1', role: 'coordinator' }])
        ),
      },
    })
    const result = await updateTrip(
      'trip-1',
      { description: 'Updated Trip' },
      'user-1',
      client
    )
    expect(client.collection('trips').update).toHaveBeenCalledTimes(1)
    expect(result.description).toBe('Updated Trip')
  })

  it('throws when the caller is not the coordinator', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'p-1', user: 'other-user', role: 'coordinator' },
          ])
        ),
      },
    })
    expect(updateTrip('trip-1', {}, 'user-1', client)).rejects.toThrow(
      'Only the coordinator can edit this trip.'
    )
  })

  it('throws when there is no coordinator for the trip', async () => {
    const client = createMockClient()
    expect(updateTrip('trip-1', {}, 'user-1', client)).rejects.toThrow(
      'Only the coordinator can edit this trip.'
    )
  })

  it('propagates errors', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'p-1', user: 'user-1', role: 'coordinator' }])
        ),
      },
      trips: {
        update: mock(() => Promise.reject(new Error('Update failed'))),
      },
    })
    expect(updateTrip('trip-1', {}, 'user-1', client)).rejects.toThrow(
      'Update failed'
    )
  })
})

describe('joinTrip', () => {
  it('creates a participation record with role participant when none exists', async () => {
    const client = createMockClient()
    await joinTrip('user-1', 'Alice', 'trip-1', client)
    expect(client.collection('participants').create).toHaveBeenCalledTimes(1)
    const createCall = (client.collection('participants').create as MockFn).mock
      .calls[0]
    expect(createCall[0].role).toBe('participant')
    expect(createCall[0].name).toBe('Alice')
  })

  it('throws when the trip does not exist', async () => {
    const client = createMockClient({
      trips: {
        getOne: mock(() => Promise.reject(new Error('Not found'))),
      },
    })
    expect(joinTrip('user-1', 'Alice', 'trip-1', client)).rejects.toThrow(
      'Trip not found.'
    )
    expect(client.collection('participants').create).not.toHaveBeenCalled()
  })

  it('throws when the user has already joined the trip', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'p-1', user: 'user-1', trip: 'trip-1' }])
        ),
      },
    })
    expect(joinTrip('user-1', 'Alice', 'trip-1', client)).rejects.toThrow(
      'You have already joined this trip.'
    )
    expect(client.collection('participants').create).not.toHaveBeenCalled()
  })
})

describe('leaveTrip', () => {
  it('deletes the participation record when it exists', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'p-1', user: 'user-1', trip: 'trip-1', role: 'participant' },
          ])
        ),
        delete: mock(() => Promise.resolve()),
      },
    })
    await leaveTrip('user-1', 'trip-1', client)
    expect(client.collection('participants').delete).toHaveBeenCalledTimes(1)
  })

  it('throws when no participation record is found', async () => {
    const client = createMockClient()
    expect(leaveTrip('user-1', 'trip-1', client)).rejects.toThrow(
      'Participation record not found.'
    )
    expect(client.collection('participants').delete).not.toHaveBeenCalled()
  })

  it('throws when the coordinator tries to leave', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'p-1', user: 'user-1', role: 'coordinator' }])
        ),
      },
    })
    expect(leaveTrip('user-1', 'trip-1', client)).rejects.toThrow(
      'The coordinator cannot leave the trip.'
    )
    expect(client.collection('participants').delete).not.toHaveBeenCalled()
  })
})

describe('listParticipatedTrips', () => {
  it('returns an empty trips array when the user has no participations', async () => {
    const client = createMockClient()
    const result = await listParticipatedTrips('user-1', client)
    expect(result).toEqual({ trips: [] })
    expect(client.collection('participants').getFullList).toHaveBeenCalledTimes(
      1
    )
  })

  it('fetches and returns trips for each participation', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'p-1', user: 'user-1', trip: 'trip-1' }])
        ),
      },
      trips: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'trip-1', code: 'code', description: 'Ski Alps' },
          ])
        ),
      },
    })
    const result = await listParticipatedTrips('user-1', client)
    expect(client.collection('participants').getFullList).toHaveBeenCalledTimes(
      1
    )
    expect(client.collection('trips').getFullList).toHaveBeenCalledTimes(1)
    expect(result.trips).toHaveLength(1)
    expect(result.trips[0].id).toBe('trip-1')
  })

  it('propagates errors from the first query', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() => Promise.reject(new Error('Network error'))),
      },
    })
    expect(listParticipatedTrips('user-1', client)).rejects.toThrow(
      'Network error'
    )
  })
})

describe('createProposal', () => {
  const minimalProposalData = {
    description: 'd',
    startDate: '2024-12-01',
    endDate: '2024-12-08',
    resortData: {
      resortName: 'Test Resort',
      country: 'France',
      region: 'Alps',
      summitAltitude: 3000,
      baseAltitude: 1500,
      nearestAirport: 'Geneva Airport',
      transferTime: 60,
      pisteKm: 100,
      beginnerPct: 0,
      intermediatePct: 100,
      advancedPct: 0,
      liftCount: 30,
      snowReliability: 'medium' as const,
      skiSeasonMonths: 'Dec-Apr',
      websites: ['https://example.com'],
      latitude: '45.0',
      longitude: '7.0',
      linkedResortsDescription: '',
    },
  }

  it('creates a proposal when user is a participant', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'p-1', user: 'user-1', trip: 'trip-1' }])
        ),
      },
      proposals: {
        create: mock(() =>
          Promise.resolve({
            id: 'new-id',
            description: 'New Trip',
            state: 'draft',
          })
        ),
      },
    })
    const result = await createProposal(
      'trip-1',
      'user-1',
      'Alice',
      {
        description: 'Alps Trip',
        startDate: '2024-12-01',
        endDate: '2024-12-08',
        resortData: {
          resortName: 'Chamonix',
          country: 'France',
          region: 'Alps',
          summitAltitude: 3842,
          baseAltitude: 1000,
          nearestAirport: 'Geneva Airport',
          transferTime: 60,
          pisteKm: 150,
          beginnerPct: 0,
          intermediatePct: 0,
          advancedPct: 150,
          liftCount: 50,
          snowReliability: 'high',
          skiSeasonMonths: 'Dec-Apr',
          websites: ['https://chamonix.com'],
          latitude: '45.9237',
          longitude: '6.8694',
          linkedResortsDescription: '',
        },
      },
      client
    )
    expect(client.collection('proposals').create).toHaveBeenCalledTimes(1)
    const createCall = (client.collection('proposals').create as MockFn).mock
      .calls[0]
    expect(createCall[0].trip).toBe('trip-1')
    expect(createCall[0].proposer).toBe('user-1')
    expect(createCall[0].proposer_name).toBe('Alice')
    expect(createCall[0].state).toBe('draft')
    expect(createCall[0].description).toBe('Alps Trip')
    expect(result.id).toBe('new-id')
  })

  it('throws when user is not a participant', async () => {
    const client = createMockClient()
    expect(
      createProposal('trip-1', 'user-1', 'Alice', minimalProposalData, client)
    ).rejects.toThrow('You must be a participant to access this trip.')
    expect(client.collection('proposals').create).not.toHaveBeenCalled()
  })
})

describe('listProposals', () => {
  it('returns proposals when user is a participant', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'p-1', user: 'user-1', trip: 'trip-1' }])
        ),
      },
      proposals: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'prop-1', trip: 'trip-1', state: 'draft' }])
        ),
      },
    })
    const result = await listProposals('trip-1', 'user-1', client)
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0].id).toBe('prop-1')
  })

  it('throws when user is not a participant', async () => {
    const client = createMockClient()
    expect(listProposals('trip-1', 'user-1', client)).rejects.toThrow(
      'You must be a participant to access this trip.'
    )
  })

  it('propagates errors', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() => Promise.reject(new Error('Network error'))),
      },
    })
    expect(listProposals('trip-1', 'user-1', client)).rejects.toThrow(
      'Network error'
    )
  })
})

describe('getProposal', () => {
  it('returns the proposal when user is a participant', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            trip: 'trip-1',
            proposer: 'user-1',
            state: 'draft',
          })
        ),
      },
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'p-1', user: 'user-1', trip: 'trip-1' }])
        ),
      },
    })
    const result = await getProposal('prop-1', 'user-1', client)
    expect(result.id).toBe('prop-1')
  })

  it('throws when user is not a participant in the proposal trip', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            trip: 'trip-1',
            proposer: 'other-user',
            state: 'draft',
          })
        ),
      },
    })
    expect(getProposal('prop-1', 'user-1', client)).rejects.toThrow(
      'You must be a participant to access this trip.'
    )
  })

  it('propagates getOne errors', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() => Promise.reject(new Error('Not found'))),
      },
    })
    expect(getProposal('prop-1', 'user-1', client)).rejects.toThrow('Not found')
  })

  it('normalises null numeric fields to 0', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            trip: 'trip-1',
            proposer: 'user-1',
            proposer_name: 'Alice',
            state: 'draft',
            description: '',
            resort_name: 'Flat Resort',
            start_date: '2024-12-01',
            end_date: '2024-12-08',
            nearest_airport: 'LYS',
            transfer_time: 60,
            country: 'France',
            region: 'Alps',
            summit_altitude: null,
            base_altitude: null,
            piste_km: null,
            beginner_pct: null,
            intermediate_pct: null,
            advanced_pct: null,
            lift_count: null,
            snow_reliability: 'medium',
            ski_season_months: 'Dec-Apr',
            websites: [],
            latitude: '45.0',
            longitude: '7.0',
            linked_resorts_description: '',
          })
        ),
      },
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'p-1', user: 'user-1', trip: 'trip-1' }])
        ),
      },
    })
    const result = await getProposal('prop-1', 'user-1', client)
    expect(result.summitAltitude).toBe(0)
    expect(result.baseAltitude).toBe(0)
    expect(result.pisteKm).toBe(0)
    expect(result.beginnerPct).toBe(0)
    expect(result.intermediatePct).toBe(0)
    expect(result.advancedPct).toBe(0)
    expect(result.liftCount).toBe(0)
  })
})

describe('updateProposal', () => {
  it('updates the proposal when user is the creator and state is DRAFT', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'draft',
          })
        ),
        update: mock(() =>
          Promise.resolve({
            id: '1',
            description: 'Updated Trip',
            state: 'draft',
          })
        ),
      },
    })
    const result = await updateProposal(
      'prop-1',
      'user-1',
      { description: 'Updated' },
      client
    )
    expect(client.collection('proposals').update).toHaveBeenCalledTimes(1)
    expect(result.id).toBe('1')
  })

  it('throws when user is not the creator', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'other-user',
            state: 'draft',
          })
        ),
      },
    })
    expect(updateProposal('prop-1', 'user-1', {}, client)).rejects.toThrow(
      'Only the creator can edit this proposal.'
    )
    expect(client.collection('proposals').update).not.toHaveBeenCalled()
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'submitted',
          })
        ),
      },
    })
    expect(updateProposal('prop-1', 'user-1', {}, client)).rejects.toThrow(
      'Only draft proposals can be edited.'
    )
    expect(client.collection('proposals').update).not.toHaveBeenCalled()
  })
})

describe('deleteProposal', () => {
  it('deletes the proposal when user is the creator and state is DRAFT', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'draft',
          })
        ),
        delete: mock(() => Promise.resolve()),
      },
    })
    await deleteProposal('prop-1', 'user-1', client)
    expect(client.collection('proposals').delete).toHaveBeenCalledTimes(1)
    expect(client.collection('proposals').delete).toHaveBeenCalledWith('prop-1')
  })

  it('throws when user is not the creator', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'other-user',
            state: 'draft',
          })
        ),
      },
    })
    expect(deleteProposal('prop-1', 'user-1', client)).rejects.toThrow(
      'Only the creator can delete this proposal.'
    )
    expect(client.collection('proposals').delete).not.toHaveBeenCalled()
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'submitted',
          })
        ),
      },
    })
    expect(deleteProposal('prop-1', 'user-1', client)).rejects.toThrow(
      'Only draft proposals can be deleted.'
    )
    expect(client.collection('proposals').delete).not.toHaveBeenCalled()
  })
})

describe('submitProposal', () => {
  it('updates state to SUBMITTED when user is the creator and state is DRAFT', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'draft',
            proposer_name: 'Alice',
          })
        ),
        update: mock(() =>
          Promise.resolve({
            id: '1',
            description: 'Updated Trip',
            state: 'submitted',
          })
        ),
      },
      accommodations: {
        getFullList: mock(() => Promise.resolve([{ id: 'acc-1' }])),
      },
    })
    await submitProposal('prop-1', 'user-1', client)
    expect(client.collection('proposals').update).toHaveBeenCalledTimes(1)
    const updateCall = (client.collection('proposals').update as MockFn).mock
      .calls[0]
    expect(updateCall[1].state).toBe('submitted')
  })

  it('throws when user is not the creator', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'other-user',
            state: 'draft',
          })
        ),
      },
    })
    expect(submitProposal('prop-1', 'user-1', client)).rejects.toThrow(
      'Only the creator can submit this proposal.'
    )
    expect(client.collection('proposals').update).not.toHaveBeenCalled()
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'submitted',
          })
        ),
      },
    })
    expect(submitProposal('prop-1', 'user-1', client)).rejects.toThrow(
      'Only draft proposals can be submitted.'
    )
    expect(client.collection('proposals').update).not.toHaveBeenCalled()
  })

  it('throws when there are no accommodations', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'draft',
          })
        ),
      },
      accommodations: {
        getFullList: mock(() => Promise.resolve([])),
      },
    })
    expect(submitProposal('prop-1', 'user-1', client)).rejects.toThrow(
      'At least one accommodation is required to submit a proposal.'
    )
    expect(client.collection('proposals').update).not.toHaveBeenCalled()
  })
})

describe('rejectProposal', () => {
  it('sets state to REJECTED when caller is coordinator and proposal is SUBMITTED', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'p-1',
            proposer: 'creator-1',
            trip: 'trip-1',
            state: 'submitted',
          })
        ),
        update: mock(() =>
          Promise.resolve({
            id: '1',
            description: 'Updated Trip',
            state: 'rejected',
          })
        ),
      },
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'part-1', user: 'coord-1', role: 'coordinator' },
          ])
        ),
      },
    })
    await rejectProposal('p-1', 'coord-1', client)
    expect(client.collection('proposals').update).toHaveBeenCalledTimes(1)
    const updateCall = (client.collection('proposals').update as MockFn).mock
      .calls[0]
    expect(updateCall[1].state).toBe('rejected')
  })

  it('throws when proposal state is not SUBMITTED', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'p-1',
            proposer: 'creator-1',
            trip: 'trip-1',
            state: 'draft',
          })
        ),
      },
    })
    expect(rejectProposal('p-1', 'coord-1', client)).rejects.toThrow(
      'Only submitted proposals can be rejected.'
    )
    expect(client.collection('proposals').update).not.toHaveBeenCalled()
  })

  it('throws when caller is not the coordinator', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'p-1',
            proposer: 'creator-1',
            trip: 'trip-1',
            state: 'submitted',
          })
        ),
      },
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'part-1', user: 'other-coord', role: 'coordinator' },
          ])
        ),
      },
    })
    expect(rejectProposal('p-1', 'user-1', client)).rejects.toThrow(
      'Only the coordinator can reject this proposal.'
    )
    expect(client.collection('proposals').update).not.toHaveBeenCalled()
  })
})

describe('createPoll', () => {
  it('creates a poll with OPEN state and proposal snapshot when caller is coordinator', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock().mockImplementationOnce(() =>
          Promise.resolve([
            { id: 'part-1', user: 'coord-1', role: 'coordinator' },
          ])
        ),
      },
      polls: {
        getFullList: mock(() => Promise.resolve([])),
        create: mock(() => Promise.resolve({ id: 'new-id', state: 'open' })),
      },
      proposals: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'prop-1' }, { id: 'prop-2' }])
        ),
      },
    })
    await createPoll('trip-1', 'coord-1', 'Coordinator Name', 7, client)
    expect(client.collection('polls').create).toHaveBeenCalledTimes(1)
    const createCall = (client.collection('polls').create as MockFn).mock
      .calls[0]
    expect(createCall[0].state).toBe('open')
    expect(createCall[0].proposal_ids).toEqual(['prop-1', 'prop-2'])
    expect(createCall[0].trip).toBe('trip-1')
    expect(createCall[0].creator).toBe('coord-1')
    expect(createCall[0].creator_name).toBe('Coordinator Name')
    expect(createCall[0].start_date).toBeDefined()
    expect(createCall[0].end_date).toBeDefined()
  })

  it('throws when caller is not the coordinator', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'part-1', user: 'other-user', role: 'coordinator' },
          ])
        ),
      },
    })
    expect(
      createPoll('trip-1', 'user-1', 'User Name', 7, client)
    ).rejects.toThrow('Only the coordinator can create a poll.')
    expect(client.collection('polls').create).not.toHaveBeenCalled()
  })

  it('throws when a poll is already open for this trip', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'part-1', user: 'coord-1', role: 'coordinator' },
          ])
        ),
      },
      polls: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'poll-1', state: 'open' }])
        ),
      },
    })
    expect(
      createPoll('trip-1', 'coord-1', 'Coordinator Name', 7, client)
    ).rejects.toThrow('A poll is already open for this trip.')
    expect(client.collection('polls').create).not.toHaveBeenCalled()
  })

  it('throws when there are no submitted proposals', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'part-1', user: 'coord-1', role: 'coordinator' },
          ])
        ),
      },
      polls: {
        getFullList: mock(() => Promise.resolve([])),
      },
      proposals: {
        getFullList: mock(() => Promise.resolve([])),
      },
    })
    expect(
      createPoll('trip-1', 'coord-1', 'Coordinator Name', 7, client)
    ).rejects.toThrow('No submitted proposals to poll on.')
    expect(client.collection('polls').create).not.toHaveBeenCalled()
  })
})

describe('closePoll', () => {
  it('sets state to CLOSED and outcome when caller is coordinator and poll is OPEN', async () => {
    const client = createMockClient({
      polls: {
        getOne: mock(() =>
          Promise.resolve({ id: 'poll-1', trip: 'trip-1', state: 'open' })
        ),
        update: mock(() =>
          Promise.resolve({
            id: '1',
            description: 'Updated Trip',
            state: 'closed',
          })
        ),
      },
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'part-1', user: 'coord-1', role: 'coordinator' },
          ])
        ),
      },
    })
    await closePoll(
      'poll-1',
      'coord-1',
      'Chamonix through, Annecy rejected',
      client
    )
    expect(client.collection('polls').update).toHaveBeenCalledTimes(1)
    const updateCall = (client.collection('polls').update as MockFn).mock
      .calls[0]
    expect(updateCall[1].state).toBe('closed')
    expect(updateCall[1].outcome).toBe('Chamonix through, Annecy rejected')
  })

  it('throws when outcome is empty', async () => {
    const client = createMockClient()
    expect(closePoll('poll-1', 'coord-1', '', client)).rejects.toThrow(
      'Outcome is required to close a poll.'
    )
    expect(client.collection('polls').update).not.toHaveBeenCalled()
  })

  it('throws when outcome is whitespace only', async () => {
    const client = createMockClient()
    expect(closePoll('poll-1', 'coord-1', '   ', client)).rejects.toThrow(
      'Outcome is required to close a poll.'
    )
    expect(client.collection('polls').update).not.toHaveBeenCalled()
  })

  it('throws when poll is not OPEN', async () => {
    const client = createMockClient({
      polls: {
        getOne: mock(() =>
          Promise.resolve({ id: 'poll-1', trip: 'trip-1', state: 'closed' })
        ),
      },
    })
    expect(
      closePoll('poll-1', 'coord-1', 'Some outcome', client)
    ).rejects.toThrow('Only open polls can be closed.')
    expect(client.collection('polls').update).not.toHaveBeenCalled()
  })

  it('throws when caller is not the coordinator', async () => {
    const client = createMockClient({
      polls: {
        getOne: mock(() =>
          Promise.resolve({ id: 'poll-1', trip: 'trip-1', state: 'open' })
        ),
      },
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'part-1', user: 'other-coord', role: 'coordinator' },
          ])
        ),
      },
    })
    expect(
      closePoll('poll-1', 'user-1', 'Some outcome', client)
    ).rejects.toThrow('Only the coordinator can close a poll.')
    expect(client.collection('polls').update).not.toHaveBeenCalled()
  })
})

describe('listPolls', () => {
  it('returns polls when user is a participant', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'part-1', user: 'user-1', trip: 'trip-1' }])
        ),
      },
      polls: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'poll-1', trip: 'trip-1', state: 'open' }])
        ),
      },
    })
    const result = await listPolls('trip-1', 'user-1', client)
    expect(result.polls).toHaveLength(1)
    expect(result.polls[0].id).toBe('poll-1')
  })

  it('throws when user is not a participant', async () => {
    const client = createMockClient()
    expect(listPolls('trip-1', 'user-1', client)).rejects.toThrow(
      'You must be a participant to access this trip.'
    )
  })
})

describe('upsertVote', () => {
  it('creates a vote when no existing vote', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            {
              id: 'part-1',
              user: 'user-1',
              trip: 'trip-1',
              role: 'participant',
            },
          ])
        ),
      },
      polls: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'poll-1',
            state: 'open',
            proposal_ids: ['p-1', 'p-2', 'p-3'],
            trip: 'trip-1',
          })
        ),
      },
      votes: {
        getFullList: mock(() => Promise.resolve([])),
      },
    })
    await upsertVote('poll-1', 'user-1', 'Alice', ['p-1'], [2], client)
    expect(client.collection('votes').create).toHaveBeenCalledTimes(1)
    const createCall = (client.collection('votes').create as MockFn).mock
      .calls[0]
    expect(createCall[0].poll).toBe('poll-1')
    expect(createCall[0].voter).toBe('user-1')
    expect(createCall[0].voter_name).toBe('Alice')
    expect(createCall[0].proposal_ids).toEqual(['p-1'])
    expect(createCall[0].token_counts).toEqual([2])
  })

  it('updates existing vote when one already exists', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'part-1', user: 'user-1', trip: 'trip-1' }])
        ),
      },
      polls: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'poll-1',
            state: 'open',
            proposal_ids: ['p-1', 'p-2', 'p-3'],
            trip: 'trip-1',
          })
        ),
      },
      votes: {
        getFullList: mock(() => Promise.resolve([{ id: 'vote-1' }])),
      },
    })
    await upsertVote('poll-1', 'user-1', 'Bob', ['p-2'], [1], client)
    expect(client.collection('votes').update).toHaveBeenCalledTimes(1)
    expect(client.collection('votes').create).not.toHaveBeenCalled()
  })

  it('throws when poll is not OPEN', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'part-1', user: 'user-1', trip: 'trip-1' }])
        ),
      },
      polls: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'poll-1',
            state: 'closed',
            proposal_ids: ['p-1'],
            trip: 'trip-1',
          })
        ),
      },
    })
    expect(
      upsertVote('poll-1', 'user-1', 'Alice', [], [], client)
    ).rejects.toThrow('Voting is only allowed on open polls.')
  })

  it('throws when total tokens exceed the number of proposals', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'part-1', user: 'user-1', trip: 'trip-1' }])
        ),
      },
      polls: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'poll-1',
            state: 'open',
            proposal_ids: ['p-1', 'p-2'],
            trip: 'trip-1',
          })
        ),
      },
    })
    expect(
      upsertVote('poll-1', 'user-1', 'Alice', ['p-1'], [3], client)
    ).rejects.toThrow('Total tokens cannot exceed 2.')
  })

  it('throws when a voted proposalId is not in the poll', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            {
              id: 'part-1',
              user: 'user-1',
              trip: 'trip-1',
              role: 'participant',
            },
          ])
        ),
      },
      polls: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'poll-1',
            state: 'open',
            proposal_ids: ['p-1', 'p-2'],
            trip: 'trip-1',
          })
        ),
      },
    })
    expect(
      upsertVote('poll-1', 'user-1', 'Alice', ['p-99'], [1], client)
    ).rejects.toThrow('Vote contains proposal IDs not in this poll.')
    expect(client.collection('votes').create).not.toHaveBeenCalled()
    expect(client.collection('votes').update).not.toHaveBeenCalled()
  })

  it('throws when proposalIds and tokenCounts have different lengths', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            {
              id: 'part-1',
              user: 'user-1',
              trip: 'trip-1',
              role: 'participant',
            },
          ])
        ),
      },
      polls: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'poll-1',
            state: 'open',
            proposal_ids: ['p-1', 'p-2'],
            trip: 'trip-1',
          })
        ),
      },
    })
    expect(
      upsertVote('poll-1', 'user-1', 'Alice', ['p-1', 'p-2'], [1], client)
    ).rejects.toThrow('proposalIds and tokenCounts must have the same length.')
    expect(client.collection('votes').create).not.toHaveBeenCalled()
    expect(client.collection('votes').update).not.toHaveBeenCalled()
  })

  it('throws when user is not a participant', async () => {
    const client = createMockClient({
      polls: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'poll-1',
            state: 'open',
            trip: 'trip-1',
            proposal_ids: [],
          })
        ),
      },
    })
    expect(
      upsertVote('poll-1', 'user-1', 'Alice', [], [], client)
    ).rejects.toThrow('You must be a participant to access this trip.')
  })
})

describe('listVotes', () => {
  it('returns vote documents when user is a participant', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            {
              id: 'part-1',
              user: 'user-1',
              trip: 'trip-1',
              role: 'participant',
            },
          ])
        ),
      },
      polls: {
        getOne: mock(() =>
          Promise.resolve({ id: 'poll-1', trip: 'trip-1', state: 'open' })
        ),
      },
      votes: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'v-1', poll: 'poll-1' }])
        ),
      },
    })
    const result = await listVotes('poll-1', 'user-1', client)
    expect(result.votes).toHaveLength(1)
    expect(result.votes[0].id).toBe('v-1')
  })

  it('throws when user is not a participant', async () => {
    const client = createMockClient({
      polls: {
        getOne: mock(() =>
          Promise.resolve({ id: 'poll-1', trip: 'trip-1', state: 'open' })
        ),
      },
    })
    expect(listVotes('poll-1', 'user-1', client)).rejects.toThrow(
      'You must be a participant to access this trip.'
    )
  })
})

describe('deleteTrip', () => {
  it('throws when the caller is not the coordinator', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'p-1', user: 'other-user', role: 'coordinator' },
          ])
        ),
      },
    })
    expect(deleteTrip('trip-1', 'user-1', client)).rejects.toThrow(
      'Only the coordinator can delete this trip.'
    )
  })

  it('throws when there are no participants (no coordinator)', async () => {
    const client = createMockClient()
    expect(deleteTrip('trip-1', 'user-1', client)).rejects.toThrow(
      'Only the coordinator can delete this trip.'
    )
  })

  it('deletes the trip (cascade handled by DB)', async () => {
    const client = createMockClient({
      participants: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'p-1', user: 'user-1', role: 'coordinator' }])
        ),
      },
    })
    await deleteTrip('trip-1', 'user-1', client)
    expect(client.collection('trips').delete).toHaveBeenCalledTimes(1)
    expect(client.collection('trips').delete).toHaveBeenCalledWith('trip-1')
  })
})

describe('createAccommodation', () => {
  it('creates an accommodation when user is the proposal creator', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'draft',
          })
        ),
      },
      accommodations: {
        create: mock(() =>
          Promise.resolve({
            id: 'acc-1',
            name: 'Hotel Nevai',
            proposal: 'prop-1',
          })
        ),
      },
    })
    const result = await createAccommodation(
      'prop-1',
      'user-1',
      { name: 'Hotel Nevai', url: 'https://example.com' },
      client
    )
    expect(result.name).toBe('Hotel Nevai')
    expect(client.collection('accommodations').create).toHaveBeenCalledTimes(1)
  })

  it('throws when user is not the proposal creator', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'other-user',
            state: 'draft',
          })
        ),
      },
    })
    expect(
      createAccommodation(
        'prop-1',
        'user-1',
        { name: 'Hotel Nevai', url: 'https://example.com' },
        client
      )
    ).rejects.toThrow('Only the creator can add accommodations.')
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'submitted',
          })
        ),
      },
    })
    expect(
      createAccommodation(
        'prop-1',
        'user-1',
        { name: 'Hotel Nevai', url: 'https://example.com' },
        client
      )
    ).rejects.toThrow('Accommodations can only be added to draft proposals.')
  })

  it('prepends https:// to URL missing a scheme', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'draft',
          })
        ),
      },
      accommodations: {
        create: mock(() =>
          Promise.resolve({
            id: 'acc-1',
            name: 'Hotel Nevai',
            url: 'https://example.com',
            proposal: 'prop-1',
          })
        ),
      },
    })
    await createAccommodation(
      'prop-1',
      'user-1',
      { name: 'Hotel Nevai', url: 'example.com' },
      client
    )
    const callArgs = (client.collection('accommodations').create as MockFn).mock
      .calls[0]
    expect(callArgs[0].url).toBe('https://example.com')
  })

  it('does not modify accommodation URL that already has https://', async () => {
    const client = createMockClient({
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'draft',
          })
        ),
      },
      accommodations: {
        create: mock(() =>
          Promise.resolve({
            id: 'acc-1',
            name: 'Hotel Nevai',
            url: 'https://example.com',
            proposal: 'prop-1',
          })
        ),
      },
    })
    await createAccommodation(
      'prop-1',
      'user-1',
      { name: 'Hotel Nevai', url: 'https://example.com' },
      client
    )
    const callArgs = (client.collection('accommodations').create as MockFn).mock
      .calls[0]
    expect(callArgs[0].url).toBe('https://example.com')
  })
})

describe('listAccommodations', () => {
  it('returns accommodations for a proposal', async () => {
    const client = createMockClient({
      accommodations: {
        getFullList: mock(() =>
          Promise.resolve([
            { id: 'acc-1', name: 'Hotel Nevai' },
            { id: 'acc-2', name: 'Hotel Verbier' },
          ])
        ),
      },
    })
    const result = await listAccommodations('prop-1', client)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Hotel Nevai')
  })
})

describe('updateAccommodation', () => {
  it('updates an accommodation when user is the proposal creator', async () => {
    const client = createMockClient({
      accommodations: {
        getOne: mock(() =>
          Promise.resolve({ id: 'acc-1', proposal: 'prop-1' })
        ),
      },
      proposals: {
        getOne: mock(() =>
          Promise.resolve({ id: 'prop-1', proposer: 'user-1', state: 'draft' })
        ),
      },
    })
    await updateAccommodation(
      'acc-1',
      'user-1',
      { name: 'Updated Hotel' },
      client
    )
    expect(client.collection('accommodations').update).toHaveBeenCalledTimes(1)
  })

  it('throws when user is not the proposal creator', async () => {
    const client = createMockClient({
      accommodations: {
        getOne: mock(() =>
          Promise.resolve({ id: 'acc-1', proposal: 'prop-1' })
        ),
      },
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'other-user',
            state: 'draft',
          })
        ),
      },
    })
    expect(
      updateAccommodation('acc-1', 'user-1', { name: 'Updated' }, client)
    ).rejects.toThrow('Only the creator can edit accommodations.')
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const client = createMockClient({
      accommodations: {
        getOne: mock(() =>
          Promise.resolve({ id: 'acc-1', proposal: 'prop-1' })
        ),
      },
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'submitted',
          })
        ),
      },
    })
    expect(
      updateAccommodation('acc-1', 'user-1', { name: 'Updated' }, client)
    ).rejects.toThrow('Accommodations can only be edited on draft proposals.')
  })
})

describe('deleteAccommodation', () => {
  it('deletes an accommodation when user is the proposal creator', async () => {
    const client = createMockClient({
      accommodations: {
        getOne: mock(() =>
          Promise.resolve({ id: 'acc-1', proposal: 'prop-1' })
        ),
      },
      proposals: {
        getOne: mock(() =>
          Promise.resolve({ id: 'prop-1', proposer: 'user-1', state: 'draft' })
        ),
      },
    })
    await deleteAccommodation('acc-1', 'user-1', client)
    expect(client.collection('accommodations').delete).toHaveBeenCalledTimes(1)
  })

  it('throws when user is not the proposal creator', async () => {
    const client = createMockClient({
      accommodations: {
        getOne: mock(() =>
          Promise.resolve({ id: 'acc-1', proposal: 'prop-1' })
        ),
      },
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'other-user',
            state: 'draft',
          })
        ),
      },
    })
    expect(deleteAccommodation('acc-1', 'user-1', client)).rejects.toThrow(
      'Only the creator can delete accommodations.'
    )
  })

  it('throws when proposal is not in DRAFT state', async () => {
    const client = createMockClient({
      accommodations: {
        getOne: mock(() =>
          Promise.resolve({ id: 'acc-1', proposal: 'prop-1' })
        ),
      },
      proposals: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'prop-1',
            proposer: 'user-1',
            state: 'submitted',
          })
        ),
      },
    })
    expect(deleteAccommodation('acc-1', 'user-1', client)).rejects.toThrow(
      'Accommodations can only be deleted from draft proposals.'
    )
  })
})

describe('getPreferences', () => {
  it('returns preferences when a row exists', async () => {
    const client = createMockClient({
      preferences: {
        getFullList: mock(() =>
          Promise.resolve([
            {
              id: 'pref-1',
              user: 'user-1',
              ski_snowboard: ['Ski'],
            },
          ])
        ),
      },
    })
    const result = await getPreferences('user-1', client)
    expect(result).not.toBeNull()
    expect(result?.id).toBe('pref-1')
  })

  it('returns null when no row exists', async () => {
    const client = createMockClient()
    const result = await getPreferences('user-1', client)
    expect(result).toBeNull()
  })

  it('propagates errors', async () => {
    const client = createMockClient({
      preferences: {
        getFullList: mock(() => Promise.reject(new Error('Network error'))),
      },
    })
    expect(getPreferences('user-1', client)).rejects.toThrow('Network error')
  })
})

describe('createPreferences', () => {
  it('creates a preferences row', async () => {
    const client = createMockClient()
    const result = await createPreferences(
      'user-1',
      {
        skiSnowboard: ['Ski'],
        difficulty: ['Red'],
        piste: ['On-Piste'],
        timeSlopes: 20,
        timeEating: 20,
        timeApres: 20,
        timeHotel: 40,
        accommodation: ['Chalet'],
        notes: 'Good snow',
      },
      client
    )
    expect(client.collection('preferences').create).toHaveBeenCalledTimes(1)
    const createCall = (client.collection('preferences').create as MockFn).mock
      .calls[0]
    expect(createCall[0].user).toBe('user-1')
    expect(createCall[0].ski_snowboard).toEqual(['Ski'])
    expect(result.id).toBe('new-id')
  })

  it('propagates errors', async () => {
    const client = createMockClient({
      preferences: {
        create: mock(() => Promise.reject(new Error('Create failed'))),
      },
    })
    expect(
      createPreferences(
        'user-1',
        {
          skiSnowboard: ['Ski'],
          difficulty: ['Red'],
          piste: ['On-Piste'],
          timeSlopes: 20,
          timeEating: 20,
          timeApres: 20,
          timeHotel: 40,
          accommodation: ['Chalet'],
          notes: 'Good snow',
        },
        client
      )
    ).rejects.toThrow('Create failed')
  })
})

describe('updatePreferences', () => {
  it('updates existing preferences', async () => {
    const client = createMockClient({
      preferences: {
        getFullList: mock(() =>
          Promise.resolve([{ id: 'pref-1', user: 'user-1' }])
        ),
      },
    })
    const result = await updatePreferences(
      'user-1',
      { notes: 'Updated' },
      client
    )
    expect(client.collection('preferences').update).toHaveBeenCalledTimes(1)
    const updateCall = (client.collection('preferences').update as MockFn).mock
      .calls[0]
    expect(updateCall[0]).toBe('pref-1')
    expect(result.id).toBe('1')
  })

  it('throws when preferences do not exist', async () => {
    const client = createMockClient()
    expect(
      updatePreferences('user-1', { notes: 'Updated' }, client)
    ).rejects.toThrow('Preferences not found.')
  })
})

describe('listDiscussion', () => {
  it('returns discussion rows ordered by creation date', async () => {
    const client = createMockClient({
      discussion: {
        getFullList: mock(() =>
          Promise.resolve([
            {
              id: 'd-1',
              proposal: 'prop-1',
              type: 'system',
              body: 'Submitted',
            },
            {
              id: 'd-2',
              proposal: 'prop-1',
              type: 'comment',
              body: 'Nice!',
            },
          ])
        ),
      },
    })
    const result = await listDiscussion('prop-1', client)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('d-1')
  })

  it('propagates errors', async () => {
    const client = createMockClient({
      discussion: {
        getFullList: mock(() => Promise.reject(new Error('Network error'))),
      },
    })
    expect(listDiscussion('prop-1', client)).rejects.toThrow('Network error')
  })
})

describe('createDiscussionComment', () => {
  it('creates a comment row with correct data', async () => {
    const client = createMockClient()
    const result = await createDiscussionComment(
      'prop-1',
      'user-1',
      'Alice',
      'Great proposal!',
      client
    )
    expect(client.collection('discussion').create).toHaveBeenCalledTimes(1)
    const createCall = (client.collection('discussion').create as MockFn).mock
      .calls[0]
    expect(createCall[0].proposal).toBe('prop-1')
    expect(createCall[0].author).toBe('user-1')
    expect(createCall[0].author_name).toBe('Alice')
    expect(createCall[0].body).toBe('Great proposal!')
    expect(createCall[0].type).toBe('comment')
    expect(result.id).toBe('new-id')
  })
})

describe('updateDiscussionComment', () => {
  it('updates the comment body when the author edits their own comment', async () => {
    const client = createMockClient({
      discussion: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'd-1',
            author: 'user-1',
            type: 'comment',
            body: 'Old text',
          })
        ),
      },
    })
    const result = await updateDiscussionComment(
      'd-1',
      'user-1',
      'Updated text',
      client
    )
    expect(client.collection('discussion').update).toHaveBeenCalledTimes(1)
    const updateCall = (client.collection('discussion').update as MockFn).mock
      .calls[0]
    expect(updateCall[1].body).toBe('Updated text')
    expect(result.id).toBe('1')
  })

  it('throws when a different user tries to edit', async () => {
    const client = createMockClient({
      discussion: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'd-1',
            author: 'user-2',
            type: 'comment',
            body: 'Old text',
          })
        ),
      },
    })
    expect(
      updateDiscussionComment('d-1', 'user-1', 'Hack', client)
    ).rejects.toThrow('Only the author can edit this comment.')
  })

  it('throws when trying to edit a system message', async () => {
    const client = createMockClient({
      discussion: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'd-1',
            author: 'user-1',
            type: 'system',
            body: 'Submitted',
          })
        ),
      },
    })
    expect(
      updateDiscussionComment('d-1', 'user-1', 'Hack', client)
    ).rejects.toThrow('System messages cannot be edited.')
  })
})

describe('deleteDiscussionComment', () => {
  it('deletes a comment when the author deletes their own', async () => {
    const client = createMockClient({
      discussion: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'd-1',
            author: 'user-1',
            type: 'comment',
          })
        ),
        delete: mock(() => Promise.resolve()),
      },
    })
    await deleteDiscussionComment('d-1', 'user-1', client)
    expect(client.collection('discussion').delete).toHaveBeenCalledTimes(1)
  })

  it('throws when a different user tries to delete', async () => {
    const client = createMockClient({
      discussion: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'd-1',
            author: 'user-2',
            type: 'comment',
          })
        ),
      },
    })
    expect(deleteDiscussionComment('d-1', 'user-1', client)).rejects.toThrow(
      'Only the author can delete this comment.'
    )
  })

  it('throws when trying to delete a system message', async () => {
    const client = createMockClient({
      discussion: {
        getOne: mock(() =>
          Promise.resolve({
            id: 'd-1',
            author: '',
            type: 'system',
          })
        ),
      },
    })
    expect(deleteDiscussionComment('d-1', '', client)).rejects.toThrow(
      'System messages cannot be deleted.'
    )
  })
})

describe('createSystemMessage', () => {
  it('creates a system message row', async () => {
    const client = createMockClient()
    const result = await createSystemMessage(
      'prop-1',
      'Alice submitted this proposal',
      client
    )
    expect(client.collection('discussion').create).toHaveBeenCalledTimes(1)
    const createCall = (client.collection('discussion').create as MockFn).mock
      .calls[0]
    expect(createCall[0].proposal).toBe('prop-1')
    expect(createCall[0].author).toBe('')
    expect(createCall[0].author_name).toBe('System')
    expect(createCall[0].body).toBe('Alice submitted this proposal')
    expect(createCall[0].type).toBe('system')
    expect(result.id).toBe('new-id')
  })
})

describe('fetchResortDataWithAuth', () => {
  const resortJsonlLine = JSON.stringify({
    id: 'chamonix-alps-france',
    resortName: 'Chamonix',
    country: 'France',
    region: 'Alps',
    description: 'A famous resort',
    latitude: '45.9237',
    longitude: '6.8694',
    summitAltitude: 3842,
    baseAltitude: 1000,
    nearestAirport: 'Geneva Airport',
    transferTime: 60,
    pisteKm: 150,
    beginnerPct: 10,
    intermediatePct: 40,
    advancedPct: 50,
    liftCount: 50,
    snowReliability: 'high',
    skiSeasonMonths: 'Dec-Apr',
    websites: ['https://chamonix.com'],
    linkedResortsDescription: 'Linked with Courmayeur',
    embedding: [0.1, 0.2, 0.3],
  })

  function createResortClient(
    overrides: {
      rows?: unknown[]
      fileUrl?: string
      fileContent?: string
      fetchError?: Error
    } = {}
  ): PocketBase {
    const rows = overrides.rows ?? [{ id: 'rec-1', file: 'resort-data.jsonl' }]
    const fileUrl =
      overrides.fileUrl ??
      'https://pb.test.local/api/files/resorts/rec-1/resort-data.jsonl?token=abc'
    const fileContent = overrides.fileContent ?? resortJsonlLine

    const client = createMockClient({
      resorts: {
        getFullList: mock(() => Promise.resolve(rows)),
      },
    })
    ;(client as unknown as Record<string, unknown>).files = {
      getToken: mock(() => Promise.resolve('abc')),
      getURL: mock(() => fileUrl),
    }

    const originalFetch = globalThis.fetch
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      if (overrides.fetchError) {
        return Promise.reject(overrides.fetchError)
      }
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      if (url.includes('pb.test.local')) {
        return Promise.resolve(new Response(fileContent, { status: 200 }))
      }
      return originalFetch(input)
    }) as unknown as typeof globalThis.fetch

    return client
  }

  it('downloads and returns JSONL content from the resort file', async () => {
    const client = createResortClient()
    const result = await fetchResortDataWithAuth(client)
    expect(result.trim()).toBe(resortJsonlLine)

    const resort = JSON.parse(result.trim())
    expect(resort.resortName).toBe('Chamonix')
    expect(resort.country).toBe('France')
    expect(resort.summitAltitude).toBe(3842)
    expect(resort.embedding).toEqual([0.1, 0.2, 0.3])
  })

  it('returns empty string when no resort records exist', async () => {
    const client = createResortClient({ rows: [] })
    const result = await fetchResortDataWithAuth(client)
    expect(result).toBe('')
  })

  it('throws when fetch fails with non-ok status', async () => {
    const client = createResortClient()
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response('not found', { status: 404, statusText: 'Not Found' })
      )
    ) as unknown as typeof globalThis.fetch
    try {
      await expect(fetchResortDataWithAuth(client)).rejects.toThrow(
        'Failed to fetch resort data: 404 Not Found'
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('returns JSONL with multiple resort lines', async () => {
    const resort2 = JSON.stringify({
      id: 'zermatt-alps-switzerland',
      resortName: 'Zermatt',
      country: 'Switzerland',
      region: 'Alps',
      description: 'Matterhorn resort',
      latitude: '46.0207',
      longitude: '7.7491',
      summitAltitude: 3883,
      baseAltitude: 1620,
      nearestAirport: 'Geneva Airport',
      transferTime: 240,
      pisteKm: 360,
      beginnerPct: 15,
      intermediatePct: 50,
      advancedPct: 35,
      liftCount: 36,
      snowReliability: 'high',
      skiSeasonMonths: 'Nov-Apr',
      websites: ['https://zermatt.ch'],
      linkedResortsDescription: 'Linked with Cervinia',
      embedding: [0.4, 0.5, 0.6],
    })
    const twoLineJsonl = `${resortJsonlLine}\n${resort2}`
    const client = createResortClient({ fileContent: twoLineJsonl })
    const result = await fetchResortDataWithAuth(client)
    const lines = result.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).resortName).toBe('Chamonix')
    expect(JSON.parse(lines[1]).resortName).toBe('Zermatt')
  })

  it('uses camelCase field names from JSONL (not snake_case)', async () => {
    const client = createResortClient()
    const result = await fetchResortDataWithAuth(client)
    const resort = JSON.parse(result.trim())
    expect(resort).toHaveProperty('resortName')
    expect(resort).toHaveProperty('summitAltitude')
    expect(resort).toHaveProperty('pisteKm')
    expect(resort).toHaveProperty('beginnerPct')
    expect(resort).toHaveProperty('linkedResortsDescription')
    expect(resort).not.toHaveProperty('resort_name')
    expect(resort).not.toHaveProperty('summit_altitude')
    expect(resort).not.toHaveProperty('piste_km')
    expect(resort).not.toHaveProperty('beginner_pct')
    expect(resort).not.toHaveProperty('linked_resorts_description')
  })
})
