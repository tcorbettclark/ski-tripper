import { Client, Account, Databases, ID, Permission, Query, Role } from 'appwrite'
import adjectives from 'threewords/data/adjectives.json'
import nouns from 'threewords/data/nouns.json'

const client = new Client()
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)

export const account = new Account(client)
export const databases = new Databases(client)
export default client

function randomThreeWords () {
  const ints = new Uint32Array(3)
  crypto.getRandomValues(ints)
  const one = adjectives[ints[0] % adjectives.length]
  const two = adjectives[ints[1] % adjectives.length]
  const three = nouns[ints[2] % nouns.length]
  return `${one}-${two}-${three}`.toLowerCase()
}

const DATABASE_ID = process.env.PUBLIC_APPWRITE_DATABASE_ID
const TRIPS_COLLECTION_ID = process.env.PUBLIC_APPWRITE_TRIPS_COLLECTION_ID
const PARTICIPANTS_COLLECTION_ID = process.env.PUBLIC_APPWRITE_PARTICIPANTS_COLLECTION_ID
const PROPOSALS_COLLECTION_ID = process.env.PUBLIC_APPWRITE_PROPOSALS_COLLECTION_ID
const POLLS_COLLECTION_ID = process.env.PUBLIC_APPWRITE_POLLS_COLLECTION_ID
const VOTES_COLLECTION_ID = process.env.PUBLIC_APPWRITE_VOTES_COLLECTION_ID

export function getCoordinatorParticipant (tripId, db = databases) {
  return db.listDocuments(DATABASE_ID, PARTICIPANTS_COLLECTION_ID, [
    Query.equal('tripId', tripId),
    Query.equal('role', 'coordinator'),
    Query.limit(1)
  ])
}

export async function listTrips (userId, db = databases) {
  const { documents: coordinatorParticipants } = await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [
      Query.equal('userId', userId),
      Query.equal('role', 'coordinator'),
      Query.orderDesc('$createdAt'),
      Query.limit(50)
    ]
  )
  if (coordinatorParticipants.length === 0) {
    return { documents: [], coordinatorUserIds: {} }
  }
  const tripIds = coordinatorParticipants.map((p) => p.tripId)
  const coordinatorUserIds = Object.fromEntries(
    coordinatorParticipants.map((p) => [p.tripId, p.userId])
  )
  const { documents: trips } = await db.listDocuments(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    [Query.equal('$id', tripIds)]
  )
  const tripMap = Object.fromEntries(trips.map((t) => [t.$id, t]))
  const orderedTrips = tripIds.map((id) => tripMap[id]).filter(Boolean)
  return { documents: orderedTrips, coordinatorUserIds }
}

export function getTrip (tripId, db = databases) {
  return db.getDocument(DATABASE_ID, TRIPS_COLLECTION_ID, tripId)
}

export function getTripByCode (code, db = databases) {
  return db.listDocuments(DATABASE_ID, TRIPS_COLLECTION_ID, [
    Query.equal('code', code),
    Query.limit(1)
  ])
}

async function findUniqueCode (db = databases) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = randomThreeWords()
    const existing = await db.listDocuments(DATABASE_ID, TRIPS_COLLECTION_ID, [
      Query.equal('code', code),
      Query.limit(1)
    ])
    if (existing.documents.length === 0) return code
  }
  throw new Error('Could not generate a unique trip code after 100 attempts.')
}

export async function createTrip (userId, data, db = databases) {
  const code = await findUniqueCode(db)
  const trip = await db.createDocument(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    ID.unique(),
    { code, ...data },
    [Permission.read(Role.users()), Permission.write(Role.user(userId))]
  )
  await db.createDocument(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    ID.unique(),
    { userId, tripId: trip.$id, role: 'coordinator' },
    [Permission.read(Role.user(userId)), Permission.write(Role.user(userId))]
  )
  return trip
}

export async function getUserById (userId) {
  const res = await fetch(
    `${process.env.PUBLIC_APPWRITE_ENDPOINT}/users/${userId}`,
    {
      headers: {
        'X-Appwrite-Project': process.env.PUBLIC_APPWRITE_PROJECT_ID,
        'X-Appwrite-Key': process.env.PUBLIC_APPWRITE_READ_USERS_API_KEY
      }
    }
  )
  if (!res.ok) throw new Error('Failed to fetch user')
  return res.json()
}

// Note: PUBLIC_APPWRITE_READ_USERS_API_KEY is intentionally exposed (prefixed PUBLIC_)
// because it is a read-only key used to fetch user display names for the coordinator
// column. This is acceptable for this use case; do not use a full API key here.

