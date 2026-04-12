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
  title: string
  description: string
  resortName: string
  startDate: string
  endDate: string
  nearestAirport: string
  transferTime: string
  altitudeRange: string
  country: string
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
}

export interface Vote {
  $id: string
  $createdAt: string
  $updatedAt: string
  pollId: string
  tripId: string
  voterUserId: string
  voterUserName: string
  proposalIds: string[]
  tokenCounts: number[]
}
