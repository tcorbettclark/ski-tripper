import type { Models } from 'appwrite'
import {
  Account,
  Client,
  ID,
  Permission,
  Query,
  Role,
  Storage,
  TablesDB,
} from 'appwrite'
import type {
  Accommodation,
  Discussion,
  Participant,
  Poll,
  Preferences,
  Proposal,
  Trip,
  Vote,
} from './types.d'
import { dayjs, isValidUrl, parseJsonArray, randomThreeWords } from './utils'

export function hasSession(): boolean {
  const projectId = process.env.PUBLIC_APPWRITE_PROJECT_ID as string
  if (projectId && document.cookie.includes(`a_session_${projectId}`))
    return true
  if (localStorage.getItem('cookieFallback')) return true
  return false
}

const client = new Client()
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT as string)
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID as string)

export const account = new Account(client)
export const tablesDb = new TablesDB(client)
export const storage = new Storage(client)
export default client

const RESORTS_BUCKET_ID = process.env
  .PUBLIC_APPWRITE_RESORTS_BUCKET_ID as string
const RESORTS_FILE_ID = process.env.PUBLIC_APPWRITE_RESORTS_FILE_ID as string

export function getResortDataUrl(updatedAt: number): string {
  const url = storage.getFileView({
    bucketId: RESORTS_BUCKET_ID,
    fileId: RESORTS_FILE_ID,
  })
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}_t=${updatedAt}`
}

export async function getResortFileMetadata(): Promise<Models.File> {
  return storage.getFile({
    bucketId: RESORTS_BUCKET_ID,
    fileId: RESORTS_FILE_ID,
  })
}

export async function fetchResortDataWithAuth(): Promise<string> {
  const file = await getResortFileMetadata()
  const url = getResortDataUrl(new Date(file.$updatedAt).getTime())
  const headers: Record<string, string> = {
    'X-Appwrite-Project': process.env.PUBLIC_APPWRITE_PROJECT_ID as string,
  }
  const cookieFallback = window.localStorage.getItem('cookieFallback')
  if (cookieFallback) {
    headers['X-Fallback-Cookies'] = cookieFallback
  }
  const response = await fetch(url, {
    credentials: 'include',
    headers,
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch resort data: ${response.status}`)
  }
  return response.text()
}

function toRow<T extends { $id: string }>(row: Models.Row): T {
  if (!row || typeof (row as { $id?: unknown }).$id !== 'string') {
    throw new Error('Failed to fetch row: expected $id')
  }
  return row as unknown as T
}

function toRows<T extends { $id: string }>(rows: Models.Row[]): T[] {
  return rows.map((row) => toRow<T>(row))
}

async function fetchRows<T extends { $id: string }>(
  result: Promise<{ rows: Models.Row[] }>
): Promise<T[]> {
  const { rows } = await result
  return toRows<T>(rows)
}

async function fetchRow<T extends { $id: string }>(
  result: Promise<Models.Row>
): Promise<T> {
  return toRow<T>(await result)
}

function parseProposal(proposal: Proposal): Proposal {
  proposal.websites = parseJsonArray(proposal.websites as unknown as string)
  return proposal
}

function parsePoll(poll: Poll): Poll {
  return poll
}

function parseVote(vote: Vote): Vote {
  return vote
}

async function fetchProposalRows(
  result: Promise<{ rows: Models.Row[] }>
): Promise<Proposal[]> {
  return (await fetchRows<Proposal>(result)).map(parseProposal)
}

async function fetchProposalRow(
  result: Promise<Models.Row>
): Promise<Proposal> {
  return parseProposal(await fetchRow<Proposal>(result))
}

async function fetchPollRows(
  result: Promise<{ rows: Models.Row[] }>
): Promise<Poll[]> {
  return (await fetchRows<Poll>(result)).map(parsePoll)
}

async function fetchPollRow(result: Promise<Models.Row>): Promise<Poll> {
  return parsePoll(await fetchRow<Poll>(result))
}

async function fetchVoteRows(
  result: Promise<{ rows: Models.Row[] }>
): Promise<Vote[]> {
  return (await fetchRows<Vote>(result)).map(parseVote)
}

async function fetchVoteRow(result: Promise<Models.Row>): Promise<Vote> {
  return parseVote(await fetchRow<Vote>(result))
}

const DATABASE_ID = process.env.PUBLIC_APPWRITE_DATABASE_ID as string
const TRIPS_TABLE_ID = process.env.PUBLIC_APPWRITE_TRIPS_TABLE_ID as string
const PARTICIPANTS_TABLE_ID = process.env
  .PUBLIC_APPWRITE_PARTICIPANTS_TABLE_ID as string
