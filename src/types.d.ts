declare module '*.css' {
  const content: Record<string, string>
  export default content
}

export interface Trip {
  $id: string
  code: string
  description: string
  location: string
  startDate: string
  endDate: string
  $createdAt: string
  $updatedAt: string
}

export interface Participant {
  $id: string
  participantUserId: string
  participantUserName: string
  tripId: string
  role: 'coordinator' | 'participant'
  $createdAt: string
}

export interface Proposal {
  $id: string
  tripId: string
  proposerUserId: string
  proposerUserName: string
  state: 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED'
  title: string
  description: string
  $createdAt: string
}

export interface Poll {
  $id: string
  tripId: string
  pollCreatorUserId: string
  pollCreatorUserName: string
  state: 'OPEN' | 'CLOSED'
  proposalIds: string[]
  $createdAt: string
}

export interface Vote {
  $id: string
  pollId: string
  tripId: string
  voterUserId: string
  proposalIds: string[]
  tokenCounts: number[]
  $createdAt: string
}
