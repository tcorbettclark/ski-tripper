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
      Query.orderDesc('$createdAt')
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
  await Promise.all(
    documents.map((p) => db.deleteDocument(DATABASE_ID, PARTICIPANTS_COLLECTION_ID, p.$id))
  )
  return db.deleteDocument(DATABASE_ID, TRIPS_COLLECTION_ID, tripId)
}

export async function listParticipatedTrips (userId, db = databases) {
  const { documents } = await db.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [Query.equal('userId', userId), Query.orderDesc('$createdAt')]
  )
  if (documents.length === 0) return []
  const tripIds = documents.map((p) => p.tripId)
  const { documents: trips } = await db.listDocuments(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    [Query.equal('$id', tripIds)]
  )
  return trips
}

export async function joinTrip (userId, tripId, db = databases) {
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
