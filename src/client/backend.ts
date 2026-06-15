import PocketBase from 'pocketbase'
import { browser_get_pocketbase_url } from '../shared/env'
import type {
  Accommodation,
  Discussion,
  LlmCache,
  LocalResort,
  Participant,
  Poll,
  Preferences,
  Proposal,
  ResortWithEmbedding,
  Trip,
  Vote,
} from '../shared/types.d'
import { dayjs, isValidUrl, randomThreeWords } from './utils'

let _pb: PocketBase | undefined

export function getPb(): PocketBase {
  if (!_pb) {
    const url = browser_get_pocketbase_url()
    _pb = new PocketBase(url)
  }
  return _pb
}

export function setPb(pb: PocketBase): void {
  _pb = pb
}

export function hasSession(): boolean {
  return getPb().authStore.isValid
}

function mapParticipant(row: Record<string, unknown>): Participant {
  return {
    id: row.id as string,
    created: row.created as string,
    updated: row.updated as string,
    user: row.user as string,
    userName: row.user_name as string,
    trip: row.trip as string,
    role: row.role as 'coordinator' | 'participant',
  }
}

function mapTrip(row: Record<string, unknown>): Trip {
  return {
    id: row.id as string,
    created: row.created as string,
    updated: row.updated as string,
    code: row.code as string,
    description: row.description as string,
  }
}

function mapProposal(row: Record<string, unknown>): Proposal {
  return {
    id: row.id as string,
    created: row.created as string,
    updated: row.updated as string,
    proposer: row.proposer as string,
    proposerUserName: row.proposer_user_name as string,
    trip: row.trip as string,
    state: row.state as 'DRAFT' | 'SUBMITTED' | 'REJECTED',
    description: row.description as string,
    resortName: row.resort_name as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    nearestAirport: row.nearest_airport as string,
    transferTime: row.transfer_time as number | null,
    country: row.country as string,
    region: row.region as string,
    summitAltitude: row.summit_altitude as number,
    baseAltitude: row.base_altitude as number,
    pisteKm: row.piste_km as number,
    beginnerPct: row.beginner_pct as number,
    intermediatePct: row.intermediate_pct as number,
    advancedPct: row.advanced_pct as number,
    liftCount: row.lift_count as number,
    snowReliability: row.snow_reliability as 'high' | 'medium' | 'low',
    skiSeasonMonths: row.ski_season_months as string,
    websites: row.websites as string[],
    latitude: row.latitude as string,
    longitude: row.longitude as string,
    linkedResortsDescription: row.linked_resorts_description as string,
  }
}

function mapAccommodation(row: Record<string, unknown>): Accommodation {
  return {
    id: row.id as string,
    created: row.created as string,
    updated: row.updated as string,
    proposal: row.proposal as string,
    name: row.name as string,
    url: row.url as string,
    cost: row.cost as string,
    description: row.description as string,
  }
}

function mapPoll(row: Record<string, unknown>): Poll {
  return {
    id: row.id as string,
    created: row.created as string,
    updated: row.updated as string,
    pollCreator: row.poll_creator as string,
    pollCreatorUserName: row.poll_creator_user_name as string,
    state: row.state as 'OPEN' | 'CLOSED',
    trip: row.trip as string,
    proposalIds: row.proposal_ids as string[],
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    outcome: row.outcome as string,
  }
}

function mapVote(row: Record<string, unknown>): Vote {
  return {
    id: row.id as string,
    created: row.created as string,
    updated: row.updated as string,
    poll: row.poll as string,
    voter: row.voter as string,
    voterUserName: row.voter_user_name as string,
    proposalIds: row.proposal_ids as string[],
    tokenCounts: row.token_counts as number[],
  }
}

function mapDiscussion(row: Record<string, unknown>): Discussion {
  return {
    id: row.id as string,
    created: row.created as string,
    updated: row.updated as string,
    proposal: row.proposal as string,
    author: row.author as string,
    authorUserName: row.author_user_name as string,
    body: row.body as string,
    type: row.type as 'comment' | 'system',
  }
}

function mapPreferences(row: Record<string, unknown>): Preferences {
  return {
    id: row.id as string,
    created: row.created as string,
    updated: row.updated as string,
    user: row.user as string,
    skiSnowboard: row.ski_snowboard as string[],
    difficulty: row.difficulty as string[],
    piste: row.piste as string[],
    timeSlopes: row.time_slopes as number,
    timeEating: row.time_eating as number,
    timeApres: row.time_apres as number,
    timeHotel: row.time_hotel as number,
    accommodation: row.accommodation as string[],
    notes: row.notes as string,
  }
}

