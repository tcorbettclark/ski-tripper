import { ID, Permission, Query, Role } from 'appwrite'
import { databases } from './appwrite'

const DATABASE_ID = process.env.PUBLIC_APPWRITE_DATABASE_ID
const TRIPS_COLLECTION_ID = process.env.PUBLIC_APPWRITE_TRIPS_COLLECTION_ID

export function listTrips(userId) {
  return databases.listDocuments(DATABASE_ID, TRIPS_COLLECTION_ID, [
    Query.equal('userId', userId),
    Query.orderDesc('$createdAt'),
  ])
}

export function getTrip(tripId) {
  return databases.getDocument(DATABASE_ID, TRIPS_COLLECTION_ID, tripId)
}

export function createTrip(userId, data) {
  return databases.createDocument(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    ID.unique(),
    { userId, ...data },
    [
      Permission.read(Role.user(userId)),
      Permission.write(Role.user(userId)),
    ]
  )
}

export function updateTrip(tripId, data) {
  return databases.updateDocument(DATABASE_ID, TRIPS_COLLECTION_ID, tripId, data)
}

export function deleteTrip(tripId) {
  return databases.deleteDocument(DATABASE_ID, TRIPS_COLLECTION_ID, tripId)
}
