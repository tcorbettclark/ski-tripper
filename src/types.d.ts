export interface Trip {
  id: string
  created: string
  updated: string
  code: string
  description: string
}

export interface Participant {
  id: string
  created: string
  updated: string
  user: string
  userName: string
  trip: string
  role: 'coordinator' | 'participant'
}

export interface Proposal {
  id: string
  created: string
  updated: string
  proposer: string
  proposerUserName: string
  trip: string
  state: 'DRAFT' | 'SUBMITTED' | 'REJECTED'
  description: string
  resortName: string
  startDate: string
  endDate: string
  nearestAirport: string
  transferTime: number | null
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
  id: string
  created: string
  updated: string
  proposal: string
  name: string
  url: string
  cost: string
  description: string
}

export interface Poll {
  id: string
  created: string
  updated: string
  pollCreator: string
  pollCreatorUserName: string
  state: 'OPEN' | 'CLOSED'
  trip: string
  proposalIds: string[]
  startDate: string
  endDate: string
  outcome: string
}

export interface Vote {
  id: string
  created: string
  updated: string
  poll: string
  voter: string
  voterUserName: string
  proposalIds: string[]
  tokenCounts: number[]
}

export interface Discussion {
  id: string
  created: string
  updated: string
  proposal: string
  author: string
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
  transferTime: number | null
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
  id: string
  created: string
  updated: string
  user: string
  skiSnowboard: string[]
  difficulty: string[]
  piste: string[]
  timeSlopes: number
  timeEating: number
  timeApres: number
  timeHotel: number
  accommodation: string[]
  notes: string
}