const PROPOSALS_TABLE_ID = process.env
  .PUBLIC_APPWRITE_PROPOSALS_TABLE_ID as string
const ACCOMMODATIONS_TABLE_ID = process.env
  .PUBLIC_APPWRITE_ACCOMMODATIONS_TABLE_ID as string
const POLLS_TABLE_ID = process.env.PUBLIC_APPWRITE_POLLS_TABLE_ID as string
const VOTES_TABLE_ID = process.env.PUBLIC_APPWRITE_VOTES_TABLE_ID as string
const PREFERENCES_TABLE_ID = process.env
  .PUBLIC_APPWRITE_PREFERENCES_TABLE_ID as string
const DISCUSSION_TABLE_ID = process.env
  .PUBLIC_APPWRITE_DISCUSSION_TABLE_ID as string

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
  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TRIPS_TABLE_ID,
    rowId: tripId,
  })
  const [participants, proposals, polls] = await Promise.all([
    fetchRows<Participant>(
      db.listRows({
        databaseId: DATABASE_ID,
        tableId: PARTICIPANTS_TABLE_ID,
        queries: [Query.equal('tripId', tripId), Query.limit(5000)],
      })
    ),
    fetchProposalRows(
      db.listRows({
        databaseId: DATABASE_ID,
        tableId: PROPOSALS_TABLE_ID,
        queries: [Query.equal('tripId', tripId), Query.limit(1000)],
      })
    ),
    fetchPollRows(
      db.listRows({
        databaseId: DATABASE_ID,
        tableId: POLLS_TABLE_ID,
        queries: [Query.equal('tripId', tripId), Query.limit(100)],
      })
    ),
  ])
  const votes =
    polls.length > 0
      ? await fetchVoteRows(
          db.listRows({
            databaseId: DATABASE_ID,
            tableId: VOTES_TABLE_ID,
            queries: [
              Query.equal(
                'pollId',
                polls.map((p) => p.$id)
              ),
              Query.limit(5000),
            ],
          })
        )
      : []
  const accommodations =
    proposals.length > 0
      ? await fetchRows<Accommodation>(
          db.listRows({
            databaseId: DATABASE_ID,
            tableId: ACCOMMODATIONS_TABLE_ID,
            queries: [
              Query.equal(
                'proposalId',
                proposals.map((p) => p.$id)
              ),
              Query.limit(5000),
            ],
          })
        )
      : []
  if (participants.length >= 5000)
    throw new Error('Too many participants to delete.')
  if (proposals.length >= 1000) throw new Error('Too many proposals to delete.')
  if (votes.length >= 5000) throw new Error('Too many votes to delete.')
  if (polls.length >= 100) throw new Error('Too many polls to delete.')
  if (accommodations.length >= 5000)
    throw new Error('Too many accommodations to delete.')
  await Promise.all([
    ...accommodations.map((a) =>
      db.deleteRow({
        databaseId: DATABASE_ID,
        tableId: ACCOMMODATIONS_TABLE_ID,
        rowId: a.$id,
      })
    ),
    ...participants.map((p) =>
      db.deleteRow({
        databaseId: DATABASE_ID,
        tableId: PARTICIPANTS_TABLE_ID,
        rowId: p.$id,
      })
    ),
    ...proposals.map((p) =>
      db.deleteRow({
        databaseId: DATABASE_ID,
        tableId: PROPOSALS_TABLE_ID,
        rowId: p.$id,
      })
    ),
    ...votes.map((v) =>
      db.deleteRow({
        databaseId: DATABASE_ID,
        tableId: VOTES_TABLE_ID,
        rowId: v.$id,
      })
    ),
    ...polls.map((p) =>
      db.deleteRow({
        databaseId: DATABASE_ID,
        tableId: POLLS_TABLE_ID,
        rowId: p.$id,
      })
    ),
  ])
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
  if (participants[0].role === 'coordinator')
    throw new Error('The coordinator cannot leave the trip.')
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
    throw new Error('You must be a participant to access this trip.')
}

async function _verifyParticipantByPoll(
  pollId: string,
  participantUserId: string,
  db: TablesDB
): Promise<void> {
  const poll = await fetchPollRow(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: POLLS_TABLE_ID,
      rowId: pollId,
    })
  )
  await _verifyParticipant(poll.tripId, participantUserId, db)
}