export async function getCoordinatorParticipant(
  tripId: string,
  client: PocketBase = getPb()
): Promise<{ participants: Participant[] }> {
  const rows = await client.collection('participants').getFullList({
    filter: client.filter('trip = {:tripId} && role = {:role}', {
      tripId,
      role: 'coordinator',
    }),
  })
  return {
    participants: rows.map((r) =>
      mapParticipant(r as unknown as Record<string, unknown>)
    ),
  }
}

export async function listTripParticipants(
  tripId: string,
  client: PocketBase = getPb()
): Promise<{ participants: Participant[] }> {
  const rows = await client.collection('participants').getFullList({
    filter: client.filter('trip = {:tripId}', { tripId }),
    sort: '-created',
  })
  return {
    participants: rows.map((r) =>
      mapParticipant(r as unknown as Record<string, unknown>)
    ),
  }
}

export async function listTrips(
  userId: string,
  client: PocketBase = getPb()
): Promise<{
  trips: Trip[]
  coordinatorUserIds: Record<string, string>
}> {
  const coordinatorParticipants = await client
    .collection('participants')
    .getFullList({
      filter: client.filter('user = {:userId} && role = {:role}', {
        userId,
        role: 'coordinator',
      }),
      sort: '-created',
    })

  const mappedParticipants = coordinatorParticipants.map((r) =>
    mapParticipant(r as unknown as Record<string, unknown>)
  )

  if (mappedParticipants.length === 0) {
    return { trips: [], coordinatorUserIds: {} }
  }

  const tripIds = mappedParticipants.map((p) => p.trip)
  const coordinatorUserIds = Object.fromEntries(
    mappedParticipants.map((p) => [p.trip, p.user])
  )

  const filterExpr = tripIds.map((id) => `id = '${id}'`).join(' || ')
  const trips = await client.collection('trips').getFullList({
    filter: `(${filterExpr})`,
  })

  const orderedTrips = tripIds
    .map((id) => trips.find((t) => t.id === id))
    .filter(Boolean)
    .map((t) => mapTrip(t as unknown as Record<string, unknown>))

  return { trips: orderedTrips, coordinatorUserIds }
}

export async function getTrip(
  tripId: string,
  client: PocketBase = getPb()
): Promise<Trip> {
  const row = await client.collection('trips').getOne(tripId)
  return mapTrip(row as unknown as Record<string, unknown>)
}

export async function getTripByCode(
  code: string,
  client: PocketBase = getPb()
): Promise<{ trips: Trip[] }> {
  const rows = await client.collection('trips').getFullList({
    filter: client.filter('code = {:code}', { code }),
  })
  return {
    trips: rows.map((r) => mapTrip(r as unknown as Record<string, unknown>)),
  }
}

async function findUniqueCode(client: PocketBase = getPb()): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = randomThreeWords()
    const rows = await client.collection('trips').getFullList({
      filter: client.filter('code = {:code}', { code }),
    })
    if (rows.length === 0) return code
  }
  throw new Error('Could not generate a unique trip code after 100 attempts.')
}

export async function createTrip(
  userId: string,
  userName: string,
  data: Partial<Trip>,
  client: PocketBase = getPb()
): Promise<Trip> {
  const code = await findUniqueCode(client)
  const tripRow = await client.collection('trips').create({
    code,
    description: data.description,
  })
  const trip = mapTrip(tripRow as unknown as Record<string, unknown>)
  await client.collection('participants').create({
    user: userId,
    user_name: userName,
    trip: trip.id,
    role: 'coordinator',
  })
  return trip
}

export async function updateTrip(
  tripId: string,
  data: Partial<Trip>,
  userId: string,
  client: PocketBase = getPb()
): Promise<Trip> {
  const { participants } = await getCoordinatorParticipant(tripId, client)
  if (participants.length === 0 || participants[0].user !== userId) {
    throw new Error('Only the coordinator can edit this trip.')
  }
  const updateData: Record<string, unknown> = {}
  if (data.description !== undefined) updateData.description = data.description
  if (data.code !== undefined) updateData.code = data.code
  const row = await client.collection('trips').update(tripId, updateData)
  return mapTrip(row as unknown as Record<string, unknown>)
}

