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
  return rows as T[]
}

async function fetchRows<T>(
  result: Promise<{ rows: Models.Row[] }>
): Promise<{ documents: T[] }> {
  const { rows } = await result
  return { documents: toRows<T>(rows) }
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
  const { documents: participants } = await fetchRows<Participant>(
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
  const { documents: participants } = await fetchRows<Participant>(
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
  ParticipantUserId: string,
  db: TablesDB = tablesDb
): Promise<{
  trips: Trip[]
  coordinatorUserIds: Record<string, string>
}> {
  const { documents: coordinatorParticipants } = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [
        Query.equal('ParticipantUserId', ParticipantUserId),
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
    coordinatorParticipants.map((p) => [p.tripId, p.ParticipantUserId])
  )
  const { documents: trips } = await fetchRows<Trip>(
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
  const { documents: trips } = await fetchRows<Trip>(
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
    const { documents: trips } = await fetchRows<Trip>(
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
  ParticipantUserId: string,
  ParticipantUserName: string,
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
        Permission.write(Role.user(ParticipantUserId)),
      ],
    })
  )
  await db.createRow({
    databaseId: DATABASE_ID,
    tableId: PARTICIPANTS_TABLE_ID,
    rowId: ID.unique(),
    data: {
      ParticipantUserId,
      ParticipantUserName,
      tripId: trip.$id,
      role: 'coordinator',
    } as Record<string, unknown>,
    permissions: [
      Permission.read(Role.user(ParticipantUserId)),
      Permission.write(Role.user(ParticipantUserId)),
    ],
  })
  return trip
}

export async function updateTrip(
  tripId: string,
  data: Partial<Trip>,
  ParticipantUserId: string,
  db: TablesDB = tablesDb
): Promise<Trip> {
  const { participants } = await getCoordinatorParticipant(tripId, db)
  if (
    participants.length === 0 ||
    participants[0].ParticipantUserId !== ParticipantUserId
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
  ParticipantUserId: string,
  db: TablesDB = tablesDb
): Promise<void> {
  const { participants: coordinatorDocs } = await getCoordinatorParticipant(
    tripId,
    db
  )
  if (
    coordinatorDocs.length === 0 ||
    coordinatorDocs[0].ParticipantUserId !== ParticipantUserId
  ) {
    throw new Error('Only the coordinator can delete this trip.')
  }
  const { documents: participants } = await fetchRows<Participant>(
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
  ParticipantUserId: string,
  db: TablesDB = tablesDb
): Promise<{ trips: Trip[] }> {
  const { documents: participants } = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [
        Query.equal('ParticipantUserId', ParticipantUserId),
        Query.orderDesc('$createdAt'),
        Query.limit(50),
      ],
    })
  )
  if (participants.length === 0) return { trips: [] }
  const tripIds = participants.map((p) => p.tripId)
  const { documents: trips } = await fetchRows<Trip>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: TRIPS_TABLE_ID,
      queries: [Query.equal('$id', tripIds)],
    })
  )
  return { trips }
}

export async function joinTrip(
  ParticipantUserId: string,
  ParticipantUserName: string,
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
  const { documents: participants } = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [
        Query.equal('ParticipantUserId', ParticipantUserId),
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
        ParticipantUserId,
        ParticipantUserName,
        tripId,
        role: 'participant',
      } as Record<string, unknown>,
      permissions: [
        Permission.read(Role.user(ParticipantUserId)),
        Permission.write(Role.user(ParticipantUserId)),
      ],
    })
  )
}

export async function leaveTrip(
  ParticipantUserId: string,
  tripId: string,
  db: TablesDB = tablesDb
): Promise<void> {
  const { documents: participants } = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [
        Query.equal('ParticipantUserId', ParticipantUserId),
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
  ParticipantUserId: string,
  db: TablesDB
): Promise<void> {
  const { documents: participants } = await fetchRows<Participant>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PARTICIPANTS_TABLE_ID,
      queries: [
        Query.equal('tripId', tripId),
        Query.equal('ParticipantUserId', ParticipantUserId),
        Query.limit(1),
      ],
    })
  )
  if (participants.length === 0)
    throw new Error('You must be a participant to access proposals.')
}

