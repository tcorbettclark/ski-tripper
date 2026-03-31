import {
  Client,
  Account,
  Databases,
  ID,
  Permission,
  Query,
  Role,
} from 'appwrite'
import adjectives from 'threewords/data/adjectives.json'
import nouns from 'threewords/data/nouns.json'

const client = new Client()
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT as string)
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID as string)

export const account = new Account(client)
export const databases = new Databases(client)
export default client

interface TripDocument {
  $id: string
  code: string
  description: string
  location: string
  startDate: string
  endDate: string
  $createdAt: string
  $updatedAt: string
}

interface ParticipantDocument {
  $id: string
  ParticipantUserId: string
  ParticipantUserName: string
  tripId: string
  role: 'coordinator' | 'participant'
  $createdAt: string
}

interface ProposalDocument {
  $id: string
  tripId: string
  ProposerUserId: string
  ProposerUserName: string
  state: 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED'
  title: string
  description: string
  $createdAt: string
}

interface PollDocument {
  $id: string
  tripId: string
  PollCreatorUserId: string
  PollCreatorUserName: string
  state: 'OPEN' | 'CLOSED'
  proposalIds: string[]
  $createdAt: string
}

interface VoteDocument {
  $id: string
  pollId: string
  tripId: string
  VoterUserId: string
  proposalIds: string[]
  tokenCounts: number[]
  $createdAt: string
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
const TRIPS_COLLECTION_ID = process.env
  .PUBLIC_APPWRITE_TRIPS_COLLECTION_ID as string
const PARTICIPANTS_COLLECTION_ID = process.env
  .PUBLIC_APPWRITE_PARTICIPANTS_COLLECTION_ID as string
const PROPOSALS_COLLECTION_ID = process.env
  .PUBLIC_APPWRITE_PROPOSALS_COLLECTION_ID as string
const POLLS_COLLECTION_ID = process.env
  .PUBLIC_APPWRITE_POLLS_COLLECTION_ID as string
const VOTES_COLLECTION_ID = process.env
  .PUBLIC_APPWRITE_VOTES_COLLECTION_ID as string

export function getCoordinatorParticipant(
  tripId: string,
  db: Databases = databases
): Promise<{ documents: ParticipantDocument[] }> {
  return db.listDocuments(DATABASE_ID, PARTICIPANTS_COLLECTION_ID, [
    Query.equal('tripId', tripId),
    Query.equal('role', 'coordinator'),
    Query.limit(1),
  ]) as unknown as Promise<{ documents: ParticipantDocument[] }>
}

export function listTripParticipants(
  tripId: string,
  db: Databases = databases
): Promise<{ documents: ParticipantDocument[] }> {
  return db.listDocuments(DATABASE_ID, PARTICIPANTS_COLLECTION_ID, [
    Query.equal('tripId', tripId),
    Query.orderDesc('$createdAt'),
    Query.limit(100),
  ]) as unknown as Promise<{ documents: ParticipantDocument[] }>
}

export async function listTrips(
  ParticipantUserId: string,
  db: Databases = databases
): Promise<{
  documents: TripDocument[]
  coordinatorUserIds: Record<string, string>
}> {
  const { documents: coordinatorParticipants } = (await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [
      Query.equal('ParticipantUserId', ParticipantUserId),
      Query.equal('role', 'coordinator'),
      Query.orderDesc('$createdAt'),
      Query.limit(50),
    ]
  )) as unknown as { documents: ParticipantDocument[] }

  if (coordinatorParticipants.length === 0) {
    return { documents: [], coordinatorUserIds: {} }
  }
  const tripIds = coordinatorParticipants.map((p) => p.tripId)
  const coordinatorUserIds = Object.fromEntries(
    coordinatorParticipants.map((p) => [p.tripId, p.ParticipantUserId])
  )
  const { documents: trips } = (await db.listDocuments(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    [Query.equal('$id', tripIds)]
  )) as unknown as { documents: TripDocument[] }
  const tripMap = Object.fromEntries(trips.map((t) => [t.$id, t]))
  const orderedTrips = tripIds.map((id) => tripMap[id]).filter(Boolean)
  return { documents: orderedTrips, coordinatorUserIds }
}

