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
  terrainDescription: string
  offPisteDescription: string
  valueDescription: string
  familyDescription: string
  apresSkiDescription: string
  resortCharacterDescription: string
  liftSystemDescription: string
  nearestAirport: string
  transferTime: number | null
  snowReliability: string
  skiSeasonMonths: string
  websites: string[]
  linkedResortsDescription: string
  summitAltitude?: number | null
  baseAltitude?: number | null
  pisteKm?: number | null
  liftCount?: number | null
  beginnerPct?: number | null
  intermediatePct?: number | null
  advancedPct?: number | null
}

export interface EncodedResort {
  id: string
  embedding: number[]
  searchText: string
}
