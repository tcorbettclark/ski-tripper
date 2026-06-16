import { aiJsonSafeParse } from 'ai-json-safe-parse'
import Exa from 'exa-js'
import { Ollama } from 'ollama'
import * as z from 'zod'
import type { JSONSchema } from 'zod/v4/core'
import {
  server_get_exa_api_key,
  server_get_ollama_api_key,
} from '../../shared/env'

export const OLLAMA_HOST = 'https://ollama.com'

export const SOURCE_WEBSITES = [
  'skiresort.info',
  'onthesnow.com',
  'snow-forecast.com',
  'skimuggle.com',
  'piste-map.com',
  'weski.com',
  'en.wikipedia.org',
] as const

export const ENRICH_SOURCE_WEBSITES = [
  'skiresort.info',
  'onthesnow.com',
  'snow-forecast.com',
  'skimuggle.com',
  'piste-map.com',
  'weski.com',
  'en.wikipedia.org',
] as const

let _ollama: Ollama | undefined
export function getOllama(): Ollama {
  if (!_ollama) {
    const apiKey = server_get_ollama_api_key()
    _ollama = new Ollama({
      host: OLLAMA_HOST,
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  }
  return _ollama
}

let _exa: Exa | undefined
export function getExa(): Exa {
  if (!_exa) {
    const apiKey = server_get_exa_api_key()
    _exa = new Exa(apiKey)
  }
  return _exa
}

// Try JSON.parse before aiJsonSafeParse. The LLM responses sometimes contain
// curly/smart quotes (e.g. \u201C \u201D) inside string values like "sketchy".
// aiJsonSafeParse's Unicode normalization converts these to ASCII double quotes,
// breaking the JSON structure by introducing unescaped quotes inside strings.
// This causes aiJsonSafeParse to fall back to extractJsonBlocks, which returns
// the first parseable fragment — often just the websites array instead of the
// full object. JSON.parse handles the original bytes correctly since Ollama
// streams proper escaped quotes, so we try it first and only fall back to
// aiJsonSafeParse for malformed JSON that needs repair.
function extractJsonObject(jsonString: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(jsonString)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed
    }
  } catch {}

  const parsed = aiJsonSafeParse<unknown>(jsonString)
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>
  }
  return null
}

export function jsonCodec<T extends z.core.$ZodType>(schema: T) {
  return z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      const parsed = extractJsonObject(jsonString)
      if (parsed === null) {
        ctx.issues.push({
          code: 'invalid_format',
          format: 'json',
          input: jsonString,
          message: 'Failed to extract valid JSON object from LLM response',
        })
        return z.NEVER as never
      }
      return parsed as never
    },
    encode: (value) => JSON.stringify(value),
  })
}

export function streamThinking(
  stream: AsyncIterable<{
    message: { content: string; thinking?: string }
  }>,
  onContent: (content: string) => void
): Promise<string> {
  return new Promise((resolve) => {
    let thinking = ''
    let isThinking = true
    ;(async () => {
      for await (const chunk of stream) {
        const thinkPart = (chunk.message as unknown as Record<string, unknown>)
          .thinking
        if (typeof thinkPart === 'string' && thinkPart) {
          thinking += thinkPart
          process.stdout.write(`\x1b[2m${thinkPart as string}\x1b[0m`)
        }
        if (chunk.message.content) {
          if (isThinking) {
            isThinking = false
            console.log()
          }
          onContent(chunk.message.content)
        }
      }
      resolve(thinking)
    })()
  })
}

export const WEB_SEARCH_TOOL_DEFINITION = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description:
      'Search the web for factual information about ski resorts. Use this to look up accurate resort names, countries, and regions.',
    parameters: {
      type: 'object',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          description: 'Search query for ski resort information',
        },
      },
    },
  },
}