export async function createProposal(
  tripId: string,
  proposerUserId: string,
  proposerUserName: string,
  data: {
    description: string
    startDate: string
    endDate: string
    resortData: {
      resortName: string
      country: string
      region: string
      summitAltitude: number
      baseAltitude: number
      nearestAirport: string
      transferTime: number
      pisteKm: number
      beginnerPct: number
      intermediatePct: number
      advancedPct: number
      liftCount: number
      snowReliability: 'high' | 'medium' | 'low'
      skiSeasonMonths: string
      websites: string[]
      latitude: string
      longitude: string
      linkedResortsDescription: string
    }
  },
  db: TablesDB = tablesDb
): Promise<Proposal> {
  await _verifyParticipant(tripId, proposerUserId, db)
  const { resortData, ...userData } = data
  return fetchProposalRow(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: ID.unique(),
      data: {
        tripId,
        proposerUserId,
        proposerUserName,
        state: 'DRAFT',
        ...userData,
        ...resortData,
        websites: JSON.stringify(resortData.websites),
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
  const proposals = await fetchProposalRows(
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
  const proposal = await fetchProposalRow(
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
  const proposal = await fetchProposalRow(
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
  if (Array.isArray(safeData.websites))
    safeData.websites = JSON.stringify(safeData.websites)
  return fetchProposalRow(
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
  const proposal = await fetchProposalRow(
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
  const accommodations = await fetchRows<Accommodation>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      queries: [Query.equal('proposalId', proposalId), Query.limit(5)],
    })
  )
  const discussions = await fetchRows<Discussion>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: DISCUSSION_TABLE_ID,
      queries: [Query.equal('proposalId', proposalId), Query.limit(5000)],
    })
  )
  await Promise.all([
    ...accommodations.map((a) =>
      db.deleteRow({
        databaseId: DATABASE_ID,
        tableId: ACCOMMODATIONS_TABLE_ID,
        rowId: a.$id,
      })
    ),
    ...discussions.map((d) =>
      db.deleteRow({
        databaseId: DATABASE_ID,
        tableId: DISCUSSION_TABLE_ID,
        rowId: d.$id,
      })
    ),
  ])
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
  const proposal = await fetchProposalRow(
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
  const accommodations = await fetchRows<Accommodation>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      queries: [Query.equal('proposalId', proposalId), Query.limit(5)],
    })
  )
  if (accommodations.length === 0)
    throw new Error(
      'At least one accommodation is required to submit a proposal.'
    )
  const updated = await fetchProposalRow(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
      data: { state: 'SUBMITTED' } as Record<string, unknown>,
    })
  )
  await createSystemMessage(
    proposalId,
    `${proposal.proposerUserName} submitted this proposal`,
    db
  )
  return updated
}

export async function rejectProposal(
  proposalId: string,
  pollCreatorUserId: string,
  db: TablesDB = tablesDb
): Promise<Proposal> {
  const proposal = await fetchProposalRow(
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
  const updated = await fetchProposalRow(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
      data: { state: 'REJECTED' } as Record<string, unknown>,
    })
  )
  await createSystemMessage(
    proposalId,
    `${participants[0].participantUserName} rejected this proposal`,
    db
  )
  return updated
}

export async function revertProposalToDraft(
  proposalId: string,
  pollCreatorUserId: string,
  db: TablesDB = tablesDb
): Promise<Proposal> {
  const proposal = await fetchProposalRow(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  if (proposal.state !== 'REJECTED') {
    throw new Error('Only rejected proposals can be moved back to draft.')
  }
  const { participants } = await getCoordinatorParticipant(proposal.tripId, db)
  if (
    participants.length === 0 ||
    participants[0].participantUserId !== pollCreatorUserId
  ) {
    throw new Error(
      'Only the coordinator can move this proposal back to draft.'
    )
  }
  const updated = await fetchProposalRow(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
      data: { state: 'DRAFT' } as Record<string, unknown>,
    })
  )
  await createSystemMessage(
    proposalId,
    `${participants[0].participantUserName} moved this proposal back to draft`,
    db
  )
  return updated
}

