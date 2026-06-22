import * as fs from 'node:fs'

import { aiJsonSafeParse } from 'ai-json-safe-parse'
import Exa from 'exa-js'
import { Ollama } from 'ollama'
import * as z from 'zod'
import type { JSONSchema } from 'zod/v4/core'
import {
  server_get_exa_api_key,
  server_get_ollama_api_key,
} from '../../src/shared/env'

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

export function stringCoercedArray<T extends z.core.$ZodType>(
  elementSchema: T
) {
  return z.union([
    z.array(elementSchema),
    z.string().transform((v, ctx) => {
      try {
        const parsed = JSON.parse(v)
        if (!Array.isArray(parsed)) {
          ctx.addIssue({
            code: 'invalid_type',
            expected: 'array',
            received: typeof parsed,
            message: 'String did not parse to an array',
          })
          return z.NEVER as unknown as z.infer<T>[]
        }
        return parsed as z.infer<T>[]
      } catch {
        ctx.addIssue({
          code: 'invalid_format',
          format: 'json',
          message: 'Failed to parse string as JSON',
        })
        return z.NEVER as unknown as z.infer<T>[]
      }
    }),
  ])
}

export interface StreamResult {
  thinking: string
  doneReason: string | null
  chunkCount: number
  thinkingFilePath: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function streamThinking(
  stream: AsyncIterable<{
    message: { content: string; thinking?: string }
    done?: boolean
    done_reason?: string
  }>,
  onContent: (content: string) => void,
  thinkingFile: string
): Promise<StreamResult> {
  return new Promise((resolve, reject) => {
    let thinking = ''
    let doneReason: string | null = null
    let chunkCount = 0
    let thinkingBytes = 0
    let contentBytes = 0
    let contentStarted = false
    ;(async () => {
      try {
        for await (const chunk of stream) {
          chunkCount++
          const thinkPart = (
            chunk.message as unknown as Record<string, unknown>
          ).thinking
          if (typeof thinkPart === 'string' && thinkPart) {
            thinking += thinkPart
            thinkingBytes += Buffer.byteLength(thinkPart)
            fs.appendFileSync(thinkingFile, thinkPart)
            if (!contentStarted) {
              process.stdout.write(
                `\x1b[2K\r⏳ Thinking... ${formatBytes(thinkingBytes)}`
              )
            }
          }
          if (chunk.message.content) {
            if (!contentStarted) {
              contentStarted = true
            }
            contentBytes += Buffer.byteLength(chunk.message.content)
            process.stdout.write(
              `\x1b[2K\r📝 Generating... ${formatBytes(contentBytes)}`
            )
            onContent(chunk.message.content)
          }
          if (chunk.done) {
            doneReason = chunk.done_reason ?? null
          }
        }
        if (contentStarted) {
          process.stdout.write('\x1b[2K\r')
        } else if (thinking) {
          process.stdout.write('\x1b[2K\r')
        }
        resolve({
          thinking,
          doneReason,
          chunkCount,
          thinkingFilePath: thinkingFile,
        })
      } catch (err) {
        if (!contentStarted) {
          process.stdout.write('\x1b[2K\r')
        }
        reject(err instanceof Error ? err : new Error(String(err)))
      }
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

export const LLM_RETRY_EMPTY_PROMPT =
  'Your previous response was empty. Please extract the ski resort data as a JSON object matching the schema. Return valid JSON only, no explanatory text.'

export const LLM_RETRY_PARSE_PROMPT = (invalidContent: string) =>
  `Your previous response was not valid JSON. Here is what you returned:\n\n${invalidContent}\n\nPlease try again. Return ONLY a valid JSON object matching the schema, with no explanatory text before or after it. If you cannot determine a value, set it to null.`

export const LLM_SYSTEM_PROMPT = `You are a ski resort data extractor. Given source text from web searches, extract data about the ski resort into a JSON object matching this schema:

{SCHEMA}

Rules:
- Prefer data from "Authoritative source" sections over "General source" sections when values conflict
- When sources conflict on facts that change over time (e.g. lift counts, piste km, transfer routes, operating status, resort status), prefer data from more recent sources. Each source header includes a publication date — use it to resolve conflicts. If no source is newer than 3 years, note uncertainty
- For each description field, write a detailed paragraph on that specific topic. Use concrete nouns and observable facts — not adjectives, not marketing language. If the source text lacks detail on a topic, set that field to null rather than writing vague generalities
- For nearestAirport and transferTime: these are a pair — nearestAirport is the nearest international airport, and transferTime is the road transfer time in minutes from that airport. You may infer both using common knowledge. For example, if the text says "80km from Geneva", you should output "Geneva Airport" and 120 for transferTime; if it describes a high-altitude glacier resort, you should output "high" for snowReliability; if it mentions the season runs December to April, output "Dec-Apr"
- For websites, include every relevant URL found in the source text; do not attempt to consolidate or deduplicate
- Return valid JSON only, no explanatory text`

export const LLM_USER_PROMPT = (
  resortName: string,
  country: string,
  sourceText: string,
  knownFacts?: string
) => {
  const factsSection = knownFacts
    ? `\n\nKnown facts already captured (do NOT repeat these in any description field — each description field should add new detail from the source text):\n${knownFacts}\n`
    : ''
  return `Extract ski resort data for "${resortName}" in ${country} from the following source text:${factsSection}

For each description field, write a detailed paragraph on that specific topic. Use concrete facts from the source text. If the source text does not mention a topic, set that field to null — do not write vague generalities.

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

  const topicDesc = (topic: string, example: string, antiExample: string) =>
    `A detailed paragraph about ${topic}. Use concrete facts, not adjectives. For example, write "${example}" not "${antiExample}". If the source text lacks detail on this topic, set to null.`

  return {
    type: 'object',
    properties: {
      terrainDescription: nullable(
        { type: 'string' },
        topicDesc(
          'terrain character',
          'The terrain is dominated by wide, gentle cruising runs above the treeline, with a few steeper pitches dropping into the trees on the north side of the mountain. Most runs face south-east, so conditions soften early in the afternoon.',
          'fantastic terrain for all'
        )
      ),
      offPisteDescription: nullable(
        { type: 'string' },
        topicDesc(
          'off-piste quality',
          'Steep north-facing couloirs can be accessed from the top lift with a short hike along the ridge, holding cold powder days after a storm. The lower trees offer mellow gladed runs that are popular with locals when the upper mountain is wind-affected.',
          'superior off-piste'
        )
      ),
      valueDescription: nullable(
        { type: 'string' },
        topicDesc(
          'value and budget-friendliness',
          'One of the cheaper French resorts for lift passes, with a six-day adult pass around €250 and good-value family packages. Self-catering apartments near the slopes keep accommodation costs down compared to purpose-built rivals.',
          'great value'
        )
      ),
      familyDescription: nullable(
        { type: 'string' },
        topicDesc(
          'suitability for families vs groups',
          'Nursery slopes are at resort level, separate from faster traffic, giving beginners a safe area to learn. The ski school offers English-speaking group lessons for children from age four, and the traffic-free village centre means families can walk everywhere in boots.',
          'perfect for families'
        )
      ),
      apresSkiDescription: nullable(
        { type: 'string' },
        topicDesc(
          'apres-ski and nightlife',
          'Cosy old-town bars cluster around the church, with live music most weekends at Le Bar and a fondue restaurant that stays open until midnight. The scene is relaxed rather than rowdy — more vin chaud than vodka shots.',
          'vibrant nightlife'
        )
      ),
      resortCharacterDescription: nullable(
        { type: 'string' },
        topicDesc(
          'whether the resort is picturesque or purpose-built',
          'A purpose-built 1970s station with concrete apartment blocks stacked along the access road, offering ski-in/ski-out convenience but little alpine charm. Recent investment has added a swimming pool and refurbished the main lift-base area.',
          'charming resort'
        )
      ),
      liftSystemDescription: nullable(
        { type: 'string' },
        topicDesc(
          'lift system quality and age',
          'The lift network is modern and efficient, with heated chairlifts on the main sectors and high-speed gondolas from the village. Queues are rare outside peak weeks, though the link to the next valley can close in high winds.',
          'excellent lift system'
        )
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
        { type: 'string', enum: ['high', 'medium', 'low'] },
        'Snow reliability rating',
        'Infer from altitude, glacier coverage, or seasonal descriptions'
      ),
      skiSeasonMonths: nullable(
        { type: 'string' },
        'Typical ski season, e.g. "Dec-Apr"',
        'Infer from descriptions of opening/closing months'
      ),
      websites: {
        type: 'array',
        items: { type: 'string' },
        description:
          'All relevant website URLs found in the source text for this resort',
      },
      linkedResortsDescription: nullable(
        { type: 'string' },
        'Description of linked/connected resorts and the wider ski area',
        'Only include if the source text mentions linked resorts or a connected ski area'
      ),
    },
    required: [
      'terrainDescription',
      'offPisteDescription',
      'valueDescription',
      'familyDescription',
      'apresSkiDescription',
      'resortCharacterDescription',
      'liftSystemDescription',
      'nearestAirport',
      'transferTime',
      'snowReliability',
      'skiSeasonMonths',
      'websites',
      'linkedResortsDescription',
    ],
  }
}