export async function updateTrip (tripId, data, userId, db = databases) {
  const { documents } = await getCoordinatorParticipant(tripId, db)
  if (documents.length === 0 || documents[0].userId !== userId) {
    throw new Error('Only the coordinator can edit this trip.')
  }
  return db.updateDocument(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    tripId,
    data
  )
}

export async function deleteTrip (tripId, userId, db = databases) {
  const { documents: coordinatorDocs } = await getCoordinatorParticipant(tripId, db)
  if (coordinatorDocs.length === 0 || coordinatorDocs[0].userId !== userId) {
    throw new Error('Only the coordinator can delete this trip.')
  }
  const { documents } = await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [Query.equal('tripId', tripId), Query.limit(100)]
  )
  await Promise.allSettled(
    documents.map((p) => db.deleteDocument(DATABASE_ID, PARTICIPANTS_COLLECTION_ID, p.$id))
  )
  return db.deleteDocument(DATABASE_ID, TRIPS_COLLECTION_ID, tripId)
}

export async function listParticipatedTrips (userId, db = databases) {
  const { documents } = await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.limit(50)]
  )
  if (documents.length === 0) return { documents: [] }
  const tripIds = documents.map((p) => p.tripId)
  const { documents: trips } = await db.listDocuments(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    [Query.equal('$id', tripIds)]
  )
  return { documents: trips }
}

export async function joinTrip (userId, tripId, db = databases) {
  try {
    await db.getDocument(DATABASE_ID, TRIPS_COLLECTION_ID, tripId)
  } catch {
    throw new Error('Trip not found.')
  }
  const { documents } = await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [Query.equal('userId', userId), Query.equal('tripId', tripId), Query.limit(1)]
  )
  if (documents.length > 0) throw new Error('You have already joined this trip.')
  return db.createDocument(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    ID.unique(),
    { userId, tripId, role: 'participant' },
    [Permission.read(Role.user(userId)), Permission.write(Role.user(userId))]
  )
}

export async function leaveTrip (userId, tripId, db = databases) {
  const { documents } = await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [Query.equal('userId', userId), Query.equal('tripId', tripId), Query.limit(1)]
  )
  if (documents.length === 0) throw new Error('Participation record not found.')
  return db.deleteDocument(DATABASE_ID, PARTICIPANTS_COLLECTION_ID, documents[0].$id)
}

async function _verifyParticipant (tripId, userId, db) {
  const { documents } = await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [Query.equal('tripId', tripId), Query.equal('userId', userId), Query.limit(1)]
  )
  if (documents.length === 0) throw new Error('You must be a participant to access proposals.')
}

export async function createProposal (tripId, userId, data, db = databases) {
  await _verifyParticipant(tripId, userId, db)
  return db.createDocument(
    DATABASE_ID,
    PROPOSALS_COLLECTION_ID,
    ID.unique(),
    { tripId, userId, state: 'DRAFT', ...data },
    [Permission.read(Role.users()), Permission.write(Role.user(userId))]
  )
}

export async function listProposals (tripId, userId, db = databases) {
  await _verifyParticipant(tripId, userId, db)
  return db.listDocuments(DATABASE_ID, PROPOSALS_COLLECTION_ID, [
    Query.equal('tripId', tripId),
    Query.orderDesc('$createdAt'),
    Query.limit(50)
  ])
}

export async function getProposal (proposalId, userId, db = databases) {
  const proposal = await db.getDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId)
  await _verifyParticipant(proposal.tripId, userId, db)
  return proposal
}

export async function updateProposal (proposalId, userId, data, db = databases) {
  const proposal = await db.getDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId)
  if (proposal.userId !== userId) throw new Error('Only the creator can edit this proposal.')
  if (proposal.state !== 'DRAFT') throw new Error('Only draft proposals can be edited.')
  const { state: _state, tripId: _tripId, userId: _userId, ...safeData } = data
  return db.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId, safeData)
}

export async function deleteProposal (proposalId, userId, db = databases) {
  const proposal = await db.getDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId)
  if (proposal.userId !== userId) throw new Error('Only the creator can delete this proposal.')
  if (proposal.state !== 'DRAFT') throw new Error('Only draft proposals can be deleted.')
  return db.deleteDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId)
}

export async function submitProposal (proposalId, userId, db = databases) {
  const proposal = await db.getDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId)
  if (proposal.userId !== userId) throw new Error('Only the creator can submit this proposal.')
  if (proposal.state !== 'DRAFT') throw new Error('Only draft proposals can be submitted.')
  return db.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId, { state: 'SUBMITTED' })
}