export function getTrip(
  tripId: string,
  db: Databases = databases
): Promise<TripDocument> {
  return db.getDocument(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    tripId
  ) as unknown as Promise<TripDocument>
}

export function getTripByCode(
  code: string,
  db: Databases = databases
): Promise<{ documents: TripDocument[] }> {
  return db.listDocuments(DATABASE_ID, TRIPS_COLLECTION_ID, [
    Query.equal('code', code),
    Query.limit(1),
  ]) as unknown as Promise<{ documents: TripDocument[] }>
}

async function findUniqueCode(db: Databases = databases): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = randomThreeWords()
    const existing = (await db.listDocuments(DATABASE_ID, TRIPS_COLLECTION_ID, [
      Query.equal('code', code),
      Query.limit(1),
    ])) as unknown as { documents: TripDocument[] }
    if (existing.documents.length === 0) return code
  }
  throw new Error('Could not generate a unique trip code after 100 attempts.')
}

export async function createTrip(
  ParticipantUserId: string,
  ParticipantUserName: string,
  data: Partial<TripDocument>,
  db: Databases = databases
): Promise<TripDocument> {
  const code = await findUniqueCode(db)
  const trip = (await db.createDocument(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    ID.unique(),
    { code, ...data } as Record<string, unknown>,
    [
      Permission.read(Role.users()),
      Permission.write(Role.user(ParticipantUserId)),
    ]
  )) as unknown as TripDocument
  await db.createDocument(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    ID.unique(),
    {
      ParticipantUserId,
      ParticipantUserName,
      tripId: trip.$id,
      role: 'coordinator',
    } as Record<string, unknown>,
    [
      Permission.read(Role.user(ParticipantUserId)),
      Permission.write(Role.user(ParticipantUserId)),
    ]
  )
  return trip
}

export async function updateTrip(
  tripId: string,
  data: Partial<TripDocument>,
  ParticipantUserId: string,
  db: Databases = databases
): Promise<TripDocument> {
  const { documents } = await getCoordinatorParticipant(tripId, db)
  if (
    documents.length === 0 ||
    documents[0].ParticipantUserId !== ParticipantUserId
  ) {
    throw new Error('Only the coordinator can edit this trip.')
  }
  return db.updateDocument(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    tripId,
    data as Record<string, unknown>
  ) as unknown as Promise<TripDocument>
}

export async function deleteTrip(
  tripId: string,
  ParticipantUserId: string,
  db: Databases = databases
): Promise<void> {
  const { documents: coordinatorDocs } = await getCoordinatorParticipant(
    tripId,
    db
  )
  if (
    coordinatorDocs.length === 0 ||
    coordinatorDocs[0].ParticipantUserId !== ParticipantUserId
  ) {
    throw new Error('Only the coordinator can delete this trip.')
  }
  const { documents } = (await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [Query.equal('tripId', tripId), Query.limit(100)]
  )) as unknown as { documents: ParticipantDocument[] }
  await Promise.allSettled(
    documents.map((p) =>
      db.deleteDocument(DATABASE_ID, PARTICIPANTS_COLLECTION_ID, p.$id)
    )
  )
  await db.deleteDocument(DATABASE_ID, TRIPS_COLLECTION_ID, tripId)
}