export async function deleteTrip(
  tripId: string,
  userId: string,
  client: PocketBase = getPb()
): Promise<void> {
  const { participants: coordinatorDocs } = await getCoordinatorParticipant(
    tripId,
    client
  )
  if (coordinatorDocs.length === 0 || coordinatorDocs[0].user !== userId) {
    throw new Error('Only the coordinator can delete this trip.')
  }
  await client.collection('trips').delete(tripId)
}

export async function listParticipatedTrips(
  userId: string,
  client: PocketBase = getPb()
): Promise<{ trips: Trip[] }> {
  const participants = await client.collection('participants').getFullList({
    filter: client.filter('user = {:userId}', { userId }),
    sort: '-created',
  })
  const mappedParticipants = participants.map((r) =>
    mapParticipant(r as unknown as Record<string, unknown>)
  )
  if (mappedParticipants.length === 0) return { trips: [] }
  const tripIds = mappedParticipants.map((p) => p.trip)
  const filterExpr = tripIds.map((id) => `id = '${id}'`).join(' || ')
  const trips = await client.collection('trips').getFullList({
    filter: `(${filterExpr})`,
  })
  return {
    trips: trips.map((r) => mapTrip(r as unknown as Record<string, unknown>)),
  }
}

export async function joinTrip(
  userId: string,
  userName: string,
  tripId: string,
  client: PocketBase = getPb()
): Promise<Participant> {
  try {
    await client.collection('trips').getOne(tripId)
  } catch {
    throw new Error('Trip not found.')
  }
  const existing = await client.collection('participants').getFullList({
    filter: client.filter('user = {:userId} && trip = {:tripId}', {
      userId,
      tripId,
    }),
  })
  if (existing.length > 0) throw new Error('You have already joined this trip.')
  const row = await client.collection('participants').create({
    user: userId,
    user_name: userName,
    trip: tripId,
    role: 'participant',
  })
  return mapParticipant(row as unknown as Record<string, unknown>)
}

export async function leaveTrip(
  userId: string,
  tripId: string,
  client: PocketBase = getPb()
): Promise<void> {
  const rows = await client.collection('participants').getFullList({
    filter: client.filter('user = {:userId} && trip = {:tripId}', {
      userId,
      tripId,
    }),
  })
  if (rows.length === 0) throw new Error('Participation record not found.')
  const participant = mapParticipant(
    rows[0] as unknown as Record<string, unknown>
  )
  if (participant.role === 'coordinator')
    throw new Error('The coordinator cannot leave the trip.')
  await client.collection('participants').delete(participant.id)
}

async function _verifyParticipant(
  tripId: string,
  userId: string,
  client: PocketBase
): Promise<void> {
  const rows = await client.collection('participants').getFullList({
    filter: client.filter('trip = {:tripId} && user = {:userId}', {
      tripId,
      userId,
    }),
  })
  if (rows.length === 0)
    throw new Error('You must be a participant to access this trip.')
}

async function _verifyParticipantByPoll(
  pollId: string,
  userId: string,
  client: PocketBase
): Promise<void> {
  const pollRow = await client.collection('polls').getOne(pollId)
  const poll = mapPoll(pollRow as unknown as Record<string, unknown>)
  await _verifyParticipant(poll.trip, userId, client)
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
      transferTime: number | null
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
  client: PocketBase = getPb()
): Promise<Proposal> {
  await _verifyParticipant(tripId, proposerUserId, client)
  const { resortData, ...userData } = data
  const row = await client.collection('proposals').create({
    trip: tripId,
    proposer: proposerUserId,
    proposer_user_name: proposerUserName,
    state: 'DRAFT',
    description: userData.description,
    start_date: userData.startDate,
    end_date: userData.endDate,
    resort_name: resortData.resortName,
    country: resortData.country,
    region: resortData.region,
    summit_altitude: resortData.summitAltitude,
    base_altitude: resortData.baseAltitude,
    nearest_airport: resortData.nearestAirport,
    transfer_time: resortData.transferTime,
    piste_km: resortData.pisteKm,
    beginner_pct: resortData.beginnerPct,
    intermediate_pct: resortData.intermediatePct,
    advanced_pct: resortData.advancedPct,
    lift_count: resortData.liftCount,
    snow_reliability: resortData.snowReliability,
    ski_season_months: resortData.skiSeasonMonths,
    websites: resortData.websites,
    latitude: resortData.latitude,
    longitude: resortData.longitude,
    linked_resorts_description: resortData.linkedResortsDescription,
  })
  return mapProposal(row as unknown as Record<string, unknown>)
}