export async function rejectProposal (proposalId, userId, db = databases) {
  const proposal = await db.getDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId)
  if (proposal.state !== 'SUBMITTED')
    throw new Error('Only submitted proposals can be rejected.')
  const { documents } = await getCoordinatorParticipant(proposal.tripId, db)
  if (documents.length === 0 || documents[0].userId !== userId) {
    throw new Error('Only the coordinator can reject this proposal.')
  }
  return db.updateDocument(DATABASE_ID, PROPOSALS_COLLECTION_ID, proposalId, {
    state: 'REJECTED',
  })
}

export async function createPoll (tripId, userId, db = databases) {
  const { documents: coordDocs } = await getCoordinatorParticipant(tripId, db)
  if (coordDocs.length === 0 || coordDocs[0].userId !== userId) {
    throw new Error('Only the coordinator can create a poll.')
  }
  const { documents: openPolls } = await db.listDocuments(
    DATABASE_ID,
    POLLS_COLLECTION_ID,
    [
      Query.equal('tripId', tripId),
      Query.equal('state', 'OPEN'),
      Query.limit(1),
    ],
  )
  if (openPolls.length > 0)
    throw new Error('A poll is already open for this trip.')
  const { documents: proposals } = await db.listDocuments(
    DATABASE_ID,
    PROPOSALS_COLLECTION_ID,
    [
      Query.equal('tripId', tripId),
      Query.equal('state', 'SUBMITTED'),
      Query.limit(100),
    ],
  )
  if (proposals.length === 0)
    throw new Error('No submitted proposals to poll on.')
  const proposalIds = proposals.map((p) => p.$id)
  return db.createDocument(
    DATABASE_ID,
    POLLS_COLLECTION_ID,
    ID.unique(),
    { tripId, createdBy: userId, state: 'OPEN', proposalIds },
    [Permission.read(Role.users()), Permission.write(Role.user(userId))],
  )
}

export async function closePoll (pollId, userId, db = databases) {
  const poll = await db.getDocument(DATABASE_ID, POLLS_COLLECTION_ID, pollId)
  if (poll.state !== 'OPEN') throw new Error('Only open polls can be closed.')
  const { documents } = await getCoordinatorParticipant(poll.tripId, db)
  if (documents.length === 0 || documents[0].userId !== userId) {
    throw new Error('Only the coordinator can close a poll.')
  }
  return db.updateDocument(DATABASE_ID, POLLS_COLLECTION_ID, pollId, {
    state: 'CLOSED',
  })
}

export async function listPolls (tripId, userId, db = databases) {
  await _verifyParticipant(tripId, userId, db)
  return db.listDocuments(DATABASE_ID, POLLS_COLLECTION_ID, [
    Query.equal('tripId', tripId),
    Query.orderDesc('$createdAt'),
    Query.limit(50),
  ])
}

export async function upsertVote (
  pollId,
  tripId,
  userId,
  proposalIds,
  tokenCounts,
  db = databases,
) {
  await _verifyParticipant(tripId, userId, db)
  const poll = await db.getDocument(DATABASE_ID, POLLS_COLLECTION_ID, pollId)
  if (poll.state !== 'OPEN')
    throw new Error('Voting is only allowed on open polls.')
  const total = tokenCounts.reduce((a, b) => a + b, 0)
  if (total > poll.proposalIds.length) {
    throw new Error(`Total tokens cannot exceed ${poll.proposalIds.length}.`)
  }
  const { documents } = await db.listDocuments(
    DATABASE_ID,
    VOTES_COLLECTION_ID,
    [
      Query.equal('pollId', pollId),
      Query.equal('userId', userId),
      Query.limit(1),
    ],
  )
  if (documents.length > 0) {
    return db.updateDocument(
      DATABASE_ID,
      VOTES_COLLECTION_ID,
      documents[0].$id,
      { proposalIds, tokenCounts },
    )
  }
  return db.createDocument(
    DATABASE_ID,
    VOTES_COLLECTION_ID,
    ID.unique(),
    { pollId, tripId, userId, proposalIds, tokenCounts },
    [Permission.read(Role.users()), Permission.write(Role.user(userId))],
  )
}

export async function listVotes (pollId, tripId, userId, db = databases) {
  await _verifyParticipant(tripId, userId, db)
  return db.listDocuments(DATABASE_ID, VOTES_COLLECTION_ID, [
    Query.equal('pollId', pollId),
    Query.limit(200),
  ])
}
