import type { Models } from 'appwrite'
import {
  Account,
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
} from 'appwrite'
import adjectives from 'threewords/data/adjectives.json'
import nouns from 'threewords/data/nouns.json'
import type { Participant, Poll, Proposal, Trip, Vote } from './types.d'

const client = new Client()
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT as string)
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID as string)

export const account = new Account(client)
export const tablesDb = new TablesDB(client)
export default client

function toRow<T>(row: Models.Row): T {
  return row as T
}

function toRows<T>(rows: Models.Row[]): T[] {
  return rows.map((row) => toRow<T>(row))
}

async function fetchRows<T>(
  result: Promise<{ rows: Models.Row[] }>
): Promise<T[]> {
  const { rows } = await result
  return toRows<T>(rows)
}

async function fetchRow<T>(result: Promise<Models.Row>): Promise<T> {
  return toRow<T>(await result)
}

function randomThreeWords(): string {
  const ints = new Uint32Array(3)
  crypto.getRandomValues(ints)
  const one = adjectives[ints[0] % adjectives.length]
  const two = adjectives[ints[1] % adjectives.length]
  const three = nouns[ints[2] % nouns.length]
  return `${one}-${two}-${three}`.toLowerCase()
}

const DATABASE_ID = process.env.PUBLIC_APPWRITE_DATABASE_ID as string
const TRIPS_TABLE_ID = process.env.PUBLIC_APPWRITE_TRIPS_TABLE_ID as string
const PARTICIPANTS_TABLE_ID = process.env
  .PUBLIC_APPWRITE_PARTICIPANTS_TABLE_ID as string
const PROPOSALS_TABLE_ID = process.env
  .PUBLIC_APPWRITE_PROPOSALS_TABLE_ID as string
const POLLS_TABLE_ID = process.env.PUBLIC_APPWRITE_POLLS_TABLE_ID as string
const VOTES_TABLE_ID = process.env.PUBLIC_APPWRITE_VOTES_TABLE_ID as string

export async function getCoordinatorParticipant(
  tripId: string,
  db: TablesDB = tablesDb
): Promise<{ participants: Participant[] }> {
  const participants = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [
        Query.equal('tripId', tripId),
        Query.equal('role', 'coordinator'),
        Query.limit(1),
      ],
    })
  )
  return { participants }
}

export async function listTripParticipants(
  tripId: string,
  db: TablesDB = tablesDb
): Promise<{ participants: Participant[] }> {
  const participants = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [
        Query.equal('tripId', tripId),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ],
    })
  )
  return { participants }
}

export async function listTrips(
  participantUserId: string,
  db: TablesDB = tablesDb
): Promise<{
  trips: Trip[]
  coordinatorUserIds: Record<string, string>
}> {
  const coordinatorParticipants = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [
        Query.equal('participantUserId', participantUserId),
        Query.equal('role', 'coordinator'),
        Query.orderDesc('$createdAt'),
        Query.limit(50),
      ],
    })
  )

  if (coordinatorParticipants.length === 0) {
    return { trips: [], coordinatorUserIds: {} }
  }
  const tripIds = coordinatorParticipants.map((p) => p.tripId)
  const coordinatorUserIds = Object.fromEntries(
    coordinatorParticipants.map((p) => [p.tripId, p.participantUserId])
  )
  const trips = await fetchRows<Trip>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: TRIPS_TABLE_ID,
      queries: [Query.equal('$id', tripIds)],
    })
  )
  const tripMap = Object.fromEntries(trips.map((t) => [t.$id, t]))
  const orderedTrips = tripIds.map((id) => tripMap[id]).filter(Boolean)
  return { trips: orderedTrips, coordinatorUserIds }
}

export async function getTrip(
  tripId: string,
  db: TablesDB = tablesDb
): Promise<Trip> {
  return fetchRow<Trip>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: TRIPS_TABLE_ID,
      rowId: tripId,
    })
  )
}

export async function getTripByCode(
  code: string,
  db: TablesDB = tablesDb
): Promise<{ trips: Trip[] }> {
  const trips = await fetchRows<Trip>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: TRIPS_TABLE_ID,
      queries: [Query.equal('code', code), Query.limit(1)],
    })
  )
  return { trips }
}

async function findUniqueCode(db: TablesDB = tablesDb): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = randomThreeWords()
    const trips = await fetchRows<Trip>(
      db.listRows({
        databaseId: DATABASE_ID,
        tableId: TRIPS_TABLE_ID,
        queries: [Query.equal('code', code), Query.limit(1)],
      })
    )
    if (trips.length === 0) return code
  }
  throw new Error('Could not generate a unique trip code after 100 attempts.')
}

