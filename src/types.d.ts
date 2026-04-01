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
  ParticipantUserId: string
  ParticipantUserName: string
  tripId: string
  role: 'coordinator' | 'participant'
  $createdAt: string
}

export interface Proposal {
  $id: string
  tripId: string
  ProposerUserId: string
  ProposerUserName: string
  state: 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED'
  title: string
  description: string
  $createdAt: string
}

export interface Poll {
  $id: string
  tripId: string
  PollCreatorUserId: string
  PollCreatorUserName: string
  state: 'OPEN' | 'CLOSED'
  proposalIds: string[]
  $createdAt: string
}

export interface Vote {
  $id: string
  pollId: string
  tripId: string
  VoterUserId: string
  proposalIds: string[]
  tokenCounts: number[]
  $createdAt: string
}
