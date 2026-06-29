import type {
  Accommodation as SharedAccommodation,
  Participant as SharedParticipant,
  Preferences as SharedPreferences,
  Proposal as SharedProposal,
} from '../shared/types.d'

export type Proposal = Pick<
  SharedProposal,
  | 'id'
  | 'updated'
  | 'proposer'
  | 'proposerUserName'
  | 'trip'
  | 'state'
  | 'description'
  | 'resortName'
  | 'startDate'
  | 'endDate'
  | 'nearestAirport'
  | 'transferTime'
  | 'country'
  | 'region'
  | 'summitAltitude'
  | 'baseAltitude'
  | 'pisteKm'
  | 'beginnerPct'
  | 'intermediatePct'
  | 'advancedPct'
  | 'liftCount'
  | 'snowReliability'
  | 'skiSeasonMonths'
  | 'websites'
  | 'linkedResortsDescription'
>

export type Accommodation = Pick<
  SharedAccommodation,
  'id' | 'proposal' | 'name' | 'url' | 'cost' | 'description'
>

export type Participant = Pick<
  SharedParticipant,
  'id' | 'user' | 'userName' | 'trip' | 'role'
>

export type Preferences = Pick<
  SharedPreferences,
  | 'id'
  | 'user'
  | 'skiSnowboard'
  | 'difficulty'
  | 'piste'
  | 'timeSlopes'
  | 'timeHuts'
  | 'timeApres'
  | 'timeHotel'
  | 'accommodation'
  | 'notes'
>
