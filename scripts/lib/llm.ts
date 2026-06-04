import { aiJsonSafeParse } from 'ai-json-safe-parse'
import Exa from 'exa-js'
import { Ollama } from 'ollama'
import * as z from 'zod'
import type { JSONSchema } from 'zod/v4/core'

export const OLLAMA_HOST = 'https://ollama.com'
export const DEFAULT_MODEL = 'kimi-k2.6:cloud'

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

export const ollama = new Ollama({
  host: OLLAMA_HOST,
  headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
})

let _exa: Exa | undefined
export function getExa(): Exa {
  if (!_exa) {
    const apiKey = process.env.EXA_API_KEY
    if (!apiKey) throw new Error('EXA_API_KEY environment variable is not set')
    _exa = new Exa(apiKey)
  }
  return _exa
}

export function jsonCodec<T extends z.core.$ZodType>(schema: T) {
  return z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      const parsed = aiJsonSafeParse<Record<string, unknown>>(jsonString)
      if (parsed === null) {
        ctx.issues.push({
          code: 'invalid_format',
          format: 'json',
          input: jsonString,
          message: 'Failed to extract valid JSON from LLM response',
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

export const LLM_SYSTEM_PROMPT = `You are a ski resort data extractor. Given source text from web searches, extract factual data about the ski resort into a JSON object matching this schema:

{SCHEMA}

Rules:
- Extract only information that is explicitly stated in the source text
- Prefer data from "Authoritative source" sections over "General source" sections when values conflict
- If a value is not found in the text, set it to null — never fabricate data or guess specific numbers
- For altitude, the summitAltitude must be HIGHER than the baseAltitude
- For piste percentages (beginnerPct, intermediatePct, advancedPct), use the first reasonable estimate from the source text. Don't deliberate or reconsider — pick and move on
- Return valid JSON only, no explanatory text`

export const LLM_USER_PROMPT = (
  resortName: string,
  country: string,
  sourceText: string
) =>
  `Extract ski resort data for "${resortName}" in ${country} from the following source text:

${sourceText}`

export function buildJsonSchema(): JSONSchema.JSONSchema {
  const nullable = (
    schema: JSONSchema.JSONSchema & { description?: string },
    desc: string
  ): JSONSchema.JSONSchema => ({
    anyOf: [schema, { type: 'null' }],
    description: `${desc}, or null if not found`,
  })

  return {
    type: 'object',
    properties: {
      description: nullable(
        { type: 'string' },
        'A few paragraphs describing the ski resort, its terrain, atmosphere, and highlights'
      ),
      summitAltitude: nullable(
        { type: 'integer' },
        'Summit altitude in metres above sea level'
      ),
      baseAltitude: nullable(
        { type: 'integer' },
        'Base altitude in metres above sea level'
      ),
      nearestAirport: nullable(
        { type: 'string' },
        'IATA code of the nearest airport, e.g. "GVA"'
      ),
      transferTime: nullable(
        { type: 'string' },
        'Transfer time from airport, e.g. "2h 00m"'
      ),
      pisteKm: nullable(
        { type: 'integer' },
        'Total groomed piste length in kilometres'
      ),
      beginnerPct: nullable(
        { type: 'integer' },
        'Approximate percentage of beginner (blue) piste, e.g. 25'
      ),
      intermediatePct: nullable(
        { type: 'integer' },
        'Approximate percentage of intermediate (red) piste, e.g. 50'
      ),
      advancedPct: nullable(
        { type: 'integer' },
        'Approximate percentage of advanced (black) piste, e.g. 25'
      ),
      liftCount: nullable({ type: 'integer' }, 'Number of ski lifts'),
      snowReliability: nullable(
        {
          type: 'string',
          enum: ['high', 'medium', 'low'],
        },
        'Snow reliability rating (high/medium/low)'
      ),
      skiSeasonMonths: nullable(
        { type: 'string' },
        'Typical ski season, e.g. "Dec-Apr"'
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