export async function listParticipatedTrips(
  ParticipantUserId: string,
  db: Databases = databases
): Promise<{ documents: TripDocument[] }> {
  const { documents } = (await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [
      Query.equal('ParticipantUserId', ParticipantUserId),
      Query.orderDesc('$createdAt'),
      Query.limit(50),
    ]
  )) as unknown as { documents: ParticipantDocument[] }
  if (documents.length === 0) return { documents: [] }
  const tripIds = documents.map((p) => p.tripId)
  const { documents: trips } = (await db.listDocuments(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    [Query.equal('$id', tripIds)]
  )) as unknown as { documents: TripDocument[] }
  return { documents: trips }
}

export async function joinTrip(
  ParticipantUserId: string,
  ParticipantUserName: string,
  tripId: string,
  db: Databases = databases
): Promise<ParticipantDocument> {
  try {
    await db.getDocument(DATABASE_ID, TRIPS_COLLECTION_ID, tripId)
  } catch {
    throw new Error('Trip not found.')
  }
  const { documents } = (await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [
      Query.equal('ParticipantUserId', ParticipantUserId),
      Query.equal('tripId', tripId),
      Query.limit(1),
    ]
  )) as unknown as { documents: ParticipantDocument[] }
  if (documents.length > 0)
    throw new Error('You have already joined this trip.')
  return db.createDocument(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    ID.unique(),
    {
      ParticipantUserId,
      ParticipantUserName,
      tripId,
      role: 'participant',
    } as Record<string, unknown>,
    [
      Permission.read(Role.user(ParticipantUserId)),
      Permission.write(Role.user(ParticipantUserId)),
    ]
  ) as unknown as Promise<ParticipantDocument>
}

export async function leaveTrip(
  ParticipantUserId: string,
  tripId: string,
  db: Databases = databases
): Promise<void> {
  const { documents } = (await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [
      Query.equal('ParticipantUserId', ParticipantUserId),
      Query.equal('tripId', tripId),
      Query.limit(1),
    ]
  )) as unknown as { documents: ParticipantDocument[] }
  if (documents.length === 0) throw new Error('Participation record not found.')
  await db.deleteDocument(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    documents[0].$id
  )
}

async function _verifyParticipant(
  tripId: string,
  ParticipantUserId: string,
  db: Databases
): Promise<void> {
  const { documents } = (await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [
      Query.equal('tripId', tripId),
      Query.equal('ParticipantUserId', ParticipantUserId),
      Query.limit(1),
    ]
  )) as unknown as { documents: ParticipantDocument[] }
  if (documents.length === 0)
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
  db: Databases = databases
): Promise<ProposalDocument> {
  await _verifyParticipant(tripId, ProposerUserId, db)
  return db.createDocument(
    DATABASE_ID,
    PROPOSALS_COLLECTION_ID,
    ID.unique(),
    {
      tripId,
      ProposerUserId,
      ProposerUserName,
      state: 'DRAFT',
      ...data,
    } as Record<string, unknown>,
    [Permission.read(Role.users()), Permission.write(Role.user(ProposerUserId))]
  ) as unknown as Promise<ProposalDocument>
}

export async function listProposals(
  tripId: string,
  ParticipantUserId: string,
  db: Databases = databases
): Promise<{ documents: ProposalDocument[] }> {
  await _verifyParticipant(tripId, ParticipantUserId, db)
  return db.listDocuments(DATABASE_ID, PROPOSALS_COLLECTION_ID, [
    Query.equal('tripId', tripId),
    Query.orderDesc('$createdAt'),
    Query.limit(50),
  ]) as unknown as Promise<{ documents: ProposalDocument[] }>
}

export async function getProposal(
  proposalId: string,
  ParticipantUserId: string,
  db: Databases = databases
): Promise<ProposalDocument> {
  const proposal = (await db.getDocument(
    DATABASE_ID,
    PROPOSALS_COLLECTION_ID,
    proposalId
  )) as unknown as ProposalDocument
  await _verifyParticipant(proposal.tripId, ParticipantUserId, db)
  return proposal
}