export async function listProposals(
  tripId: string,
  userId: string,
  client: PocketBase = getPb()
): Promise<{ proposals: Proposal[] }> {
  await _verifyParticipant(tripId, userId, client)
  const rows = await client.collection('proposals').getFullList({
    filter: client.filter('trip = {:tripId}', { tripId }),
    sort: '-created',
  })
  return {
    proposals: rows.map((r) =>
      mapProposal(r as unknown as Record<string, unknown>)
    ),
  }
}

export async function getProposal(
  proposalId: string,
  userId: string,
  client: PocketBase = getPb()
): Promise<Proposal> {
  const row = await client.collection('proposals').getOne(proposalId)
  const proposal = mapProposal(row as unknown as Record<string, unknown>)
  await _verifyParticipant(proposal.trip, userId, client)
  return proposal
}

export async function updateProposal(
  proposalId: string,
  proposerUserId: string,
  data: Partial<Proposal>,
  client: PocketBase = getPb()
): Promise<Proposal> {
  const row = await client.collection('proposals').getOne(proposalId)
  const proposal = mapProposal(row as unknown as Record<string, unknown>)
  if (proposal.proposer !== proposerUserId)
    throw new Error('Only the creator can edit this proposal.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Only draft proposals can be edited.')

  const updateData: Record<string, unknown> = {}
  if (data.description !== undefined) updateData.description = data.description
  if (data.startDate !== undefined) updateData.start_date = data.startDate
  if (data.endDate !== undefined) updateData.end_date = data.endDate
  if (data.resortName !== undefined) updateData.resort_name = data.resortName
  if (data.country !== undefined) updateData.country = data.country
  if (data.region !== undefined) updateData.region = data.region
  if (data.summitAltitude !== undefined)
    updateData.summit_altitude = data.summitAltitude
  if (data.baseAltitude !== undefined)
    updateData.base_altitude = data.baseAltitude
  if (data.nearestAirport !== undefined)
    updateData.nearest_airport = data.nearestAirport
  if (data.transferTime !== undefined)
    updateData.transfer_time = data.transferTime
  if (data.pisteKm !== undefined) updateData.piste_km = data.pisteKm
  if (data.beginnerPct !== undefined) updateData.beginner_pct = data.beginnerPct
  if (data.intermediatePct !== undefined)
    updateData.intermediate_pct = data.intermediatePct
  if (data.advancedPct !== undefined) updateData.advanced_pct = data.advancedPct
  if (data.liftCount !== undefined) updateData.lift_count = data.liftCount
  if (data.snowReliability !== undefined)
    updateData.snow_reliability = data.snowReliability
  if (data.skiSeasonMonths !== undefined)
    updateData.ski_season_months = data.skiSeasonMonths
  if (data.websites !== undefined) updateData.websites = data.websites
  if (data.latitude !== undefined) updateData.latitude = data.latitude
  if (data.longitude !== undefined) updateData.longitude = data.longitude
  if (data.linkedResortsDescription !== undefined)
    updateData.linked_resorts_description = data.linkedResortsDescription

  const updated = await client
    .collection('proposals')
    .update(proposalId, updateData)
  return mapProposal(updated as unknown as Record<string, unknown>)
}

export async function deleteProposal(
  proposalId: string,
  proposerUserId: string,
  client: PocketBase = getPb()
): Promise<void> {
  const row = await client.collection('proposals').getOne(proposalId)
  const proposal = mapProposal(row as unknown as Record<string, unknown>)
  if (proposal.proposer !== proposerUserId)
    throw new Error('Only the creator can delete this proposal.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Only draft proposals can be deleted.')
  await client.collection('proposals').delete(proposalId)
}

export async function submitProposal(
  proposalId: string,
  proposerUserId: string,
  client: PocketBase = getPb()
): Promise<Proposal> {
  const row = await client.collection('proposals').getOne(proposalId)
  const proposal = mapProposal(row as unknown as Record<string, unknown>)
  if (proposal.proposer !== proposerUserId)
    throw new Error('Only the creator can submit this proposal.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Only draft proposals can be submitted.')
  const accommodations = await client.collection('accommodations').getFullList({
    filter: client.filter('proposal = {:proposalId}', { proposalId }),
  })
  if (accommodations.length === 0)
    throw new Error(
      'At least one accommodation is required to submit a proposal.'
    )
  const updated = await client
    .collection('proposals')
    .update(proposalId, { state: 'SUBMITTED' })
  await createSystemMessage(
    proposalId,
    `${proposal.proposerUserName} submitted this proposal`,
    client
  )
  return mapProposal(updated as unknown as Record<string, unknown>)
}

