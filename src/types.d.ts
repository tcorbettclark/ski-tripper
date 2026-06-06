export interface Trip {
  $id: string
  $createdAt: string
  $updatedAt: string
  code: string
  description: string
}

export interface Participant {
  $id: string
  $createdAt: string
  $updatedAt: string
  participantUserId: string
  participantUserName: string
  tripId: string
  role: 'coordinator' | 'participant'
}

export interface Proposal {
  $id: string
  $createdAt: string
  $updatedAt: string
  proposerUserId: string
  proposerUserName: string
  tripId: string
  state: 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED'
  description: string
  resortName: string
  startDate: string
  endDate: string
  nearestAirport: string
  transferTime: number
  country: string
  region: string
  summitAltitude: number
  baseAltitude: number
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

export interface Accommodation {
  $id: string
  $createdAt: string
  $updatedAt: string
  proposalId: string
  name: string
  url: string
  cost: string
  description: string
}

export interface Poll {
  $id: string
  $createdAt: string
  $updatedAt: string
  pollCreatorUserId: string
  pollCreatorUserName: string
  state: 'OPEN' | 'CLOSED'
  tripId: string
  proposalIds: string[]
  startDate: string
  endDate: string
  outcome: string
}

export interface Vote {
  $id: string
  $createdAt: string
  $updatedAt: string
  pollId: string
  voterUserId: string
  voterUserName: string
  proposalIds: string[]
  tokenCounts: number[]
}

export interface Discussion {
  $id: string
  $createdAt: string
  $updatedAt: string
  proposalId: string
  authorUserId: string
  authorUserName: string
  body: string
  type: 'comment' | 'system'
}

export interface LocalResort {
  id: string
  resortName: string
  country: string
  region: string
  description: string
  latitude: string
  longitude: string
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
  linkedResortsDescription: string
}

export interface ResortWithEmbedding extends LocalResort {
  embedding: number[]
}

export interface Preferences {
  $id: string
  $createdAt: string
  $updatedAt: string
  userId: string
  skiSnowboard: string
  difficulty: string
  piste: string
  timeSlopes: number
  timeEating: number
  timeApres: number
  timeHotel: number
  accommodation: string
  mostImportantAspect: string
}