export async function createTrip(
  participantUserId: string,
  participantUserName: string,
  data: Partial<Trip>,
  db: TablesDB = tablesDb
): Promise<Trip> {
  const code = await findUniqueCode(db)
  const trip = await fetchRow<Trip>(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: TRIPS_TABLE_ID,
      rowId: ID.unique(),
      data: {
        code,
        ...data,
      } as Record<string, unknown>,
      permissions: [
        Permission.read(Role.users()),
        Permission.write(Role.user(participantUserId)),
      ],
    })
  )
  await db.createRow({
    databaseId: DATABASE_ID,
    tableId: PARTICIPANTS_TABLE_ID,
    rowId: ID.unique(),
    data: {
      participantUserId,
      participantUserName,
      tripId: trip.$id,
      role: 'coordinator',
    } as Record<string, unknown>,
    permissions: [
      Permission.read(Role.user(participantUserId)),
      Permission.write(Role.user(participantUserId)),
    ],
  })
  return trip
}

export async function updateTrip(
  tripId: string,
  data: Partial<Trip>,
  participantUserId: string,
  db: TablesDB = tablesDb
): Promise<Trip> {
  const { participants } = await getCoordinatorParticipant(tripId, db)
  if (
    participants.length === 0 ||
    participants[0].participantUserId !== participantUserId
  ) {
    throw new Error('Only the coordinator can edit this trip.')
  }
  return fetchRow<Trip>(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: TRIPS_TABLE_ID,
      rowId: tripId,
      data: data as Record<string, unknown>,
    })
  )
}

export async function deleteTrip(
  tripId: string,
  participantUserId: string,
  db: TablesDB = tablesDb
): Promise<void> {
  const { participants: coordinatorDocs } = await getCoordinatorParticipant(
    tripId,
    db
  )
  if (
    coordinatorDocs.length === 0 ||
    coordinatorDocs[0].participantUserId !== participantUserId
  ) {
    throw new Error('Only the coordinator can delete this trip.')
  }
  const participants = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [Query.equal('tripId', tripId), Query.limit(100)],
    })
  )
  await Promise.allSettled(
    participants.map((p) =>
      db.deleteRow({
        databaseId: DATABASE_ID,
        tableId: PARTICIPANTS_TABLE_ID,
        rowId: p.$id,
      })
    )
  )
  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TRIPS_TABLE_ID,
    rowId: tripId,
  })
}

export async function listParticipatedTrips(
  participantUserId: string,
  db: TablesDB = tablesDb
): Promise<{ trips: Trip[] }> {
  const participants = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [
        Query.equal('participantUserId', participantUserId),
        Query.orderDesc('$createdAt'),
        Query.limit(50),
      ],
    })
  )
  if (participants.length === 0) return { trips: [] }
  const tripIds = participants.map((p) => p.tripId)
  const trips = await fetchRows<Trip>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: TRIPS_TABLE_ID,
      queries: [Query.equal('$id', tripIds)],
    })
  )
  return { trips }
}

export async function joinTrip(
  participantUserId: string,
  participantUserName: string,
  tripId: string,
  db: TablesDB = tablesDb
): Promise<Participant> {
  try {
    await db.getRow({
      databaseId: DATABASE_ID,
      tableId: TRIPS_TABLE_ID,
      rowId: tripId,
    })
  } catch {
    throw new Error('Trip not found.')
  }
  const participants = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [
        Query.equal('participantUserId', participantUserId),
        Query.equal('tripId', tripId),
        Query.limit(1),
      ],
    })
  )
  if (participants.length > 0)
    throw new Error('You have already joined this trip.')
  return fetchRow<Participant>(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      rowId: ID.unique(),
      data: {
        participantUserId,
        participantUserName,
        tripId,
        role: 'participant',
      } as Record<string, unknown>,
      permissions: [
        Permission.read(Role.user(participantUserId)),
        Permission.write(Role.user(participantUserId)),
      ],
    })
  )
}

export async function leaveTrip(
  participantUserId: string,
  tripId: string,
  db: TablesDB = tablesDb
): Promise<void> {
  const participants = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [
        Query.equal('participantUserId', participantUserId),
        Query.equal('tripId', tripId),
        Query.limit(1),
      ],
    })
  )
  if (participants.length === 0)
    throw new Error('Participation record not found.')
  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: PARTICIPANTS_TABLE_ID,
    rowId: participants[0].$id,
  })
}