export async function rejectProposal(
  proposalId: string,
  pollCreatorUserId: string,
  client: PocketBase = getPb()
): Promise<Proposal> {
  const row = await client.collection('proposals').getOne(proposalId)
  const proposal = mapProposal(row as unknown as Record<string, unknown>)
  if (proposal.state !== 'SUBMITTED') {
    throw new Error('Only submitted proposals can be rejected.')
  }
  const { participants } = await getCoordinatorParticipant(
    proposal.trip,
    client
  )
  if (participants.length === 0 || participants[0].user !== pollCreatorUserId) {
    throw new Error('Only the coordinator can reject this proposal.')
  }
  const updated = await client
    .collection('proposals')
    .update(proposalId, { state: 'REJECTED' })
  await createSystemMessage(
    proposalId,
    `${participants[0].userName} rejected this proposal`,
    client
  )
  return mapProposal(updated as unknown as Record<string, unknown>)
}

export async function revertProposalToDraft(
  proposalId: string,
  pollCreatorUserId: string,
  client: PocketBase = getPb()
): Promise<Proposal> {
  const row = await client.collection('proposals').getOne(proposalId)
  const proposal = mapProposal(row as unknown as Record<string, unknown>)
  if (proposal.state !== 'REJECTED') {
    throw new Error('Only rejected proposals can be moved back to draft.')
  }
  const { participants } = await getCoordinatorParticipant(
    proposal.trip,
    client
  )
  if (participants.length === 0 || participants[0].user !== pollCreatorUserId) {
    throw new Error(
      'Only the coordinator can move this proposal back to draft.'
    )
  }
  const updated = await client
    .collection('proposals')
    .update(proposalId, { state: 'DRAFT' })
  await createSystemMessage(
    proposalId,
    `${participants[0].userName} moved this proposal back to draft`,
    client
  )
  return mapProposal(updated as unknown as Record<string, unknown>)
}

export async function createPoll(
  tripId: string,
  pollCreatorUserId: string,
  pollCreatorUserName: string,
  durationDays: number,
  client: PocketBase = getPb()
): Promise<Poll> {
  const { participants: coordDocs } = await getCoordinatorParticipant(
    tripId,
    client
  )
  if (coordDocs.length === 0 || coordDocs[0].user !== pollCreatorUserId) {
    throw new Error('Only the coordinator can create a poll.')
  }
  const openPolls = await client.collection('polls').getFullList({
    filter: client.filter('trip = {:tripId} && state = {:state}', {
      tripId,
      state: 'OPEN',
    }),
  })
  if (openPolls.length > 0) {
    throw new Error('A poll is already open for this trip.')
  }
  const proposals = await client.collection('proposals').getFullList({
    filter: client.filter('trip = {:tripId} && state = {:state}', {
      tripId,
      state: 'SUBMITTED',
    }),
  })
  if (proposals.length === 0) {
    throw new Error('No submitted proposals to poll on.')
  }
  const proposalIds = proposals.map((p) => p.id)
  const startDate = dayjs().toISOString()
  const endDate = dayjs().add(durationDays, 'day').toISOString()
  const pollRow = await client.collection('polls').create({
    trip: tripId,
    poll_creator: pollCreatorUserId,
    poll_creator_user_name: pollCreatorUserName,
    state: 'OPEN',
    proposal_ids: proposalIds,
    start_date: startDate,
    end_date: endDate,
    outcome: '',
  })
  return mapPoll(pollRow as unknown as Record<string, unknown>)
}

export async function closePoll(
  pollId: string,
  pollCreatorUserId: string,
  outcome: string,
  client: PocketBase = getPb()
): Promise<Poll> {
  if (!outcome.trim()) throw new Error('Outcome is required to close a poll.')
  const pollRow = await client.collection('polls').getOne(pollId)
  const poll = mapPoll(pollRow as unknown as Record<string, unknown>)
  if (poll.state !== 'OPEN') throw new Error('Only open polls can be closed.')
  const { participants } = await getCoordinatorParticipant(poll.trip, client)
  if (participants.length === 0 || participants[0].user !== pollCreatorUserId) {
    throw new Error('Only the coordinator can close a poll.')
  }
  const updated = await client
    .collection('polls')
    .update(pollId, { state: 'CLOSED', outcome })
  return mapPoll(updated as unknown as Record<string, unknown>)
}