export async function createPoll(
  tripId: string,
  pollCreatorUserId: string,
  pollCreatorUserName: string,
  durationDays: number,
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
  const openPolls = await fetchPollRows(
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
  const proposals = await fetchProposalRows(
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
  const startDate = dayjs().toISOString()
  const endDate = dayjs().add(durationDays, 'day').toISOString()
  return fetchPollRow(
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
        startDate,
        endDate,
        outcome: '',
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
  outcome: string,
  db: TablesDB = tablesDb
): Promise<Poll> {
  if (!outcome.trim()) throw new Error('Outcome is required to close a poll.')
  const poll = await fetchPollRow(
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
  return fetchPollRow(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: POLLS_TABLE_ID,
      rowId: pollId,
      data: { state: 'CLOSED', outcome } as Record<string, unknown>,
    })
  )
}

export async function listPolls(
  tripId: string,
  participantUserId: string,
  db: TablesDB = tablesDb
): Promise<{ polls: Poll[] }> {
  await _verifyParticipant(tripId, participantUserId, db)
  const polls = await fetchPollRows(
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
  voterUserId: string,
  proposalIds: string[],
  tokenCounts: number[],
  db: TablesDB = tablesDb
): Promise<Vote> {
  const poll = await fetchPollRow(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: POLLS_TABLE_ID,
      rowId: pollId,
    })
  )
  await _verifyParticipant(poll.tripId, voterUserId, db)
  if (poll.state !== 'OPEN') {
    throw new Error('Voting is only allowed on open polls.')
  }
  if (proposalIds.length !== tokenCounts.length) {
    throw new Error('proposalIds and tokenCounts must have the same length.')
  }
  const invalidIds = proposalIds.filter((id) => !poll.proposalIds.includes(id))
  if (invalidIds.length > 0) {
    throw new Error('Vote contains proposal IDs not in this poll.')
  }
  const total = tokenCounts.reduce((a, b) => a + b, 0)
  if (total > poll.proposalIds.length) {
    throw new Error(`Total tokens cannot exceed ${poll.proposalIds.length}.`)
  }
  const votes = await fetchVoteRows(
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
    return fetchVoteRow(
      db.updateRow({
        databaseId: DATABASE_ID,
        tableId: VOTES_TABLE_ID,
        rowId: votes[0].$id,
        data: {
          proposalIds,
          tokenCounts,
        } as Record<string, unknown>,
      })
    )
  }
  return fetchVoteRow(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: VOTES_TABLE_ID,
      rowId: ID.unique(),
      data: {
        pollId,
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
  participantUserId: string,
  db: TablesDB = tablesDb
): Promise<{ votes: Vote[] }> {
  await _verifyParticipantByPoll(pollId, participantUserId, db)
  const votes = await fetchVoteRows(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: VOTES_TABLE_ID,
      queries: [Query.equal('pollId', pollId), Query.limit(200)],
    })
  )
  return { votes }
}

function validateUrl(url: string | undefined): string | undefined {
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL: only http and https schemes are allowed.')
  }
  return url
}

export async function createAccommodation(
  proposalId: string,
  proposerUserId: string,
  data: {
    name: string
    url?: string
    cost?: string
    description?: string
  },
  db: TablesDB = tablesDb
): Promise<Accommodation> {
  const proposal = await fetchProposalRow(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  if (proposal.proposerUserId !== proposerUserId)
    throw new Error('Only the creator can add accommodations.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Accommodations can only be added to draft proposals.')
  const accommodations = await listAccommodations(proposalId, db)
  if (accommodations.length >= 5)
    throw new Error('Maximum of 5 accommodations allowed per proposal.')
  return fetchRow<Accommodation>(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      rowId: ID.unique(),
      data: {
        proposalId,
        ...data,
        url: validateUrl(data.url),
      } as Record<string, unknown>,
      permissions: [
        Permission.read(Role.users()),
        Permission.write(Role.user(proposerUserId)),
      ],
    })
  )
}

export async function listAccommodations(
  proposalId: string,
  db: TablesDB = tablesDb
): Promise<Accommodation[]> {
  return fetchRows<Accommodation>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      queries: [
        Query.equal('proposalId', proposalId),
        Query.orderDesc('$createdAt'),
        Query.limit(5),
      ],
    })
  )
}

export async function updateAccommodation(
  accommodationId: string,
  proposerUserId: string,
  data: {
    name?: string
    url?: string
    cost?: string
    description?: string
  },
  db: TablesDB = tablesDb
): Promise<Accommodation> {
  const accommodation = await fetchRow<Accommodation>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      rowId: accommodationId,
    })
  )
  const proposal = await fetchProposalRow(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: accommodation.proposalId,
    })
  )
  if (proposal.proposerUserId !== proposerUserId)
    throw new Error('Only the creator can edit accommodations.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Accommodations can only be edited on draft proposals.')
  return fetchRow<Accommodation>(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      rowId: accommodationId,
      data: {
        ...data,
        ...(data.url !== undefined && { url: validateUrl(data.url) }),
      } as Record<string, unknown>,
    })
  )
}

