import { ID, Permission, Query, Role } from 'appwrite'
import { databases } from './appwrite'

const DATABASE_ID = process.env.PUBLIC_APPWRITE_DATABASE_ID
const TRIPS_COLLECTION_ID = process.env.PUBLIC_APPWRITE_TRIPS_COLLECTION_ID

export function listTrips (userId) {
  return databases.listDocuments(DATABASE_ID, TRIPS_COLLECTION_ID, [
    Query.equal('userId', userId),
    Query.orderDesc('$createdAt')
  ])
}

export function getTrip (tripId) {
  return databases.getDocument(DATABASE_ID, TRIPS_COLLECTION_ID, tripId)
}

function generateCode () {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

async function findUniqueCode () {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = generateCode()
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
    [Permission.read(Role.user(userId)), Permission.write(Role.user(userId))]
  )
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
