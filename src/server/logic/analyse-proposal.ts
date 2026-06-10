import { hash } from 'canonical-json/hash'

interface Proposal {
  id: string
  updated: string
  proposer: string
  proposerUserName: string
  trip: string
  state: string
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
  snowReliability: string
  skiSeasonMonths: string
  websites: string[]
  linkedResortsDescription: string
}

interface Accommodation {
  id: string
  proposal: string
  name: string
  url: string
  cost: string
  description: string
}

interface Participant {
  id: string
  user: string
  userName: string
  trip: string
  role: string
}

interface Preferences {
  id: string
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

export type { Accommodation, Participant, Preferences, Proposal }

export function computeInputHash(
  proposal: Proposal,
  accommodations: Accommodation[],
  participantPrefs: Array<{
    participant: Participant
    preferences: Preferences
  }>
): string {
  const data = {
    proposal: {
      id: proposal.id,
      updatedAt: proposal.updated,
      resortName: proposal.resortName,
      country: proposal.country,
      region: proposal.region,
      startDate: proposal.startDate,
      endDate: proposal.endDate,
      description: proposal.description,
      nearestAirport: proposal.nearestAirport,
      transferTime: proposal.transferTime,
      summitAltitude: proposal.summitAltitude,
      baseAltitude: proposal.baseAltitude,
      pisteKm: proposal.pisteKm,
      beginnerPct: proposal.beginnerPct,
      intermediatePct: proposal.intermediatePct,
      advancedPct: proposal.advancedPct,
      liftCount: proposal.liftCount,
      snowReliability: proposal.snowReliability,
      skiSeasonMonths: proposal.skiSeasonMonths,
      linkedResortsDescription: proposal.linkedResortsDescription,
    },
    accommodations: accommodations.map((a) => ({
      id: a.id,
      name: a.name,
      cost: a.cost,
      description: a.description,
    })),
    participants: participantPrefs.map((p) => ({
      userId: p.participant.user,
      userName: p.participant.userName,
      preferences: {
        skiSnowboard: p.preferences.skiSnowboard,
        difficulty: p.preferences.difficulty,
        piste: p.preferences.piste,
        timeSlopes: p.preferences.timeSlopes,
        timeEating: p.preferences.timeEating,
        timeApres: p.preferences.timeApres,
        timeHotel: p.preferences.timeHotel,
        accommodation: p.preferences.accommodation,
        notes: p.preferences.notes,
      },
    })),
  }
  return hash(data)
}

export function buildSystemPrompt(): string {
  return `You are a ski trip analyst. Given a ski trip proposal and the preferences of each participant, produce a structured markdown analysis.

Rules:
- Use real participant names (not anonymized labels)
- Exclude participants without preferences — do not mention them at all
- Include accommodation fit — evaluate whether accommodation types match participant preferences
- Check seasonal fit — mention if proposed dates fall outside the resort's reliable ski season (skiSeasonMonths)
- Be specific and concrete, not generic
- Format your response exactly as shown below, with no additional text before or after

### Summary
1-2 sentence overall assessment.

### Who'd love this
- **Name**: reason

### Who might struggle
- **Name**: reason`
}

export function buildUserPrompt(
  proposal: Proposal,
  accommodations: Accommodation[],
  participantPrefs: Array<{
    participant: Participant
    preferences: Preferences
  }>
): string {
  const lines: string[] = []

  lines.push(`## Proposal by ${proposal.proposerUserName}`)
  lines.push(`Resort: ${proposal.resortName}`)
  lines.push(`Country: ${proposal.country}, Region: ${proposal.region}`)
  lines.push(`Dates: ${proposal.startDate} to ${proposal.endDate}`)
  lines.push(`Description: ${proposal.description}`)
  lines.push(`Nearest airport: ${proposal.nearestAirport}`)
  if (proposal.transferTime !== null) {
    lines.push(`Transfer time: ${proposal.transferTime} minutes`)
  }
  lines.push(
    `Altitude: ${proposal.baseAltitude}m – ${proposal.summitAltitude}m`
  )
  lines.push(
    `Piste: ${proposal.pisteKm} km (${proposal.beginnerPct}% beginner, ${proposal.intermediatePct}% intermediate, ${proposal.advancedPct}% advanced)`
  )
  lines.push(`Lifts: ${proposal.liftCount}`)
  lines.push(`Snow reliability: ${proposal.snowReliability}`)
  lines.push(`Ski season: ${proposal.skiSeasonMonths}`)
  if (proposal.linkedResortsDescription) {
    lines.push(`Linked resorts: ${proposal.linkedResortsDescription}`)
  }

  if (accommodations.length > 0) {
    lines.push('')
    lines.push('### Accommodations')
    for (const acc of accommodations) {
      lines.push(`- **${acc.name}**: ${acc.cost} — ${acc.description}`)
      if (acc.url) lines.push(`  URL: ${acc.url}`)
    }
  }

  lines.push('')
  lines.push('## Participant Preferences')

  for (const { participant, preferences } of participantPrefs) {
    lines.push('')
    lines.push(`### ${participant.userName}`)
    lines.push(`- Ski/Snowboard: ${preferences.skiSnowboard.join(', ')}`)
    lines.push(`- Difficulty: ${preferences.difficulty.join(', ')}`)
    lines.push(`- Piste preference: ${preferences.piste.join(', ')}`)
    lines.push(
      `- Time allocation: slopes ${preferences.timeSlopes}%, eating ${preferences.timeEating}%, après-ski ${preferences.timeApres}%, hotel ${preferences.timeHotel}%`
    )
    lines.push(`- Accommodation: ${preferences.accommodation.join(', ')}`)
    if (preferences.notes) {
      lines.push(`- Notes: ${preferences.notes}`)
    }
  }

  return lines.join('\n')
}
