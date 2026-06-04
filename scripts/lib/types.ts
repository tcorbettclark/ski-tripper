export interface SeededResort {
  id: string
  resortName: string
  country: string
  region: string
  latitude: string
  longitude: string
  summitAltitude: number
  baseAltitude: number
  pisteKm: number
  liftCount: number
  websites: string[]
  beginnerPct: number
  intermediatePct: number
  advancedPct: number
}

export interface EnrichedResort {
  id: string
  description: string
  latitude: string
  longitude: string
  summitAltitude: number
  baseAltitude: number
  nearestAirport: string
  transferTime: string
  pisteKm: number
  beginnerPct: number
  intermediatePct: number
  advancedPct: number
  liftCount: number
  snowReliability: string
  skiSeasonMonths: string
  websites: string[]
  linkedResortsDescription: string
}

export interface EncodedResort {
  id: string
  embedding: number[]
  searchText: string
}
