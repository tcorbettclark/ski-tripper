import { ID, Permission, Query, Role } from 'appwrite'
import { databases } from './appwrite'
import adjectives from 'threewords/data/adjectives.json'
import nouns from 'threewords/data/nouns.json'

function randomThreeWords () {
  const ints = new Uint32Array(3)
  crypto.getRandomValues(ints)
  const one = adjectives[ints[0] % adjectives.length]
  const two = adjectives[ints[1] % adjectives.length]
  const three = nouns[ints[2] % nouns.length]
  return `${one}-${two}-${three}`
}

const DATABASE_ID = process.env.PUBLIC_APPWRITE_DATABASE_ID
const TRIPS_COLLECTION_ID = process.env.PUBLIC_APPWRITE_TRIPS_COLLECTION_ID
const PARTICIPANTS_COLLECTION_ID = process.env.PUBLIC_APPWRITE_PARTICIPANTS_COLLECTION_ID

export function listTrips (userId) {
  return databases.listDocuments(DATABASE_ID, TRIPS_COLLECTION_ID, [
    Query.equal('userId', userId),
    Query.orderDesc('$createdAt')
  ])
}

export function getTrip (tripId) {
  return databases.getDocument(DATABASE_ID, TRIPS_COLLECTION_ID, tripId)
}

export function getTripByCode (code) {
  return databases.listDocuments(DATABASE_ID, TRIPS_COLLECTION_ID, [
    Query.equal('code', code),
    Query.limit(1)
  ])
}

async function findUniqueCode () {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = randomThreeWords()
    const existing = await databases.listDocuments(DATABASE_ID, TRIPS_COLLECTION_ID, [
      Query.equal('code', code),
      Query.limit(1)
    ])
    if (existing.documents.length === 0) return code
  }
  throw new Error('Could not generate a unique trip code after 100 attempts.')
}

export async function createTrip (userId, data) {
  const code = await findUniqueCode()
  return databases.createDocument(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    ID.unique(),
    { userId, code, ...data },
    [Permission.read(Role.users()), Permission.write(Role.user(userId))]
  )
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

export function updateTrip (tripId, data) {
  return databases.updateDocument(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    tripId,
    data
  )
}

export function deleteTrip (tripId) {
  return databases.deleteDocument(DATABASE_ID, TRIPS_COLLECTION_ID, tripId)
}

export async function listParticipatedTrips (userId) {
  const { documents } = await databases.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [Query.equal('userId', userId), Query.orderDesc('$createdAt')]
  )
  if (documents.length === 0) return []
  const tripIds = documents.map((p) => p.tripId)
  const { documents: trips } = await databases.listDocuments(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    [Query.equal('$id', tripIds)]
  )
  return trips
}

export async function joinTrip (userId, tripId) {
  const { documents } = await databases.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [Query.equal('userId', userId), Query.equal('tripId', tripId), Query.limit(1)]
  )
  if (documents.length > 0) throw new Error('You have already joined this trip.')
  return databases.createDocument(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    ID.unique(),
    { userId, tripId },
    [Permission.read(Role.user(userId)), Permission.write(Role.user(userId))]
  )
}

export async function leaveTrip (userId, tripId) {
  const { documents } = await databases.listDocuments(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    [Query.equal('userId', userId), Query.equal('tripId', tripId), Query.limit(1)]
  )
  if (documents.length === 0) throw new Error('Participation record not found.')
  return databases.deleteDocument(DATABASE_ID, PARTICIPANTS_COLLECTION_ID, documents[0].$id)
}