export async function deleteAccommodation(
  accommodationId: string,
  proposerUserId: string,
  db: TablesDB = tablesDb
): Promise<void> {
  const accommodation = await fetchRow<Accommodation>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      rowId: accommodationId,
    })
  )
  const proposal = await fetchProposalRow(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: accommodation.proposalId,
    })
  )
  if (proposal.proposerUserId !== proposerUserId)
    throw new Error('Only the creator can delete accommodations.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Accommodations can only be deleted from draft proposals.')
  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: ACCOMMODATIONS_TABLE_ID,
    rowId: accommodationId,
  })
}

export async function getPreferences(
  userId: string,
  db: TablesDB = tablesDb
): Promise<Preferences | null> {
  const rows = await fetchRows<Preferences>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: PREFERENCES_TABLE_ID,
      queries: [Query.equal('userId', userId), Query.limit(1)],
    })
  )
  return rows.length > 0 ? rows[0] : null
}

export async function createPreferences(
  userId: string,
  data: Omit<Preferences, '$id' | '$createdAt' | '$updatedAt' | 'userId'>,
  db: TablesDB = tablesDb
): Promise<Preferences> {
  return fetchRow<Preferences>(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: PREFERENCES_TABLE_ID,
      rowId: ID.unique(),
      data: { userId, ...data } as Record<string, unknown>,
      permissions: [
        Permission.read(Role.users()),
        Permission.write(Role.user(userId)),
      ],
    })
  )
}

export async function updatePreferences(
  userId: string,
  data: Partial<
    Omit<Preferences, '$id' | '$createdAt' | '$updatedAt' | 'userId'>
  >,
  db: TablesDB = tablesDb
): Promise<Preferences> {
  const existing = await getPreferences(userId, db)
  if (!existing) throw new Error('Preferences not found.')
  return fetchRow<Preferences>(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: PREFERENCES_TABLE_ID,
      rowId: existing.$id,
      data: data as Record<string, unknown>,
    })
  )
}

export async function listDiscussion(
  proposalId: string,
  db: TablesDB = tablesDb
): Promise<Discussion[]> {
  return fetchRows<Discussion>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: DISCUSSION_TABLE_ID,
      queries: [
        Query.equal('proposalId', proposalId),
        Query.orderAsc('$createdAt'),
        Query.limit(500),
      ],
    })
  )
}

export async function createDiscussionComment(
  proposalId: string,
  authorUserId: string,
  authorUserName: string,
  body: string,
  db: TablesDB = tablesDb
): Promise<Discussion> {
  return fetchRow<Discussion>(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: DISCUSSION_TABLE_ID,
      rowId: ID.unique(),
      data: {
        proposalId,
        authorUserId,
        authorUserName,
        body,
        type: 'comment',
      } as Record<string, unknown>,
      permissions: [
        Permission.read(Role.users()),
        Permission.write(Role.user(authorUserId)),
      ],
    })
  )
}

export async function updateDiscussionComment(
  commentId: string,
  authorUserId: string,
  body: string,
  db: TablesDB = tablesDb
): Promise<Discussion> {
  const comment = await fetchRow<Discussion>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: DISCUSSION_TABLE_ID,
      rowId: commentId,
    })
  )
  if (comment.authorUserId !== authorUserId)
    throw new Error('Only the author can edit this comment.')
  if (comment.type !== 'comment')
    throw new Error('System messages cannot be edited.')
  return fetchRow<Discussion>(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: DISCUSSION_TABLE_ID,
      rowId: commentId,
      data: { body } as Record<string, unknown>,
    })
  )
}

export async function deleteDiscussionComment(
  commentId: string,
  authorUserId: string,
  db: TablesDB = tablesDb
): Promise<void> {
  const comment = await fetchRow<Discussion>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: DISCUSSION_TABLE_ID,
      rowId: commentId,
    })
  )
  if (comment.authorUserId !== authorUserId)
    throw new Error('Only the author can delete this comment.')
  if (comment.type !== 'comment')
    throw new Error('System messages cannot be deleted.')
  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: DISCUSSION_TABLE_ID,
    rowId: commentId,
  })
}

export async function createSystemMessage(
  proposalId: string,
  body: string,
  db: TablesDB = tablesDb
): Promise<Discussion> {
  return fetchRow<Discussion>(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: DISCUSSION_TABLE_ID,
      rowId: ID.unique(),
      data: {
        proposalId,
        authorUserId: '',
        authorUserName: 'System',
        body,
        type: 'system',
      } as Record<string, unknown>,
      permissions: [Permission.read(Role.users())],
    })
  )
}