export async function updateProposal(
  proposalId: string,
  ProposerUserId: string,
  data: Partial<ProposalDocument>,
  db: Databases = databases
): Promise<ProposalDocument> {
  const proposal = (await db.getDocument(
    DATABASE_ID,
    PROPOSALS_COLLECTION_ID,
    proposalId
  )) as unknown as ProposalDocument
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
  return db.updateDocument(
    DATABASE_ID,
    PROPOSALS_COLLECTION_ID,
    proposalId,
    safeData as Record<string, unknown>
  ) as unknown as Promise<ProposalDocument>
}

export async function deleteProposal(
  proposalId: string,
  ProposerUserId: string,
  db: Databases = databases
): Promise<void> {
  const proposal = (await db.getDocument(
    DATABASE_ID,
    PROPOSALS_COLLECTION_ID,
    proposalId
  )) as unknown as ProposalDocument
  if (proposal.ProposerUserId !== ProposerUserId)
    throw new Error('Only the creator can delete this proposal.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Only draft proposals can be deleted.')
  await db.deleteDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId)
}

export async function submitProposal(
  proposalId: string,
  ProposerUserId: string,
  db: Databases = databases
): Promise<ProposalDocument> {
  const proposal = (await db.getDocument(
    DATABASE_ID,
    PROPOSALS_COLLECTION_ID,
    proposalId
  )) as unknown as ProposalDocument
  if (proposal.ProposerUserId !== ProposerUserId)
    throw new Error('Only the creator can submit this proposal.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Only draft proposals can be submitted.')
  return db.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId, {
    state: 'SUBMITTED',
  } as Record<string, unknown>) as unknown as Promise<ProposalDocument>
}

export async function rejectProposal(
  proposalId: string,
  PollCreatorUserId: string,
  db: Databases = databases
): Promise<ProposalDocument> {
  const proposal = (await db.getDocument(
    DATABASE_ID,
    PROPOSALS_COLLECTION_ID,
    proposalId
  )) as unknown as ProposalDocument
  if (proposal.state !== 'SUBMITTED') {
    throw new Error('Only submitted proposals can be rejected.')
  }
  const { documents } = await getCoordinatorParticipant(proposal.tripId, db)
  if (
    documents.length === 0 ||
    documents[0].ParticipantUserId !== PollCreatorUserId
  ) {
    throw new Error('Only the coordinator can reject this proposal.')
  }
  return db.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId, {
    state: 'REJECTED',
  } as Record<string, unknown>) as unknown as Promise<ProposalDocument>
}

export async function createPoll(
  tripId: string,
  PollCreatorUserId: string,
  PollCreatorUserName: string,
  db: Databases = databases
): Promise<PollDocument> {
  const { documents: coordDocs } = await getCoordinatorParticipant(tripId, db)
  if (
    coordDocs.length === 0 ||
    coordDocs[0].ParticipantUserId !== PollCreatorUserId
  ) {
    throw new Error('Only the coordinator can create a poll.')
  }
  const { documents: openPolls } = (await db.listDocuments(
    DATABASE_ID,
    POLLS_COLLECTION_ID,
    [
      Query.equal('tripId', tripId),
      Query.equal('state', 'OPEN'),
      Query.limit(1),
    ]
  )) as unknown as { documents: PollDocument[] }
  if (openPolls.length > 0) {
    throw new Error('A poll is already open for this trip.')
  }
  const { documents: proposals } = (await db.listDocuments(
    DATABASE_ID,
    PROPOSALS_COLLECTION_ID,
    [
      Query.equal('tripId', tripId),
      Query.equal('state', 'SUBMITTED'),
      Query.limit(100),
    ]
  )) as unknown as { documents: ProposalDocument[] }
  if (proposals.length === 0) {
    throw new Error('No submitted proposals to poll on.')
  }
  const proposalIds = proposals.map((p) => p.$id)
  return db.createDocument(
    DATABASE_ID,
    POLLS_COLLECTION_ID,
    ID.unique(),
    {
      tripId,
      PollCreatorUserId,
      PollCreatorUserName,
      state: 'OPEN',
      proposalIds,
    } as Record<string, unknown>,
    [
      Permission.read(Role.users()),
      Permission.write(Role.user(PollCreatorUserId)),
    ]
  ) as unknown as Promise<PollDocument>
}

