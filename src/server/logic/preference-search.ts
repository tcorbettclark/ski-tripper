import { hash } from 'canonical-json/hash'
import type { Participant, Preferences } from '../types'

export type { Participant, Preferences }

export function computeInputHash(
  participantPrefs: Array<{
    participant: Participant
    preferences: Preferences
  }>
): string {
  const data = {
    participants: participantPrefs.map((p) => ({
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
  return `You are a ski resort search assistant. Given a group's skiing and snowboarding preferences, produce a single natural-language search query paragraph suitable for embedding-based resort search.

Rules:
- Do NOT mention participant names — the search query is for embedding-based resort matching, not people
- Exclude participants without preferences — do not mention them at all
- Synthesize the group's preferences into one cohesive paragraph
- Emphasize the dominant preferences (what most people want)
- Mention minority preferences as secondary considerations
- Include ski/snowboard discipline, difficulty levels, piste types, time allocation preferences, accommodation preferences, and any special notes
- Consider airport proximity or transfer time preferences if mentioned in notes
- Use concrete, descriptive language about resort characteristics (terrain types, atmosphere, facilities) rather than abstract or metaphorical language, since the output will be matched against real resort descriptions using embedding similarity
- The paragraph should read naturally, not as a list — aim for something like: "A resort with mostly red and black runs, good off-piste opportunities, lively après-ski, near Geneva airport, with chalet-style accommodation"
- Output ONLY the search query paragraph with no additional text, headers, or commentary`
}

export function buildUserPrompt(
  participantPrefs: Array<{
    participant: Participant
    preferences: Preferences
  }>
): string {
  const lines: string[] = []

  lines.push('## Group Preferences')
  lines.push(`Group size: ${participantPrefs.length} skier(s)/snowboarder(s)`)
  lines.push('')

  for (const { preferences } of participantPrefs) {
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
    lines.push('')
  }

  lines.push(
    'Based on the above preferences, generate a natural language search query for finding the best ski resort match.'
  )

  return lines.join('\n')
}