export async function listPolls(
  tripId: string,
  userId: string,
  client: PocketBase = getPb()
): Promise<{ polls: Poll[] }> {
  await _verifyParticipant(tripId, userId, client)
  const rows = await client.collection('polls').getFullList({
    filter: client.filter('trip = {:tripId}', { tripId }),
    sort: '-created',
  })
  return {
    polls: rows.map((r) => mapPoll(r as unknown as Record<string, unknown>)),
  }
}

export async function upsertVote(
  pollId: string,
  voterUserId: string,
  proposalIds: string[],
  tokenCounts: number[],
  client: PocketBase = getPb()
): Promise<Vote> {
  const pollRow = await client.collection('polls').getOne(pollId)
  const poll = mapPoll(pollRow as unknown as Record<string, unknown>)
  await _verifyParticipant(poll.trip, voterUserId, client)
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
  const existingVotes = await client.collection('votes').getFullList({
    filter: client.filter('poll = {:pollId} && voter = {:voterUserId}', {
      pollId,
      voterUserId,
    }),
  })
  if (existingVotes.length > 0) {
    const updated = await client
      .collection('votes')
      .update(existingVotes[0].id, {
        proposal_ids: proposalIds,
        token_counts: tokenCounts,
      })
    return mapVote(updated as unknown as Record<string, unknown>)
  }
  const row = await client.collection('votes').create({
    poll: pollId,
    voter: voterUserId,
    proposal_ids: proposalIds,
    token_counts: tokenCounts,
  })
  return mapVote(row as unknown as Record<string, unknown>)
}

export async function listVotes(
  pollId: string,
  userId: string,
  client: PocketBase = getPb()
): Promise<{ votes: Vote[] }> {
  await _verifyParticipantByPoll(pollId, userId, client)
  const rows = await client.collection('votes').getFullList({
    filter: client.filter('poll = {:pollId}', { pollId }),
  })
  return {
    votes: rows.map((r) => mapVote(r as unknown as Record<string, unknown>)),
  }
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
  client: PocketBase = getPb()
): Promise<Accommodation> {
  const proposalRow = await client.collection('proposals').getOne(proposalId)
  const proposal = mapProposal(
    proposalRow as unknown as Record<string, unknown>
  )
  if (proposal.proposer !== proposerUserId)
    throw new Error('Only the creator can add accommodations.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Accommodations can only be added to draft proposals.')
  const row = await client.collection('accommodations').create({
    proposal: proposalId,
    name: data.name,
    url: validateUrl(data.url),
    cost: data.cost,
    description: data.description,
  })
  return mapAccommodation(row as unknown as Record<string, unknown>)
}

export async function listAccommodations(
  proposalId: string,
  client: PocketBase = getPb()
): Promise<Accommodation[]> {
  const rows = await client.collection('accommodations').getFullList({
    filter: client.filter('proposal = {:proposalId}', { proposalId }),
    sort: '-created',
  })
  return rows.map((r) =>
    mapAccommodation(r as unknown as Record<string, unknown>)
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
  client: PocketBase = getPb()
): Promise<Accommodation> {
  const accommodationRow = await client
    .collection('accommodations')
    .getOne(accommodationId)
  const accommodation = mapAccommodation(
    accommodationRow as unknown as Record<string, unknown>
  )
  const proposalRow = await client
    .collection('proposals')
    .getOne(accommodation.proposal)
  const proposal = mapProposal(
    proposalRow as unknown as Record<string, unknown>
  )
  if (proposal.proposer !== proposerUserId)
    throw new Error('Only the creator can edit accommodations.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Accommodations can only be edited on draft proposals.')
  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.url !== undefined) updateData.url = validateUrl(data.url)
  if (data.cost !== undefined) updateData.cost = data.cost
  if (data.description !== undefined) updateData.description = data.description
  const updated = await client
    .collection('accommodations')
    .update(accommodationId, updateData)
  return mapAccommodation(updated as unknown as Record<string, unknown>)
}

export async function deleteAccommodation(
  accommodationId: string,
  proposerUserId: string,
  client: PocketBase = getPb()
): Promise<void> {
  const accommodationRow = await client
    .collection('accommodations')
    .getOne(accommodationId)
  const accommodation = mapAccommodation(
    accommodationRow as unknown as Record<string, unknown>
  )
  const proposalRow = await client
    .collection('proposals')
    .getOne(accommodation.proposal)
  const proposal = mapProposal(
    proposalRow as unknown as Record<string, unknown>
  )
  if (proposal.proposer !== proposerUserId)
    throw new Error('Only the creator can delete accommodations.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Accommodations can only be deleted from draft proposals.')
  await client.collection('accommodations').delete(accommodationId)
}