export async function closePoll(
  pollId: string,
  PollCreatorUserId: string,
  db: Databases = databases
): Promise<PollDocument> {
  const poll = (await db.getDocument(
    DATABASE_ID,
    POLLS_COLLECTION_ID,
    pollId
  )) as unknown as PollDocument
  if (poll.state !== 'OPEN') throw new Error('Only open polls can be closed.')
  const { documents } = await getCoordinatorParticipant(poll.tripId, db)
  if (
    documents.length === 0 ||
    documents[0].ParticipantUserId !== PollCreatorUserId
  ) {
    throw new Error('Only the coordinator can close a poll.')
  }
  return db.updateDocument(DATABASE_ID, POLLS_COLLECTION_ID, pollId, {
    state: 'CLOSED',
  } as Record<string, unknown>) as unknown as Promise<PollDocument>
}

export async function listPolls(
  tripId: string,
  ParticipantUserId: string,
  db: Databases = databases
): Promise<{ documents: PollDocument[] }> {
  await _verifyParticipant(tripId, ParticipantUserId, db)
  return db.listDocuments(DATABASE_ID, POLLS_COLLECTION_ID, [
    Query.equal('tripId', tripId),
    Query.orderDesc('$createdAt'),
    Query.limit(50),
  ]) as unknown as Promise<{ documents: PollDocument[] }>
}

export async function upsertVote(
  pollId: string,
  tripId: string,
  VoterUserId: string,
  proposalIds: string[],
  tokenCounts: number[],
  db: Databases = databases
): Promise<VoteDocument> {
  await _verifyParticipant(tripId, VoterUserId, db)
  const poll = (await db.getDocument(
    DATABASE_ID,
    POLLS_COLLECTION_ID,
    pollId
  )) as unknown as PollDocument
  if (poll.state !== 'OPEN') {
    throw new Error('Voting is only allowed on open polls.')
  }
  const total = tokenCounts.reduce((a, b) => a + b, 0)
  if (total > poll.proposalIds.length) {
    throw new Error(`Total tokens cannot exceed ${poll.proposalIds.length}.`)
  }
  const { documents } = (await db.listDocuments(
    DATABASE_ID,
    VOTES_COLLECTION_ID,
    [
      Query.equal('pollId', pollId),
      Query.equal('VoterUserId', VoterUserId),
      Query.limit(1),
    ]
  )) as unknown as { documents: VoteDocument[] }
  if (documents.length > 0) {
    return db.updateDocument(
      DATABASE_ID,
      VOTES_COLLECTION_ID,
      documents[0].$id,
      { proposalIds, tokenCounts } as Record<string, unknown>
    ) as unknown as Promise<VoteDocument>
  }
  return db.createDocument(
    DATABASE_ID,
    VOTES_COLLECTION_ID,
    ID.unique(),
    { pollId, tripId, VoterUserId, proposalIds, tokenCounts } as Record<
      string,
      unknown
    >,
    [Permission.read(Role.users()), Permission.write(Role.user(VoterUserId))]
  ) as unknown as Promise<VoteDocument>
}

export async function listVotes(
  pollId: string,
  tripId: string,
  ParticipantUserId: string,
  db: Databases = databases
): Promise<{ documents: VoteDocument[] }> {
  await _verifyParticipant(tripId, ParticipantUserId, db)
  return db.listDocuments(DATABASE_ID, VOTES_COLLECTION_ID, [
    Query.equal('pollId', pollId),
    Query.limit(200),
  ]) as unknown as Promise<{ documents: VoteDocument[] }>
}