async function _verifyParticipant(
  tripId: string,
  participantUserId: string,
  db: TablesDB
): Promise<void> {
  const participants = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [
        Query.equal('tripId', tripId),
        Query.equal('participantUserId', participantUserId),
        Query.limit(1),
      ],
    })
  )
  if (participants.length === 0)
    throw new Error('You must be a participant to access proposals.')
}

export async function createProposal(
  tripId: string,
  proposerUserId: string,
  proposerUserName: string,
  data: {
    title?: string
    description: string
    resortName?: string
    country?: string
    altitudeRange?: string
    nearestAirport?: string
    transferTime?: string
    accommodationName?: string
    accommodationUrl?: string
    approximateCost?: string
  },
  db: TablesDB = tablesDb
): Promise<Proposal> {
  await _verifyParticipant(tripId, proposerUserId, db)
  return fetchRow<Proposal>(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: ID.unique(),
      data: {
        tripId,
        proposerUserId,
        proposerUserName,
        state: 'DRAFT',
        ...data,
      } as Record<string, unknown>,
      permissions: [
        Permission.read(Role.users()),
        Permission.write(Role.user(proposerUserId)),
      ],
    })
  )
}

export async function listProposals(
  tripId: string,
  participantUserId: string,
  db: TablesDB = tablesDb
): Promise<{ proposals: Proposal[] }> {
  await _verifyParticipant(tripId, participantUserId, db)
  const proposals = await fetchRows<Proposal>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      queries: [
        Query.equal('tripId', tripId),
        Query.orderDesc('$createdAt'),
        Query.limit(50),
      ],
    })
  )
  return { proposals }
}

export async function getProposal(
  proposalId: string,
  participantUserId: string,
  db: TablesDB = tablesDb
): Promise<Proposal> {
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  await _verifyParticipant(proposal.tripId, participantUserId, db)
  return proposal
}

export async function updateProposal(
  proposalId: string,
  proposerUserId: string,
  data: Partial<Proposal>,
  db: TablesDB = tablesDb
): Promise<Proposal> {
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  if (proposal.proposerUserId !== proposerUserId)
    throw new Error('Only the creator can edit this proposal.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Only draft proposals can be edited.')
  const dataRecord = data as Record<string, unknown>
  const {
    state: _state,
    tripId: _tripId,
    proposerUserId: _proposerUserId,
    ...safeData
  } = dataRecord
  return fetchRow<Proposal>(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
      data: safeData as Record<string, unknown>,
    })
  )
}

export async function deleteProposal(
  proposalId: string,
  proposerUserId: string,
  db: TablesDB = tablesDb
): Promise<void> {
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  if (proposal.proposerUserId !== proposerUserId)
    throw new Error('Only the creator can delete this proposal.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Only draft proposals can be deleted.')
  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: PROPOSALS_TABLE_ID,
    rowId: proposalId,
  })
}

export async function submitProposal(
  proposalId: string,
  proposerUserId: string,
  db: TablesDB = tablesDb
): Promise<Proposal> {
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  if (proposal.proposerUserId !== proposerUserId)
    throw new Error('Only the creator can submit this proposal.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Only draft proposals can be submitted.')
  return fetchRow<Proposal>(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
      data: { state: 'SUBMITTED' } as Record<string, unknown>,
    })
  )
}

export async function rejectProposal(
  proposalId: string,
  pollCreatorUserId: string,
  db: TablesDB = tablesDb
): Promise<Proposal> {
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  if (proposal.state !== 'SUBMITTED') {
    throw new Error('Only submitted proposals can be rejected.')
  }
  const { participants } = await getCoordinatorParticipant(proposal.tripId, db)
  if (
    participants.length === 0 ||
    participants[0].participantUserId !== pollCreatorUserId
  ) {
    throw new Error('Only the coordinator can reject this proposal.')
  }
  return fetchRow<Proposal>(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
      data: { state: 'REJECTED' } as Record<string, unknown>,
    })
  )
}