export const LLM_SYSTEM_PROMPT = `You are a ski resort data extractor. Given source text from web searches, extract data about the ski resort into a JSON object matching this schema:

{SCHEMA}

Rules:
- Prefer data from "Authoritative source" sections over "General source" sections when values conflict
- For description, websites, and linkedResortsDescription: extract only information that is explicitly stated in the source text
- For nearestAirport and transferTime: these are a pair — nearestAirport is the nearest international airport, and transferTime is the road transfer time in minutes from that airport. You may infer both using common knowledge. For example, if the text says "80km from Geneva", you should output "Geneva Airport" and 120 for transferTime; if it describes a high-altitude glacier resort, you should output "high" for snowReliability; if it mentions the season runs December to April, output "Dec-Apr"
- For description: write 4-6 factual paragraphs. Do NOT repeat facts provided in the user prompt (altitudes, piste km, lift count, trail percentages, nearestAirport, transferTime, snowReliability, skiSeasonMonths, linkedResortsDescription). Where the source text provides detail, cover: (1) terrain character — e.g. "wide, gentle cruising runs above the treeline" not "fantastic terrain for all", (2) off-piste quality — e.g. "steep north-facing couloirs accessed from the top lift" not "superb off-piste", (3) value — e.g. "one of the cheaper French resorts for lift passes" not "great value", (4) suitability for families vs groups — e.g. "nursery slopes are at resort level, separate from faster traffic" not "perfect for families", (5) apres-ski and nightlife — e.g. "cosy old-town bars cluster around the church" not "vibrant nightlife", (6) whether picturesque or purpose-built — e.g. "a purpose-built 1970s station with concrete apartment blocks" not "charming resort", (7) lift system quality and age — e.g. "the lift network is modern and efficient, with heated chairlifts on the main sectors" not "excellent lift system", (8) overall atmosphere. Write like a guidebook, not a brochure — concrete facts over adjectives. Only include details grounded in the source text; do not fabricate plausible-sounding specifics. Do not infer specific facts from aggregate data — e.g. do not colour-code a named run based on the resort's trail percentages; only describe named runs as the source text describes them. If the source text lacks detail on a topic, skip that topic rather than padding with generalities
- If a value truly cannot be determined even with reasonable inference, set it to null
- For websites, include every relevant URL found in the source text; do not attempt to consolidate or deduplicate
- Return valid JSON only, no explanatory text`

export const LLM_USER_PROMPT = (
  resortName: string,
  country: string,
  sourceText: string,
  knownFacts?: string
) => {
  const factsSection = knownFacts
    ? `\n\nKnown facts already captured (do NOT repeat these in the description field):\n${knownFacts}\n`
    : ''
  return `Extract ski resort data for "${resortName}" in ${country} from the following source text:${factsSection}

${sourceText}`
}

export function buildJsonSchema(): JSONSchema.JSONSchema {
  const nullable = (
    schema: JSONSchema.JSONSchema & { description?: string },
    desc: string,
    hint?: string
  ): JSONSchema.JSONSchema => ({
    anyOf: [schema, { type: 'null' }],
    description: hint ? `${desc}. ${hint}` : `${desc}, or null if not found`,
  })

  return {
    type: 'object',
    properties: {
      description: nullable(
        { type: 'string' },
        'A factual description (4-6 paragraphs) adding concrete detail not already provided in the user prompt. Do NOT repeat facts like altitudes, piste km, lift count, trail percentages, nearestAirport, transferTime, snowReliability, skiSeasonMonths, or linkedResortsDescription. Instead cover: terrain character; off-piste quality; value and budget-friendliness; family vs group suitability; apres-ski and nightlife; whether picturesque or purpose-built; lift system quality; overall atmosphere. Write like a guidebook, not a brochure — prefer specific nouns and observable facts over adjectives and subjective opinion. Avoid marketing phrases like "offers something for everyone", "great for all abilities", "vibrant", "fantastic", "superb", or "satisfying sense of space".'
      ),
      nearestAirport: nullable(
        { type: 'string' },
        'Name of the nearest international airport, e.g. "Geneva Airport"',
        'Use standard airport names like "Geneva Airport" or "Salzburg Airport", not IATA codes'
      ),
      transferTime: nullable(
        { type: 'integer' },
        'Transfer time from nearest international airport in minutes, e.g. 120',
        'Infer from distance or transport details if exact time is not given'
      ),
      snowReliability: nullable(
        {
          type: 'string',
          enum: ['high', 'medium', 'low'],
        },
        'Snow reliability rating (high/medium/low)',
        'Infer from altitude, glacier cover, or snow history descriptions'
      ),
      skiSeasonMonths: nullable(
        { type: 'string' },
        'Typical ski season, e.g. "Dec-Apr"',
        'Infer from opening/closing dates or general season descriptions'
      ),
      websites: nullable(
        {
          type: 'array',
          items: { type: 'string' },
        },
        'All URLs of websites with information about skiing at the resort. Include every relevant URL found in the source text; do not attempt to consolidate or deduplicate.'
      ),
      linkedResortsDescription: nullable(
        { type: 'string' },
        'One sentence describing nearby linked resorts, e.g. "Part of the 3 Vallées ski area, linked to Méribel and Courchevel by lift."'
      ),
    },
    required: [],
  }
}
