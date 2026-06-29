import type PocketBase from 'pocketbase'
import { log } from '../../log'
import type {
  Accommodation,
  Participant,
  Preferences,
  Proposal,
} from '../../types'

export async function verifyParticipantMembership(
  pb: PocketBase,
  tripId: string,
  userId: string
): Promise<void> {
  const rows = await pb.collection('participants').getFullList({
    filter: pb.filter('trip = {:tripId} && user = {:userId}', {
      tripId,
      userId,
    }),
  })
  if (rows.length === 0) {
    throw new Error('You must be a participant of this trip.')
  }
  log(`[auth] User ${userId} verified as participant of trip ${tripId}`)
}

export async function fetchProposal(
  pb: PocketBase,
  proposalId: string
): Promise<Proposal> {
  const row = await pb.collection('proposals').getOne(proposalId)
  return {
    id: row.id,
    updated: row.updated as string,
    proposer: row.proposer as string,
    proposerUserName: row.proposer_name as string,
    trip: row.trip as string,
    state: (row.state as string).toUpperCase() as Proposal['state'],
    description: row.description as string,
    resortName: row.resort_name as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    nearestAirport: row.nearest_airport as string,
    transferTime: row.transfer_time as number | null,
    country: row.country as string,
    region: row.region as string,
    summitAltitude: (row.summit_altitude as number) ?? 0,
    baseAltitude: (row.base_altitude as number) ?? 0,
    pisteKm: (row.piste_km as number) ?? 0,
    beginnerPct: (row.beginner_pct as number) ?? 0,
    intermediatePct: (row.intermediate_pct as number) ?? 0,
    advancedPct: (row.advanced_pct as number) ?? 0,
    liftCount: (row.lift_count as number) ?? 0,
    snowReliability: row.snow_reliability as Proposal['snowReliability'],
    skiSeasonMonths: row.ski_season_months as string,
    websites: row.websites as string[],
    linkedResortsDescription: row.linked_resorts_description as string,
  }
}

export async function fetchAccommodations(
  pb: PocketBase,
  proposalId: string
): Promise<Accommodation[]> {
  const rows = await pb.collection('accommodations').getFullList({
    filter: pb.filter('proposal = {:proposalId}', { proposalId }),
  })
  return rows.map((r) => ({
    id: r.id,
    proposal: r.proposal as string,
    name: r.name as string,
    url: r.url as string,
    cost: r.cost as string,
    description: r.description as string,
  }))
}

export async function fetchParticipants(
  pb: PocketBase,
  tripId: string
): Promise<Participant[]> {
  const rows = await pb.collection('participants').getFullList({
    filter: pb.filter('trip = {:tripId}', { tripId }),
  })
  return rows.map((r) => ({
    id: r.id,
    user: r.user as string,
    userName: r.name as string,
    trip: r.trip as string,
    role: r.role as Participant['role'],
  }))
}

export async function fetchPreferences(
  pb: PocketBase,
  userId: string
): Promise<Preferences | null> {
  const rows = await pb.collection('preferences').getFullList({
    filter: pb.filter('user = {:userId}', { userId }),
  })
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    id: r.id,
    user: r.user as string,
    skiSnowboard: r.ski_snowboard as string[],
    difficulty: r.difficulty as string[],
    piste: r.piste as string[],
    timeSlopes: r.time_slopes as number,
    timeHuts: r.time_huts as number,
    timeApres: r.time_apres as number,
    timeHotel: r.time_hotel as number,
    accommodation: r.accommodation as string[],
    notes: r.notes as string,
  }
}