export async function createPoll(
  tripId: string,
  pollCreatorUserId: string,
  pollCreatorUserName: string,
  db: TablesDB = tablesDb
): Promise<Poll> {
  const { participants: coordDocs } = await getCoordinatorParticipant(
    tripId,
    db
  )
  if (
    coordDocs.length === 0 ||
    coordDocs[0].participantUserId !== pollCreatorUserId
  ) {
    throw new Error('Only the coordinator can create a poll.')
  }
  const openPolls = await fetchRows<Poll>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: POLLS_TABLE_ID,
      queries: [
        Query.equal('tripId', tripId),
        Query.equal('state', 'OPEN'),
        Query.limit(1),
      ],
    })
  )
  if (openPolls.length > 0) {
    throw new Error('A poll is already open for this trip.')
  }
  const proposals = await fetchRows<Proposal>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      queries: [
        Query.equal('tripId', tripId),
        Query.equal('state', 'SUBMITTED'),
        Query.limit(100),
      ],
    })
  )
  if (proposals.length === 0) {
    throw new Error('No submitted proposals to poll on.')
  }
  const proposalIds = proposals.map((p) => p.$id)
  return fetchRow<Poll>(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: POLLS_TABLE_ID,
      rowId: ID.unique(),
      data: {
        tripId,
        pollCreatorUserId,
        pollCreatorUserName,
        state: 'OPEN',
        proposalIds,
      } as Record<string, unknown>,
      permissions: [
        Permission.read(Role.users()),
        Permission.write(Role.user(pollCreatorUserId)),
      ],
    })
  )
}

export async function closePoll(
  pollId: string,
  pollCreatorUserId: string,
  db: TablesDB = tablesDb
): Promise<Poll> {
  const poll = await fetchRow<Poll>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: POLLS_TABLE_ID,
      rowId: pollId,
    })
  )
  if (poll.state !== 'OPEN') throw new Error('Only open polls can be closed.')
  const { participants } = await getCoordinatorParticipant(poll.tripId, db)
  if (
    participants.length === 0 ||
    participants[0].participantUserId !== pollCreatorUserId
  ) {
    throw new Error('Only the coordinator can close a poll.')
  }
  return fetchRow<Poll>(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: POLLS_TABLE_ID,
      rowId: pollId,
      data: { state: 'CLOSED' } as Record<string, unknown>,
    })
  )
}

export async function listPolls(
  tripId: string,
  participantUserId: string,
  db: TablesDB = tablesDb
): Promise<{ polls: Poll[] }> {
  await _verifyParticipant(tripId, participantUserId, db)
  const polls = await fetchRows<Poll>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: POLLS_TABLE_ID,
      queries: [
        Query.equal('tripId', tripId),
        Query.orderDesc('$createdAt'),
        Query.limit(50),
      ],
    })
  )
  return { polls }
}

export async function upsertVote(
  pollId: string,
  tripId: string,
  voterUserId: string,
  proposalIds: string[],
  tokenCounts: number[],
  db: TablesDB = tablesDb
): Promise<Vote> {
  await _verifyParticipant(tripId, voterUserId, db)
  const poll = await fetchRow<Poll>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: POLLS_TABLE_ID,
      rowId: pollId,
    })
  )
  if (poll.state !== 'OPEN') {
    throw new Error('Voting is only allowed on open polls.')
  }
  const total = tokenCounts.reduce((a, b) => a + b, 0)
  if (total > poll.proposalIds.length) {
    throw new Error(`Total tokens cannot exceed ${poll.proposalIds.length}.`)
  }
  const votes = await fetchRows<Vote>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: VOTES_TABLE_ID,
      queries: [
        Query.equal('pollId', pollId),
        Query.equal('voterUserId', voterUserId),
        Query.limit(1),
      ],
    })
  )
  if (votes.length > 0) {
    return fetchRow<Vote>(
      db.updateRow({
        databaseId: DATABASE_ID,
        tableId: VOTES_TABLE_ID,
        rowId: votes[0].$id,
        data: { proposalIds, tokenCounts } as Record<string, unknown>,
      })
    )
  }
  return fetchRow<Vote>(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: VOTES_TABLE_ID,
      rowId: ID.unique(),
      data: {
        pollId,
        tripId,
        voterUserId,
        proposalIds,
        tokenCounts,
      } as Record<string, unknown>,
      permissions: [
        Permission.read(Role.users()),
        Permission.write(Role.user(voterUserId)),
      ],
    })
  )
}

export async function listVotes(
  pollId: string,
  tripId: string,
  participantUserId: string,
  db: TablesDB = tablesDb
): Promise<{ votes: Vote[] }> {
  await _verifyParticipant(tripId, participantUserId, db)
  const votes = await fetchRows<Vote>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: VOTES_TABLE_ID,
      queries: [Query.equal('pollId', pollId), Query.limit(200)],
    })
  )
  return { votes }
}