export async function getPreferences(
  userId: string,
  client: PocketBase = getPb()
): Promise<Preferences | null> {
  const rows = await client.collection('preferences').getFullList({
    filter: client.filter('user = {:userId}', { userId }),
  })
  if (rows.length === 0) return null
  return mapPreferences(rows[0] as unknown as Record<string, unknown>)
}

export async function updateName(
  name: string,
  client: PocketBase = getPb()
): Promise<Record<string, unknown>> {
  const userId = (client.authStore.record as Record<string, unknown>)
    ?.id as string
  return client
    .collection('users')
    .update(userId, { name }) as unknown as Record<string, unknown>
}

export async function createPreferences(
  userId: string,
  data: Omit<Preferences, 'id' | 'created' | 'updated' | 'user'>,
  client: PocketBase = getPb()
): Promise<Preferences> {
  const row = await client.collection('preferences').create({
    user: userId,
    ski_snowboard: data.skiSnowboard,
    difficulty: data.difficulty,
    piste: data.piste,
    time_slopes: data.timeSlopes,
    time_eating: data.timeEating,
    time_apres: data.timeApres,
    time_hotel: data.timeHotel,
    accommodation: data.accommodation,
    notes: data.notes,
  })
  return mapPreferences(row as unknown as Record<string, unknown>)
}

export async function updatePreferences(
  userId: string,
  data: Partial<Omit<Preferences, 'id' | 'created' | 'updated' | 'user'>>,
  client: PocketBase = getPb()
): Promise<Preferences> {
  const existing = await getPreferences(userId, client)
  if (!existing) throw new Error('Preferences not found.')
  const updateData: Record<string, unknown> = {}
  if (data.skiSnowboard !== undefined)
    updateData.ski_snowboard = data.skiSnowboard
  if (data.difficulty !== undefined) updateData.difficulty = data.difficulty
  if (data.piste !== undefined) updateData.piste = data.piste
  if (data.timeSlopes !== undefined) updateData.time_slopes = data.timeSlopes
  if (data.timeEating !== undefined) updateData.time_eating = data.timeEating
  if (data.timeApres !== undefined) updateData.time_apres = data.timeApres
  if (data.timeHotel !== undefined) updateData.time_hotel = data.timeHotel
  if (data.accommodation !== undefined)
    updateData.accommodation = data.accommodation
  if (data.notes !== undefined) updateData.notes = data.notes
  const updated = await client
    .collection('preferences')
    .update(existing.id, updateData)
  return mapPreferences(updated as unknown as Record<string, unknown>)
}

export async function listDiscussion(
  proposalId: string,
  client: PocketBase = getPb()
): Promise<Discussion[]> {
  const rows = await client.collection('discussion').getFullList({
    filter: client.filter('proposal = {:proposalId}', { proposalId }),
    sort: 'created',
  })
  return rows.map((r) => mapDiscussion(r as unknown as Record<string, unknown>))
}

export async function createDiscussionComment(
  proposalId: string,
  authorUserId: string,
  authorUserName: string,
  body: string,
  client: PocketBase = getPb()
): Promise<Discussion> {
  const row = await client.collection('discussion').create({
    proposal: proposalId,
    author: authorUserId,
    author_user_name: authorUserName,
    body,
    type: 'comment',
  })
  return mapDiscussion(row as unknown as Record<string, unknown>)
}

export async function updateDiscussionComment(
  commentId: string,
  authorUserId: string,
  body: string,
  client: PocketBase = getPb()
): Promise<Discussion> {
  const row = await client.collection('discussion').getOne(commentId)
  const comment = mapDiscussion(row as unknown as Record<string, unknown>)
  if (comment.author !== authorUserId)
    throw new Error('Only the author can edit this comment.')
  if (comment.type !== 'comment')
    throw new Error('System messages cannot be edited.')
  const updated = await client
    .collection('discussion')
    .update(commentId, { body })
  return mapDiscussion(updated as unknown as Record<string, unknown>)
}

export async function deleteDiscussionComment(
  commentId: string,
  authorUserId: string,
  client: PocketBase = getPb()
): Promise<void> {
  const row = await client.collection('discussion').getOne(commentId)
  const comment = mapDiscussion(row as unknown as Record<string, unknown>)
  if (comment.author !== authorUserId)
    throw new Error('Only the author can delete this comment.')
  if (comment.type !== 'comment')
    throw new Error('System messages cannot be deleted.')
  await client.collection('discussion').delete(commentId)
}