export async function createProposal(
  tripId: string,
  ProposerUserId: string,
  ProposerUserName: string,
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
  await _verifyParticipant(tripId, ProposerUserId, db)
  return fetchRow<Proposal>(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: ID.unique(),
      data: {
        tripId,
        ProposerUserId,
        ProposerUserName,
        state: 'DRAFT',
        ...data,
      } as Record<string, unknown>,
      permissions: [
        Permission.read(Role.users()),
        Permission.write(Role.user(ProposerUserId)),
      ],
    })
  )
}

export async function listProposals(
  tripId: string,
  ParticipantUserId: string,
  db: TablesDB = tablesDb
): Promise<{ proposals: Proposal[] }> {
  await _verifyParticipant(tripId, ParticipantUserId, db)
  const { documents: proposals } = await fetchRows<Proposal>(
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
  ParticipantUserId: string,
  db: TablesDB = tablesDb
): Promise<Proposal> {
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  await _verifyParticipant(proposal.tripId, ParticipantUserId, db)
  return proposal
}

export async function updateProposal(
  proposalId: string,
  ProposerUserId: string,
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
  if (proposal.ProposerUserId !== ProposerUserId)
    throw new Error('Only the creator can edit this proposal.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Only draft proposals can be edited.')
  const {
    state: _state,
    tripId: _tripId,
    ProposerUserId: _ProposerUserId,
    ...safeData
  } = data
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
  ProposerUserId: string,
  db: TablesDB = tablesDb
): Promise<void> {
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  if (proposal.ProposerUserId !== ProposerUserId)
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
  ProposerUserId: string,
  db: TablesDB = tablesDb
): Promise<Proposal> {
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  if (proposal.ProposerUserId !== ProposerUserId)
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
  PollCreatorUserId: string,
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
    participants[0].ParticipantUserId !== PollCreatorUserId
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
  PollCreatorUserId: string,
  PollCreatorUserName: string,
  db: TablesDB = tablesDb
): Promise<Poll> {
  const { participants: coordDocs } = await getCoordinatorParticipant(
    tripId,
    db
  )
  if (
    coordDocs.length === 0 ||
    coordDocs[0].ParticipantUserId !== PollCreatorUserId
  ) {
    throw new Error('Only the coordinator can create a poll.')
  }
  const { documents: openPolls } = await fetchRows<Poll>(
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
  const { documents: proposals } = await fetchRows<Proposal>(
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
        PollCreatorUserId,
        PollCreatorUserName,
        state: 'OPEN',
        proposalIds,
      } as Record<string, unknown>,
      permissions: [
        Permission.read(Role.users()),
        Permission.write(Role.user(PollCreatorUserId)),
      ],
    })
  )
}

export async function closePoll(
  pollId: string,
  PollCreatorUserId: string,
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
    participants[0].ParticipantUserId !== PollCreatorUserId
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
  ParticipantUserId: string,
  db: TablesDB = tablesDb
): Promise<{ polls: Poll[] }> {
  await _verifyParticipant(tripId, ParticipantUserId, db)
  const { documents: polls } = await fetchRows<Poll>(
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
  VoterUserId: string,
  proposalIds: string[],
  tokenCounts: number[],
  db: TablesDB = tablesDb
): Promise<Vote> {
  await _verifyParticipant(tripId, VoterUserId, db)
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
  const { documents: votes } = await fetchRows<Vote>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: VOTES_TABLE_ID,
      queries: [
        Query.equal('pollId', pollId),
        Query.equal('VoterUserId', VoterUserId),
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
      data: { pollId, tripId, VoterUserId, proposalIds, tokenCounts } as Record<
        string,
        unknown
      >,
      permissions: [
        Permission.read(Role.users()),
        Permission.write(Role.user(VoterUserId)),
      ],
    })
  )
}

export async function listVotes(
  pollId: string,
  tripId: string,
  ParticipantUserId: string,
  db: TablesDB = tablesDb
): Promise<{ votes: Vote[] }> {
  await _verifyParticipant(tripId, ParticipantUserId, db)
  const { documents: votes } = await fetchRows<Vote>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: VOTES_TABLE_ID,
      queries: [Query.equal('pollId', pollId), Query.limit(200)],
    })
  )
  return { votes }
}