export async function createSystemMessage(
  proposalId: string,
  body: string,
  client: PocketBase = getPb()
): Promise<Discussion> {
  const row = await client.collection('discussion').create({
    proposal: proposalId,
    author: '',
    author_user_name: 'System',
    body,
    type: 'system',
  })
  return mapDiscussion(row as unknown as Record<string, unknown>)
}

export async function getResortData(): Promise<LocalResort[]> {
  const rows = await getPb().collection('resorts').getFullList()
  return rows.map((r) => ({
    id: r.id as string,
    resortName: r.resort_name as string,
    country: r.country as string,
    region: r.region as string,
    description: r.description as string,
    latitude: r.latitude as string,
    longitude: r.longitude as string,
    summitAltitude: r.summit_altitude as number,
    baseAltitude: r.base_altitude as number,
    nearestAirport: r.nearest_airport as string,
    transferTime: r.transfer_time as number | null,
    pisteKm: r.piste_km as number,
    beginnerPct: r.beginner_pct as number,
    intermediatePct: r.intermediate_pct as number,
    advancedPct: r.advanced_pct as number,
    liftCount: r.lift_count as number,
    snowReliability: r.snow_reliability as 'high' | 'medium' | 'low',
    skiSeasonMonths: r.ski_season_months as string,
    websites: r.websites as string[],
    linkedResortsDescription: r.linked_resorts_description as string,
  }))
}

export async function fetchResortDataWithAuth(): Promise<string> {
  const rows = await getPb().collection('resorts').getFullList()
  const resorts: ResortWithEmbedding[] = rows.map((r) => ({
    id: r.id as string,
    resortName: r.resort_name as string,
    country: r.country as string,
    region: r.region as string,
    description: r.description as string,
    latitude: r.latitude as string,
    longitude: r.longitude as string,
    summitAltitude: r.summit_altitude as number,
    baseAltitude: r.base_altitude as number,
    nearestAirport: r.nearest_airport as string,
    transferTime: r.transfer_time as number | null,
    pisteKm: r.piste_km as number,
    beginnerPct: r.beginner_pct as number,
    intermediatePct: r.intermediate_pct as number,
    advancedPct: r.advanced_pct as number,
    liftCount: r.lift_count as number,
    snowReliability: r.snow_reliability as 'high' | 'medium' | 'low',
    skiSeasonMonths: r.ski_season_months as string,
    websites: r.websites as string[],
    linkedResortsDescription: r.linked_resorts_description as string,
    embedding: (r.embedding as number[] | undefined) || [],
  }))
  return resorts.map((r) => JSON.stringify(r)).join('\n')
}

function mapLlmCache(row: Record<string, unknown>): LlmCache {
  return {
    id: row.id as string,
    created: row.created as string,
    updated: row.updated as string,
    inputHash: row.input_hash as string,
    type: row.type as 'analysis' | 'preference-search',
    proposalId: (row.proposal as string) || null,
    tripId: row.trip as string,
    status: row.status as 'generating' | 'complete' | 'error',
    thinking: (row.thinking as string) || null,
    content: (row.content as string) || null,
    model: row.model as string,
  }
}

export async function listLlmCacheByTripAndType(
  tripId: string,
  type: LlmCache['type'],
  client: PocketBase = getPb()
): Promise<LlmCache[]> {
  const rows = await client.collection('llm_cache').getFullList({
    filter: client.filter('trip = {:tripId} && type = {:type}', {
      tripId,
      type,
    }),
  })
  return rows.map((r) => mapLlmCache(r as unknown as Record<string, unknown>))
}

export async function triggerAnalysis(
  proposalId: string,
  tripId: string
): Promise<void> {
  const baseUrl = new URL(getPb().baseUrl)
  const apiUrl = `${baseUrl.protocol}//${baseUrl.host}/api/analyse-proposal`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getPb().authStore.token}`,
    },
    body: JSON.stringify({ proposalId, tripId }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to trigger analysis: ${response.status} ${text}`)
  }
}

export async function triggerPreferenceSearch(tripId: string): Promise<void> {
  const baseUrl = new URL(getPb().baseUrl)
  const apiUrl = `${baseUrl.protocol}//${baseUrl.host}/api/preference-search`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getPb().authStore.token}`,
    },
    body: JSON.stringify({ tripId }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Failed to trigger preference search: ${response.status} ${text}`
    )
  }
}
