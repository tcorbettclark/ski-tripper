#!/usr/bin/env bun

import * as readline from 'node:readline/promises'
import { aiJsonSafeParse } from 'ai-json-safe-parse'
import { Command } from 'commander'
import Exa, { type DeepObjectOutputSchema } from 'exa-js'
import { Client, Query, TablesDB } from 'node-appwrite'
import { Ollama } from 'ollama'
import * as z from 'zod'
import type { JSONSchema } from 'zod/v4/core'

const OLLAMA_HOST = 'https://ollama.com'
const DATABASE_ID = process.env.PUBLIC_APPWRITE_DATABASE_ID as string
const RESORTS_TABLE_ID = process.env.PUBLIC_APPWRITE_RESORTS_TABLE_ID as string
const DEFAULT_MODEL = 'kimi-k2.6:cloud'
const EXA_SOURCED_NUM_RESULTS = 4
const EXA_BROAD_NUM_RESULTS = 4
const EXA_MAX_CHARS = 8000 as const

const SOURCE_WEBSITES = [
  'skiresort.info',
  'onthesnow.com',
  'snow-forecast.com',
  'skimuggle.com',
  'piste-map.com',
  'weski.com',
  'en.wikipedia.org',
] as const

const EXA_SEARCH_QUERY = (resortName: string, country: string) =>
  `Official website and ski area information for ${resortName} ski resort in ${country}, including piste maps, lift status, altitude, nearest airport, transfer time, and resort facilities`

const EXA_COORDS_QUERY = (resortName: string, country: string) =>
  `Location and geographic coordinates of ${resortName} ski resort in ${country}`

const COORDS_SCHEMA: DeepObjectOutputSchema = {
  type: 'object',
  properties: {
    latitude: {
      type: 'string',
      description: 'Latitude as a string, e.g. "46.0939"',
    },
    longitude: {
      type: 'string',
      description: 'Longitude as a string, e.g. "7.0765"',
    },
  },
  required: ['latitude', 'longitude'],
}

const LLM_SYSTEM_PROMPT = `You are a ski resort data extractor. Given source text from web searches, extract factual data about the ski resort into a JSON object matching this schema:

{SCHEMA}

Rules:
- Extract only information that is explicitly stated in the source text
- Prefer data from "Authoritative source" sections over "General source" sections when values conflict
- If a value is not found in the text, use reasonable defaults but never make up specific numbers
- For altitude, the summitAltitude must be HIGHER than the baseAltitude
- For piste percentages (beginnerPct, intermediatePct, advancedPct), estimate from whatever data is available (km of piste, number of runs, or stated percentages). Round to the nearest 5 so they sum to 100
- Return valid JSON only, no explanatory text`

const LLM_USER_PROMPT = (
  resortName: string,
  country: string,
  sourceText: string
) =>
  `Extract ski resort data for "${resortName}" in ${country} from the following source text:

${sourceText}`

const ANSI_RESET = '\x1b[0m'
const ANSI_DIM = '\x1b[2m'
const ANSI_BOLD = '\x1b[1m'
const ANSI_CYAN = '\x1b[36m'
const ANSI_GREEN = '\x1b[32m'
const ANSI_YELLOW = '\x1b[33m'
const ANSI_RED = '\x1b[31m'

type LogLevel = 'info' | 'success' | 'warn' | 'error'

const LEVEL_STYLES: Record<LogLevel, { color: string; prefix: string }> = {
  info: { color: ANSI_CYAN, prefix: 'i' },
  success: { color: ANSI_GREEN, prefix: '\u2713' },
  warn: { color: ANSI_YELLOW, prefix: '!' },
  error: { color: ANSI_RED, prefix: '\u2717' },
}

function log(level: LogLevel, tag: string, message: string, indent = 0): void {
  const { color, prefix } = LEVEL_STYLES[level]
  const pad = '  '.repeat(indent)
  const tagStr = `${ANSI_BOLD}[${tag}]${ANSI_RESET}`
  const prefixStr = `${color}${prefix}${ANSI_RESET}`
  const output = `${pad}${prefixStr} ${tagStr} ${message}`
  if (level === 'error') {
    console.error(output)
  } else {
    console.log(output)
  }
}

function logSummary(label: string, value: string, indent = 0) {
  const pad = '  '.repeat(indent)
  console.log(
    `${pad}${ANSI_DIM}${label.padEnd(24)}${ANSI_RESET} ${ANSI_BOLD}${value}${ANSI_RESET}`
  )
}

function initAppwrite() {
  log(
    'info',
    'appwrite',
    `Connecting to ${process.env.PUBLIC_APPWRITE_ENDPOINT} (project: ${process.env.PUBLIC_APPWRITE_PROJECT_ID})`
  )
  const adminClient = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT as string)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID as string)
    .setKey(process.env.APPWRITE_DATABASE_API_KEY as string)

  log('success', 'appwrite', 'Client initialized')
  return new TablesDB(adminClient)
}

const ollama = new Ollama({
  host: OLLAMA_HOST,
  headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
})

const exa = new Exa(process.env.EXA_API_KEY as string)

const enrichSchema = z.object({
  description: z
    .string()
    .describe(
      'A few paragraphs describing the ski resort, its terrain, atmosphere, and highlights'
    ),
  summitAltitude: z.coerce
    .number()
    .int()
    .describe('Summit altitude in metres above sea level'),
  baseAltitude: z.coerce
    .number()
    .int()
    .describe('Base altitude in metres above sea level'),
  nearestAirport: z
    .string()
    .describe('IATA code of the nearest airport, e.g. "GVA"'),
  transferTime: z
    .string()
    .describe('Transfer time from airport, e.g. "2h 00m"'),
  pisteKm: z.coerce
    .number()
    .int()
    .describe('Total groomed piste length in kilometres'),
  beginnerPct: z.coerce
    .number()
    .int()
    .describe(
      'Percentage of beginner (blue) piste, rounded to nearest 5, e.g. 25'
    ),
  intermediatePct: z.coerce
    .number()
    .int()
    .describe(
      'Percentage of intermediate (red) piste, rounded to nearest 5, e.g. 50'
    ),
  advancedPct: z.coerce
    .number()
    .int()
    .describe(
      'Percentage of advanced (black) piste, rounded to nearest 5, e.g. 25'
    ),
  liftCount: z.coerce.number().int().describe('Number of ski lifts'),
  snowReliability: z
    .enum(['high', 'medium', 'low'])
    .describe('Snow reliability rating'),
  skiSeasonMonths: z.string().describe('Typical ski season, e.g. "Dec-Apr"'),
  websites: z
    .array(z.string())
    .describe(
      '3 to 6 URLs of websites with information about skiing at the resort, e.g. ["https://www.zermatt.ch/en/skiing"]. Refer to the key source information, also piste maps.'
    ),
  linkedResortsDescription: z
    .string()
    .describe(
      'One sentence describing nearby linked resorts, e.g. "Part of the 3 Vallées ski area, linked to Méribel and Courchevel by lift."'
    ),
})

type EnrichData = z.infer<typeof enrichSchema>

function normalisePistePercentages(data: EnrichData): EnrichData {
  const b = data.beginnerPct
  const i = data.intermediatePct
  const a = data.advancedPct
  const total = b + i + a
  if (total === 0) return data

  const round5 = (n: number) => Math.round(n / 5) * 5
  let nb = round5((b / total) * 100)
  let ni = round5((i / total) * 100)
  let na = round5((a / total) * 100)

  const remainder = 100 - (nb + ni + na)
  if (remainder !== 0) {
    const biggest =
      nb >= ni && nb >= na ? 'beginner' : ni >= na ? 'intermediate' : 'advanced'
    if (biggest === 'beginner') nb += remainder
    else if (biggest === 'intermediate') ni += remainder
    else na += remainder
  }

  return { ...data, beginnerPct: nb, intermediatePct: ni, advancedPct: na }
}

interface Coordinates {
  latitude: string
  longitude: string
}

async function fetchCoordinates(
  resortName: string,
  country: string
): Promise<Coordinates | null> {
  log('info', 'enrich', 'Fetching coordinates from Exa...', 1)
  try {
    const [sourcedResponse, broadResponse] = await Promise.all([
      exa.search(EXA_COORDS_QUERY(resortName, country), {
        type: 'deep-lite',
        numResults: 3,
        useAutoprompt: true,
        includeDomains: [...SOURCE_WEBSITES],
        contents: { text: { maxCharacters: 2000 } },
        outputSchema: COORDS_SCHEMA,
      }),
      exa.search(EXA_COORDS_QUERY(resortName, country), {
        type: 'deep-lite',
        numResults: 3,
        useAutoprompt: true,
        contents: { text: { maxCharacters: 2000 } },
        outputSchema: COORDS_SCHEMA,
      }),
    ])

    const output = (sourcedResponse.output?.content ??
      broadResponse.output?.content) as
      | { latitude: string; longitude: string }
      | undefined
    if (output?.latitude && output?.longitude) {
      log(
        'success',
        'enrich',
        `Coordinates: ${output.latitude}, ${output.longitude}`,
        1
      )
      return { latitude: output.latitude, longitude: output.longitude }
    }
  } catch (err) {
    log('warn', 'enrich', `Deep search for coordinates failed: ${err}`, 1)
  }

  log('warn', 'enrich', 'No coordinates found, falling back to text search', 1)
  try {
    const results = await exa.search(EXA_COORDS_QUERY(resortName, country), {
      type: 'auto',
      numResults: 3,
      useAutoprompt: true,
      contents: {
        text: { maxCharacters: 2000 },
        highlights: {
          query: 'latitude longitude coordinates',
          maxCharacters: 1000,
        },
      },
    })

    const coordRegex = /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/
    for (const result of results.results) {
      const textToSearch = [
        ...(result.highlights ?? []),
        result.text ?? '',
      ].join(' ')
      const match = textToSearch.match(coordRegex)
      if (match) {
        log(
          'success',
          'enrich',
          `Coordinates (from text): ${match[1]}, ${match[2]}`,
          1
        )
        return { latitude: match[1], longitude: match[2] }
      }
    }
  } catch (err) {
    log('warn', 'enrich', `Fallback coordinate search failed: ${err}`, 1)
  }

  log('error', 'enrich', 'Could not determine coordinates', 1)
  return null
}

function jsonCodec<T extends z.core.$ZodType>(schema: T) {
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

function buildJsonSchema(): JSONSchema.JSONSchema {
  return {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description:
          'A few paragraphs describing the ski resort, its terrain, atmosphere, and highlights',
      },
      summitAltitude: {
        type: 'integer',
        description: 'Summit altitude in metres above sea level',
      },
      baseAltitude: {
        type: 'integer',
        description: 'Base altitude in metres above sea level',
      },
      nearestAirport: {
        type: 'string',
        description: 'IATA code of the nearest airport, e.g. "GVA"',
      },
      transferTime: {
        type: 'string',
        description: 'Transfer time from airport, e.g. "2h 00m"',
      },
      pisteKm: {
        type: 'integer',
        description: 'Total groomed piste length in kilometres',
      },
      beginnerPct: {
        type: 'integer',
        description:
          'Percentage of beginner (blue) piste, rounded to nearest 5, e.g. 25',
      },
      intermediatePct: {
        type: 'integer',
        description:
          'Percentage of intermediate (red) piste, rounded to nearest 5, e.g. 50',
      },
      advancedPct: {
        type: 'integer',
        description:
          'Percentage of advanced (black) piste, rounded to nearest 5, e.g. 25',
      },
      liftCount: {
        type: 'integer',
        description: 'Number of ski lifts',
      },
      snowReliability: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Snow reliability rating',
      },
      skiSeasonMonths: {
        type: 'string',
        description: 'Typical ski season, e.g. "Dec-Apr"',
      },
      websites: {
        type: 'array',
        items: { type: 'string' },
        description:
          'URLs of websites with information about skiing at the resort',
      },
      linkedResortsDescription: {
        type: 'string',
        description:
          'One sentence describing nearby linked resorts, e.g. "Part of the 3 Vallées ski area, linked to Méribel and Courchevel by lift."',
      },
    },
    required: [
      'description',
      'summitAltitude',
      'baseAltitude',
      'nearestAirport',
      'transferTime',
      'pisteKm',
      'beginnerPct',
      'intermediatePct',
      'advancedPct',
      'liftCount',
      'snowReliability',
      'skiSeasonMonths',
      'websites',
      'linkedResortsDescription',
    ],
  }
}

const JSON_SCHEMA_PROPERTIES: Record<string, JSONSchema.JSONSchema> =
  buildJsonSchema().properties as Record<string, JSONSchema.JSONSchema>

function buildSubsetJsonSchema(fields: string[]): JSONSchema.JSONSchema {
  const properties: Record<string, JSONSchema.JSONSchema> = {}
  for (const field of fields) {
    if (JSON_SCHEMA_PROPERTIES[field]) {
      properties[field] = JSON_SCHEMA_PROPERTIES[field]
    }
  }
  return {
    type: 'object',
    properties,
    required: fields.filter((f) => f in JSON_SCHEMA_PROPERTIES),
  }
}

function buildSubsetZodSchema(
  fields: string[]
): z.ZodObject<Record<string, z.core.$ZodType>> {
  const shape: Record<string, z.core.$ZodType> = {}
  for (const field of fields) {
    if (field in enrichSchema.shape) {
      shape[field] =
        enrichSchema.shape[field as keyof typeof enrichSchema.shape]
    }
  }
  return z.object(shape)
}

type AuditField =
  | 'description'
  | 'latitude'
  | 'longitude'
  | 'summitAltitude'
  | 'baseAltitude'
  | 'nearestAirport'
  | 'transferTime'
  | 'pisteKm'
  | 'pisteBreakdown'
  | 'liftCount'
  | 'snowReliability'
  | 'skiSeasonMonths'
  | 'websites'
  | 'linkedResortsDescription'

function auditFieldsToEnrichFields(fields: AuditField[]): string[] {
  const enrichFields: string[] = []
  for (const field of fields) {
    if (field === 'pisteBreakdown') {
      enrichFields.push('beginnerPct', 'intermediatePct', 'advancedPct')
    } else if (field === 'latitude' || field === 'longitude') {
      // coordinates are fetched separately, not via LLM
    } else {
      enrichFields.push(field)
    }
  }
  return [...new Set(enrichFields)]
}

function logEnrichData(
  data: EnrichData,
  coords: Coordinates | null,
  indent = 0
) {
  const coordsStr = coords
    ? `${coords.latitude}, ${coords.longitude}`
    : 'unknown'
  logSummary('Coordinates', coordsStr, indent)
  logSummary(
    'Altitude',
    `${data.baseAltitude}m - ${data.summitAltitude}m`,
    indent
  )
  logSummary('Airport', `${data.nearestAirport} (${data.transferTime})`, indent)
  logSummary('Piste', `${data.pisteKm} km`, indent)
  logSummary('Beginner', `${data.beginnerPct}%`, indent)
  logSummary('Intermediate', `${data.intermediatePct}%`, indent)
  logSummary('Advanced', `${data.advancedPct}%`, indent)
  logSummary('Lifts', `${data.liftCount}`, indent)
  logSummary('Snow', data.snowReliability, indent)
  logSummary('Season', data.skiSeasonMonths, indent)
  logSummary('Websites', data.websites.join(', '), indent)
  logSummary('Linked Resorts', data.linkedResortsDescription, indent)
  logSummary('Description', data.description, indent)
}

async function enrichResort(
  resortName: string,
  country: string,
  model: string
): Promise<{ data: EnrichData; coords: Coordinates | null } | null> {
  const responseCodec = jsonCodec(enrichSchema)

  log('info', 'enrich', `Enriching "${resortName}" via Exa+LLM`)

  const coords = await fetchCoordinates(resortName, country)

  log('info', 'enrich', 'Fetching source text from Exa...', 1)
  const [sourcedResults, broadResults] = await Promise.all([
    exa.search(EXA_SEARCH_QUERY(resortName, country), {
      type: 'auto',
      numResults: EXA_SOURCED_NUM_RESULTS,
      useAutoprompt: true,
      includeDomains: [...SOURCE_WEBSITES],
      contents: {
        text: { maxCharacters: EXA_MAX_CHARS },
        highlights: true,
      },
    }),
    exa.search(EXA_SEARCH_QUERY(resortName, country), {
      type: 'auto',
      numResults: EXA_BROAD_NUM_RESULTS,
      useAutoprompt: true,
      contents: {
        text: { maxCharacters: EXA_MAX_CHARS },
        highlights: true,
      },
    }),
  ])

  const seenUrls = new Set<string>()
  const allResults = [...sourcedResults.results, ...broadResults.results]
  const dedupedResults = allResults.filter((r) => {
    if (seenUrls.has(r.url)) return false
    seenUrls.add(r.url)
    return true
  })

  const sourcedHosts = new Set(
    sourcedResults.results.map((r) => new URL(r.url).hostname)
  )

  log(
    'info',
    'enrich',
    `Sourced: ${sourcedResults.results.length} results, Broad: ${broadResults.results.length} results, Deduped: ${dedupedResults.length}`,
    1
  )
  for (const r of dedupedResults) {
    const tag = sourcedHosts.has(new URL(r.url).hostname)
      ? 'authoritative'
      : 'general'
    log('info', 'enrich', `  [${tag}] ${r.url}`, 2)
  }

  const sourceText = dedupedResults
    .filter((r) => r.text)
    .map((r) => {
      const tag = sourcedHosts.has(new URL(r.url).hostname)
        ? 'Authoritative source'
        : 'General source'
      const parts = [`## ${r.title ?? 'Untitled'} (${tag})\nURL: ${r.url}`]
      if (r.highlights?.length) {
        parts.push(`### Key facts\n${r.highlights.join('\n')}`)
      }
      parts.push(r.text!)
      return parts.join('\n')
    })
    .join('\n\n')

  if (!sourceText) {
    log('error', 'enrich', 'No source text found', 1)
    return null
  }

  log(
    'success',
    'enrich',
    `Got ${sourceText.length} chars of source text from ${dedupedResults.length} results`,
    1
  )

  const systemPrompt = LLM_SYSTEM_PROMPT.replace(
    '{SCHEMA}',
    JSON.stringify(buildJsonSchema(), null, 2)
  )

  const userPrompt = LLM_USER_PROMPT(resortName, country, sourceText)

  log('info', 'enrich', 'Streaming LLM extraction...', 1)
  const stream = await ollama.chat({
    stream: true,
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  let content = ''
  let thinking = ''
  let isThinking = true
  for await (const chunk of stream) {
    const thinkPart = (chunk.message as unknown as Record<string, unknown>)
      .thinking
    if (typeof thinkPart === 'string' && thinkPart) {
      thinking += thinkPart
      process.stdout.write(`${ANSI_DIM}${thinkPart}${ANSI_RESET}`)
    }
    if (chunk.message.content) {
      if (isThinking) {
        isThinking = false
        console.log()
        log('info', 'enrich', `Model thought for ${thinking.length} chars`, 1)
      }
      content += chunk.message.content
      process.stdout.write(chunk.message.content)
    }
  }
  console.log()
  if (!content) {
    log('error', 'enrich', 'LLM returned empty content after thinking', 1)
    return null
  }
  log('info', 'enrich', `LLM response received (${content.length} chars)`, 1)

  const result = responseCodec.decode(content, { reportInput: true })
  if (!result) {
    log(
      'error',
      'enrich',
      `Failed to parse LLM response: ${content.slice(0, 300)}`,
      1
    )
    return null
  }

  log('success', 'enrich', `Successfully enriched "${resortName}"`, 1)
  const normalised = normalisePistePercentages(result)
  if (
    normalised.beginnerPct !== result.beginnerPct ||
    normalised.intermediatePct !== result.intermediatePct ||
    normalised.advancedPct !== result.advancedPct
  ) {
    log(
      'info',
      'enrich',
      `Normalised piste %: ${result.beginnerPct}/${result.intermediatePct}/${result.advancedPct} -> ${normalised.beginnerPct}/${normalised.intermediatePct}/${normalised.advancedPct}`,
      1
    )
  }
  return { data: normalised, coords }
}

interface UnenrichedResort {
  $id: string
  resortName: string
  country: string
  region: string
}

interface ResortRow extends UnenrichedResort {
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
  websites: string
  linkedResortsDescription: string
  enriched: boolean
}

async function listUnenrichedResorts(
  adminTablesDb: TablesDB
): Promise<UnenrichedResort[]> {
  log('info', 'appwrite', 'Fetching un-enriched resorts from database...')
  const resorts: UnenrichedResort[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const { rows } = await adminTablesDb.listRows({
      databaseId: DATABASE_ID,
      tableId: RESORTS_TABLE_ID,
      queries: [
        Query.equal('enriched', false),
        Query.limit(limit),
        Query.offset(offset),
      ],
    })
    for (const row of rows) {
      const r = row as Record<string, unknown>
      resorts.push({
        $id: r.$id as string,
        resortName: r.resortName as string,
        country: r.country as string,
        region: r.region as string,
      })
    }
    log(
      'info',
      'appwrite',
      `Fetched ${rows.length} rows (total so far: ${resorts.length})`,
      1
    )
    if (rows.length < limit) break
    offset += limit
  }
  log('success', 'appwrite', `Total un-enriched resorts: ${resorts.length}`)
  return resorts
}

async function listAllEnrichedResorts(
  adminTablesDb: TablesDB
): Promise<ResortRow[]> {
  log('info', 'appwrite', 'Fetching enriched resorts from database...')
  const resorts: ResortRow[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const { rows } = await adminTablesDb.listRows({
      databaseId: DATABASE_ID,
      tableId: RESORTS_TABLE_ID,
      queries: [
        Query.equal('enriched', true),
        Query.limit(limit),
        Query.offset(offset),
      ],
    })
    for (const row of rows) {
      const r = row as Record<string, unknown>
      resorts.push({
        $id: r.$id as string,
        resortName: r.resortName as string,
        country: r.country as string,
        region: r.region as string,
        description: (r.description as string) ?? '',
        latitude: (r.latitude as string) ?? '',
        longitude: (r.longitude as string) ?? '',
        summitAltitude: (r.summitAltitude as number) ?? 0,
        baseAltitude: (r.baseAltitude as number) ?? 0,
        nearestAirport: (r.nearestAirport as string) ?? '',
        transferTime: (r.transferTime as string) ?? '',
        pisteKm: (r.pisteKm as number) ?? 0,
        beginnerPct: (r.beginnerPct as number) ?? 0,
        intermediatePct: (r.intermediatePct as number) ?? 0,
        advancedPct: (r.advancedPct as number) ?? 0,
        liftCount: (r.liftCount as number) ?? 0,
        snowReliability: (r.snowReliability as string) ?? '',
        skiSeasonMonths: (r.skiSeasonMonths as string) ?? '',
        websites: (r.websites as string) ?? '',
        linkedResortsDescription: (r.linkedResortsDescription as string) ?? '',
        enriched: r.enriched as boolean,
      })
    }
    log(
      'info',
      'appwrite',
      `Fetched ${rows.length} rows (total so far: ${resorts.length})`,
      1
    )
    if (rows.length < limit) break
    offset += limit
  }
  log('success', 'appwrite', `Total enriched resorts: ${resorts.length}`)
  return resorts
}

type IssueKind =
  | 'missing_string'
  | 'missing_number'
  | 'zero_number'
  | 'too_few_websites'
  | 'short_description'
  | 'invalid_airport'
  | 'invalid_snow_reliability'
  | 'invalid_season'
  | 'altitude_inverted'

interface AuditIssue {
  resort: string
  country: string
  field: string
  kind: IssueKind
  detail: string
}

const MIN_WEBSITES = 3
const MIN_DESCRIPTION_LENGTH = 100
const IATA_PATTERN = /^[A-Z]{3}$/

function auditResort(resort: ResortRow): AuditIssue[] {
  const issues: AuditIssue[] = []

  const addMissingString = (
    field: keyof ResortRow,
    value: string,
    label: string
  ) => {
    if (!value || value.trim() === '') {
      issues.push({
        resort: resort.resortName,
        country: resort.country,
        field,
        kind: 'missing_string',
        detail: `${label} is empty`,
      })
    }
  }

  const addZeroNumber = (
    field: keyof ResortRow,
    value: number,
    label: string
  ) => {
    if (value === 0) {
      issues.push({
        resort: resort.resortName,
        country: resort.country,
        field,
        kind: 'zero_number',
        detail: `${label} is zero`,
      })
    }
  }

  addMissingString('description', resort.description, 'Description')
  if (
    resort.description &&
    resort.description.trim().length < MIN_DESCRIPTION_LENGTH
  ) {
    issues.push({
      resort: resort.resortName,
      country: resort.country,
      field: 'description',
      kind: 'short_description',
      detail: `Description is only ${resort.description.trim().length} chars (min ${MIN_DESCRIPTION_LENGTH})`,
    })
  }

  addMissingString('latitude', resort.latitude, 'Latitude')
  addMissingString('longitude', resort.longitude, 'Longitude')
  if (resort.summitAltitude === 0 && resort.baseAltitude === 0) {
    issues.push({
      resort: resort.resortName,
      country: resort.country,
      field: 'summitAltitude',
      kind: 'zero_number',
      detail: 'Both summit and base altitude are zero',
    })
  }

  if (
    resort.summitAltitude > 0 &&
    resort.baseAltitude > 0 &&
    resort.summitAltitude <= resort.baseAltitude
  ) {
    issues.push({
      resort: resort.resortName,
      country: resort.country,
      field: 'summitAltitude',
      kind: 'altitude_inverted',
      detail: `Summit (${resort.summitAltitude}m) <= Base (${resort.baseAltitude}m)`,
    })
  }

  addMissingString('nearestAirport', resort.nearestAirport, 'Nearest airport')
  if (
    resort.nearestAirport &&
    !IATA_PATTERN.test(resort.nearestAirport.trim())
  ) {
    issues.push({
      resort: resort.resortName,
      country: resort.country,
      field: 'nearestAirport',
      kind: 'invalid_airport',
      detail: `Nearest airport "${resort.nearestAirport}" is not a valid IATA code`,
    })
  }

  addMissingString('transferTime', resort.transferTime, 'Transfer time')
  addZeroNumber('pisteKm', resort.pisteKm, 'Piste km')
  if (
    resort.beginnerPct === 0 &&
    resort.intermediatePct === 0 &&
    resort.advancedPct === 0
  ) {
    issues.push({
      resort: resort.resortName,
      country: resort.country,
      field: 'pisteBreakdown',
      kind: 'zero_number',
      detail: 'All piste breakdowns (beginner/intermediate/advanced) are zero',
    })
  }
  addZeroNumber('liftCount', resort.liftCount, 'Lift count')

  addMissingString(
    'snowReliability',
    resort.snowReliability,
    'Snow reliability'
  )
  if (
    resort.snowReliability &&
    !['high', 'medium', 'low'].includes(resort.snowReliability)
  ) {
    issues.push({
      resort: resort.resortName,
      country: resort.country,
      field: 'snowReliability',
      kind: 'invalid_snow_reliability',
      detail: `Snow reliability "${resort.snowReliability}" is not high/medium/low`,
    })
  }

  addMissingString('skiSeasonMonths', resort.skiSeasonMonths, 'Ski season')
  if (resort.skiSeasonMonths) {
    const season = resort.skiSeasonMonths.trim()
    const isMonMon = /^[A-Z][a-z]{2}-[A-Z][a-z]{2}$/.test(season)
    const isYearRound = /^year.?round$/i.test(season)
    if (!isMonMon && !isYearRound) {
      issues.push({
        resort: resort.resortName,
        country: resort.country,
        field: 'skiSeasonMonths',
        kind: 'invalid_season',
        detail: `Ski season "${resort.skiSeasonMonths}" doesn't match Mon-Mon or Year-round format`,
      })
    }
  }

  let websites: string[] = []
  try {
    websites = resort.websites ? JSON.parse(resort.websites) : []
  } catch {
    websites = []
  }
  if (websites.length === 0) {
    issues.push({
      resort: resort.resortName,
      country: resort.country,
      field: 'websites',
      kind: 'missing_string',
      detail: 'Websites list is empty',
    })
  } else if (websites.length < MIN_WEBSITES) {
    issues.push({
      resort: resort.resortName,
      country: resort.country,
      field: 'websites',
      kind: 'too_few_websites',
      detail: `Only ${websites.length} website(s) (min ${MIN_WEBSITES})`,
    })
  }

  addMissingString(
    'linkedResortsDescription',
    resort.linkedResortsDescription,
    'Linked resorts description'
  )

  return issues
}

function displayAuditResults(issues: AuditIssue[], totalResorts: number) {
  const resortsAffected = new Set(issues.map((i) => i.resort))
  const cleanCount = totalResorts - resortsAffected.size

  console.log()
  console.log(`${ANSI_CYAN}${ANSI_BOLD}Audit Results${ANSI_RESET}`)
  console.log()

  logSummary('Total resorts', `${totalResorts}`, 1)
  logSummary('Resorts with issues', `${resortsAffected.size}`, 1)
  logSummary('Clean resorts', `${cleanCount}`, 1)
  logSummary('Total issues', `${issues.length}`, 1)

  const byKind: Record<string, AuditIssue[]> = {}
  for (const issue of issues) {
    if (!byKind[issue.kind]) byKind[issue.kind] = []
    byKind[issue.kind].push(issue)
  }

  console.log()
  console.log(`${ANSI_CYAN}${ANSI_BOLD}Breakdown by Issue Type${ANSI_RESET}`)
  console.log()
  for (const [kind, group] of Object.entries(byKind).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    logSummary(kind.replace(/_/g, ' '), `${group.length}`, 1)
  }

  const byField: Record<string, AuditIssue[]> = {}
  for (const issue of issues) {
    if (!byField[issue.field]) byField[issue.field] = []
    byField[issue.field].push(issue)
  }

  console.log()
  console.log(`${ANSI_CYAN}${ANSI_BOLD}Breakdown by Field${ANSI_RESET}`)
  console.log()
  for (const [field, group] of Object.entries(byField).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    logSummary(field, `${group.length}`, 1)
  }

  console.log()
  console.log(`${ANSI_CYAN}${ANSI_BOLD}Explicit Issue List${ANSI_RESET}`)
  console.log()

  const grouped = new Map<string, AuditIssue[]>()
  for (const issue of issues) {
    const key = `${issue.resort} (${issue.country})`
    let group = grouped.get(key)
    if (!group) {
      group = []
      grouped.set(key, group)
    }
    group.push(issue)
  }

  for (const [resortKey, resortIssues] of grouped) {
    console.log(`  ${ANSI_BOLD}${resortKey}${ANSI_RESET}`)
    for (const issue of resortIssues) {
      console.log(
        `    ${ANSI_RED}\u2717${ANSI_RESET} ${ANSI_YELLOW}${issue.field}${ANSI_RESET}: ${issue.detail}`
      )
    }
    console.log()
  }
}

async function audit() {
  const adminTablesDb = initAppwrite()
  log('info', 'audit', 'Starting resort data quality audit')

  const resorts = await listAllEnrichedResorts(adminTablesDb)

  if (resorts.length === 0) {
    log('warn', 'audit', 'No enriched resorts found. Nothing to audit.')
    process.exit(0)
  }

  const allIssues: AuditIssue[] = []
  for (const resort of resorts) {
    allIssues.push(...auditResort(resort))
  }

  if (allIssues.length > 0) {
    log(
      'warn',
      'audit',
      `Found ${allIssues.length} issue(s) across ${new Set(allIssues.map((i) => i.resort)).size} resort(s)`
    )
  } else {
    log('success', 'audit', 'All resorts pass quality checks')
  }

  displayAuditResults(allIssues, resorts.length)
}

async function fixResort(
  resort: ResortRow,
  issues: AuditIssue[],
  model: string
): Promise<{
  patch: Record<string, unknown>
  coords: Coordinates | null
} | null> {
  const auditFields = [...new Set(issues.map((i) => i.field))] as AuditField[]
  const enrichFields = auditFieldsToEnrichFields(auditFields)
  const needsCoords =
    auditFields.includes('latitude') || auditFields.includes('longitude')

  log(
    'info',
    'fix',
    `Fixing "${resort.resortName}" - fields: ${auditFields.join(', ')}`,
    1
  )

  let coords: Coordinates | null = null
  if (needsCoords) {
    coords = await fetchCoordinates(resort.resortName, resort.country)
  }

  if (enrichFields.length === 0) {
    log('info', 'fix', 'Only coordinate fixes needed, skipping LLM', 1)
    const patch: Record<string, unknown> = {}
    if (coords) {
      patch.latitude = coords.latitude
      patch.longitude = coords.longitude
    }
    return { patch, coords }
  }

  const subsetSchema = buildSubsetZodSchema(enrichFields)
  const subsetJsonSchema = buildSubsetJsonSchema(enrichFields)
  const responseCodec = jsonCodec(subsetSchema)

  log('info', 'fix', 'Fetching source text from Exa...', 1)
  const [sourcedResults, broadResults] = await Promise.all([
    exa.search(EXA_SEARCH_QUERY(resort.resortName, resort.country), {
      type: 'auto',
      numResults: EXA_SOURCED_NUM_RESULTS,
      useAutoprompt: true,
      includeDomains: [...SOURCE_WEBSITES],
      contents: {
        text: { maxCharacters: EXA_MAX_CHARS },
        highlights: true,
      },
    }),
    exa.search(EXA_SEARCH_QUERY(resort.resortName, resort.country), {
      type: 'auto',
      numResults: EXA_BROAD_NUM_RESULTS,
      useAutoprompt: true,
      contents: {
        text: { maxCharacters: EXA_MAX_CHARS },
        highlights: true,
      },
    }),
  ])

  const seenUrls = new Set<string>()
  const allResults = [...sourcedResults.results, ...broadResults.results]
  const dedupedResults = allResults.filter((r) => {
    if (seenUrls.has(r.url)) return false
    seenUrls.add(r.url)
    return true
  })

  const sourcedHosts = new Set(
    sourcedResults.results.map((r) => new URL(r.url).hostname)
  )

  log(
    'info',
    'fix',
    `Sourced: ${sourcedResults.results.length}, Broad: ${broadResults.results.length}, Deduped: ${dedupedResults.length}`,
    1
  )

  const sourceText = dedupedResults
    .filter((r) => r.text)
    .map((r) => {
      const tag = sourcedHosts.has(new URL(r.url).hostname)
        ? 'Authoritative source'
        : 'General source'
      const parts = [`## ${r.title ?? 'Untitled'} (${tag})\nURL: ${r.url}`]
      if (r.highlights?.length) {
        parts.push(`### Key facts\n${r.highlights.join('\n')}`)
      }
      parts.push(r.text!)
      return parts.join('\n')
    })
    .join('\n\n')

  if (!sourceText) {
    log('error', 'fix', 'No source text found', 1)
    return null
  }

  log(
    'success',
    'fix',
    `Got ${sourceText.length} chars of source text from ${dedupedResults.length} results`,
    1
  )

  const systemPrompt = LLM_SYSTEM_PROMPT.replace(
    '{SCHEMA}',
    JSON.stringify(subsetJsonSchema, null, 2)
  )
  const focusList = enrichFields.join(', ')
  const userPrompt = `Extract ONLY the following fields for "${resort.resortName}" in ${resort.country} from the source text below: ${focusList}.\n\nDo NOT include any fields other than ${focusList}.\n\n${sourceText}`

  log('info', 'fix', `Streaming LLM extraction for fields: ${focusList}...`, 1)
  const stream = await ollama.chat({
    stream: true,
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  let content = ''
  let thinking = ''
  let isThinking = true
  for await (const chunk of stream) {
    const thinkPart = (chunk.message as unknown as Record<string, unknown>)
      .thinking
    if (typeof thinkPart === 'string' && thinkPart) {
      thinking += thinkPart
      process.stdout.write(`${ANSI_DIM}${thinkPart}${ANSI_RESET}`)
    }
    if (chunk.message.content) {
      if (isThinking) {
        isThinking = false
        console.log()
        log('info', 'fix', `Model thought for ${thinking.length} chars`, 1)
      }
      content += chunk.message.content
      process.stdout.write(chunk.message.content)
    }
  }
  console.log()

  if (!content) {
    log('error', 'fix', 'LLM returned empty content after thinking', 1)
    return null
  }
  log('info', 'fix', `LLM response received (${content.length} chars)`, 1)

  const result = responseCodec.decode(content, { reportInput: true })
  if (!result) {
    log(
      'error',
      'fix',
      `Failed to parse LLM response: ${content.slice(0, 300)}`,
      1
    )
    return null
  }

  const parsed = result as Record<string, unknown>
  log(
    'success',
    'fix',
    `Successfully extracted fields for "${resort.resortName}"`,
    1
  )

  const patch: Record<string, unknown> = {}
  for (const field of enrichFields) {
    if (field in parsed) {
      patch[field] = parsed[field]
    }
  }
  if (needsCoords && coords) {
    patch.latitude = coords.latitude
    patch.longitude = coords.longitude
  }

  return { patch, coords }
}

async function writePatchedResort(
  adminTablesDb: TablesDB,
  resortId: string,
  patch: Record<string, unknown>
): Promise<void> {
  log('info', 'appwrite', `Patching resort ${resortId}...`, 1)

  if ('websites' in patch && Array.isArray(patch.websites)) {
    patch.websites = JSON.stringify(patch.websites)
  }

  await adminTablesDb.updateRow({
    databaseId: DATABASE_ID,
    tableId: RESORTS_TABLE_ID,
    rowId: resortId,
    data: patch,
  })
  log(
    'success',
    'appwrite',
    `Patched fields [${Object.keys(patch).join(', ')}] for resort ${resortId}`,
    1
  )
}

async function fix(options: { model?: string }) {
  const model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL
  const adminTablesDb = initAppwrite()
  log('info', 'fix', 'Starting resort data quality fix')

  const resorts = await listAllEnrichedResorts(adminTablesDb)

  if (resorts.length === 0) {
    log('warn', 'fix', 'No enriched resorts found. Nothing to fix.')
    process.exit(0)
  }

  const resortMap = new Map(resorts.map((r) => [r.$id, r]))
  const allIssues: AuditIssue[] = []
  for (const resort of resorts) {
    allIssues.push(...auditResort(resort))
  }

  if (allIssues.length === 0) {
    log('success', 'fix', 'All resorts pass quality checks. Nothing to fix.')
    return
  }

  const issuesByResort = new Map<string, AuditIssue[]>()
  for (const issue of allIssues) {
    const resort = resorts.find(
      (r) => r.resortName === issue.resort && r.country === issue.country
    )
    if (!resort) continue
    let list = issuesByResort.get(resort.$id)
    if (!list) {
      list = []
      issuesByResort.set(resort.$id, list)
    }
    list.push(issue)
  }

  log(
    'info',
    'fix',
    `Fixing issues in ${issuesByResort.size} resort(s) out of ${resorts.length} total`
  )

  let fixed = 0
  let failed = 0

  let idx = 0
  for (const [resortId, issues] of issuesByResort) {
    idx++
    const resort = resortMap.get(resortId)!
    log(
      'info',
      'fix',
      `[${idx}/${issuesByResort.size}] Fixing ${resort.resortName} (${resort.country}) - ${issues.length} issue(s)`
    )

    const result = await fixResort(resort, issues, model)
    if (!result) {
      log('warn', 'fix', `Failed to fix ${resort.resortName}, skipping.`, 1)
      failed++
      continue
    }

    if (Object.keys(result.patch).length > 0) {
      log('info', 'fix', `Patch: ${JSON.stringify(result.patch)}`, 2)
      await writePatchedResort(adminTablesDb, resortId, result.patch)
      fixed++
    } else {
      log('warn', 'fix', `No fields to patch for ${resort.resortName}`, 1)
    }
  }

  log(
    'success',
    'fix',
    `Done. Fixed: ${fixed}, Failed: ${failed}, Total issues: ${issuesByResort.size}`
  )
}

function displayEnrichedData(
  resort: UnenrichedResort,
  data: EnrichData,
  coords: Coordinates | null
) {
  console.log()
  const location = resort.region
    ? `${resort.country}, ${resort.region}`
    : resort.country
  console.log(
    `  ${ANSI_BOLD}${resort.resortName}${ANSI_RESET} ${ANSI_DIM}(${location})${ANSI_RESET}`
  )
  console.log()
  logEnrichData(data, coords, 2)
}

async function confirmEnrichedData(
  resort: UnenrichedResort,
  data: EnrichData,
  coords: Coordinates | null,
  autoAccept: boolean
): Promise<{
  accepted: boolean
  data: EnrichData
  coords: Coordinates | null
  autoAcceptRest: boolean
}> {
  if (autoAccept) {
    return { accepted: true, data, coords, autoAcceptRest: true }
  }

  displayEnrichedData(resort, data, coords)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question('\n  Accept? (y/modify/auto/skip/quit): ')
    const trimmed = answer.trim().toLowerCase()

    if (trimmed === 'y' || trimmed === '') {
      return { accepted: true, data, coords, autoAcceptRest: false }
    }

    if (trimmed === 'auto') {
      log('info', 'enrich', 'Auto-accepting all remaining resorts.', 1)
      return { accepted: true, data, coords, autoAcceptRest: true }
    }

    if (trimmed === 'skip') {
      return { accepted: false, data, coords, autoAcceptRest: false }
    }

    if (trimmed === 'quit') {
      log('warn', 'enrich', 'Stopping enrichment.', 1)
      return { accepted: false, data, coords, autoAcceptRest: false }
    }

    if (trimmed === 'modify') {
      console.log(
        '  Current values (edit in JSON format, or press Enter to keep):'
      )
      const fieldNames = Object.keys(data) as (keyof EnrichData)[]
      const modified = { ...data }

      for (const field of fieldNames) {
        const currentVal =
          typeof data[field] === 'string' ? data[field] : String(data[field])
        const newVal = await rl.question(`    ${field} [${currentVal}]: `)
        if (newVal.trim()) {
          const coerced = enrichSchema.shape[field]
          const parsed = coerced.safeParse(newVal.trim())
          if (parsed.success) {
            ;(modified[field] as typeof parsed.data) = parsed.data
          } else {
            log(
              'warn',
              'enrich',
              `Invalid value for ${field}, keeping original.`,
              3
            )
          }
        }
      }

      return { accepted: true, data: modified, coords, autoAcceptRest: false }
    }

    return { accepted: true, data, coords, autoAcceptRest: false }
  } finally {
    rl.close()
  }
}

async function writeEnrichedResort(
  adminTablesDb: TablesDB,
  resortId: string,
  data: EnrichData,
  coords: Coordinates | null
): Promise<void> {
  log(
    'info',
    'appwrite',
    `Writing enriched data for resort ${resortId} to database...`,
    1
  )
  await adminTablesDb.updateRow({
    databaseId: DATABASE_ID,
    tableId: RESORTS_TABLE_ID,
    rowId: resortId,
    data: {
      description: data.description,
      latitude: coords?.latitude ?? '',
      longitude: coords?.longitude ?? '',
      summitAltitude: data.summitAltitude,
      baseAltitude: data.baseAltitude,
      nearestAirport: data.nearestAirport,
      transferTime: data.transferTime,
      pisteKm: data.pisteKm,
      beginnerPct: data.beginnerPct,
      intermediatePct: data.intermediatePct,
      advancedPct: data.advancedPct,
      liftCount: data.liftCount,
      snowReliability: data.snowReliability,
      skiSeasonMonths: data.skiSeasonMonths,
      websites: JSON.stringify(data.websites),
      linkedResortsDescription: data.linkedResortsDescription,
      enriched: true,
    },
  })
  log('success', 'appwrite', `Wrote enriched data for resort ${resortId}`, 1)
}

async function enrich(options: {
  model?: string
  resort?: string
  region?: string
  country?: string
  output?: string
}) {
  const model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL

  if (options.resort) {
    if (!options.region && !options.country) {
      log(
        'error',
        'enrich',
        '--region or --country is required when using --resort'
      )
      process.exit(1)
    }

    const resortName = options.resort
    const country = options.country ?? options.region!
    log(
      'info',
      'enrich',
      `Mode: ${ANSI_BOLD}standalone${ANSI_RESET} (no Appwrite database)`
    )
    log(
      'info',
      'enrich',
      `Resort: "${resortName}", Country: "${country}"${options.region ? `, Region: "${options.region}"` : ''}`
    )
    log('info', 'enrich', `Model: ${model}`)

    const result = await enrichResort(resortName, country, model)
    if (!result) {
      log('error', 'enrich', `Failed to enrich "${resortName}".`)
      process.exit(1)
    }

    if (options.output) {
      const outputData = {
        resortName,
        country,
        region: options.region,
        latitude: result.coords?.latitude ?? '',
        longitude: result.coords?.longitude ?? '',
        ...result.data,
      }
      log('info', 'enrich', `Writing enriched JSON to ${options.output}`)
      await Bun.write(options.output, JSON.stringify(outputData, null, 2))
      log(
        'success',
        'enrich',
        `Written ${JSON.stringify(outputData).length} bytes to ${options.output}`
      )
    } else {
      displayEnrichedData(
        { $id: '', resortName, country, region: options.region ?? '' },
        result.data,
        result.coords
      )
    }

    log('success', 'enrich', 'Done.')
    return
  }

  const adminTablesDb = initAppwrite()
  log('info', 'enrich', `Mode: ${ANSI_BOLD}database${ANSI_RESET} (Appwrite)`)
  log('info', 'enrich', `Database: ${DATABASE_ID}, Table: ${RESORTS_TABLE_ID}`)
  log('info', 'enrich', `Model: ${model}`)

  const resorts = await listUnenrichedResorts(adminTablesDb)

  if (resorts.length === 0) {
    log('warn', 'enrich', 'No un-enriched resorts found. Nothing to do.')
    process.exit(0)
  }

  log(
    'info',
    'enrich',
    `Found ${resorts.length} un-enriched resort(s): ${resorts.map((r) => `${r.resortName} (${r.country})`).join(', ')}`
  )

  let enriched = 0
  let skipped = 0
  let autoAccept = false
  let stopRequested = false

  for (let i = 0; i < resorts.length; i++) {
    if (stopRequested) {
      log(
        'warn',
        'enrich',
        `Stopped. Skipped ${resorts.length - i} remaining resort(s).`
      )
      break
    }

    const resort = resorts[i]
    log(
      'info',
      'enrich',
      `[${i + 1}/${resorts.length}] Enriching ${resort.resortName} (${resort.country})...`
    )

    const result = await enrichResort(resort.resortName, resort.country, model)
    if (!result) {
      log(
        'warn',
        'enrich',
        `Failed to enrich ${resort.resortName}, skipping.`,
        1
      )
      skipped++
      continue
    }

    const confirmed = await confirmEnrichedData(
      resort,
      result.data,
      result.coords,
      autoAccept
    )
    autoAccept = confirmed.autoAcceptRest

    if (confirmed.accepted) {
      await writeEnrichedResort(
        adminTablesDb,
        resort.$id,
        confirmed.data,
        confirmed.coords
      )
      enriched++
      log('success', 'enrich', 'Written to database (enriched: true).', 1)
    } else {
      if (confirmed.data === result.data && !autoAccept) {
        stopRequested = true
      }
      skipped++
      log('warn', 'enrich', `Skipped ${resort.resortName}.`, 1)
    }
  }

  log(
    'success',
    'enrich',
    `Done. Enriched: ${enriched}, Skipped: ${skipped}, Total: ${resorts.length}`
  )
}

const program = new Command()

program
  .name('enrich-resorts')
  .description('Enrich un-enriched ski resorts with detailed data using LLM')
  .version('1.0.0')
  .option(
    '--model <model>',
    'LLM model to use (default: kimi-k2.6:cloud or OLLAMA_MODEL env var)'
  )
  .option(
    '--resort <name>',
    'Resort name for standalone mode (skips Appwrite database)'
  )
  .option(
    '--region <region>',
    'Region for standalone mode (used as country if --country not set)'
  )
  .option(
    '--country <country>',
    'Country for standalone mode (overrides --region as country)'
  )
  .option(
    '--output <path>',
    'Write enriched JSON to a file instead of stdout (standalone mode only)'
  )
  .option(
    '--audit',
    'Audit enriched resorts for missing/zero fields and low quality data'
  )
  .option(
    '--fix',
    'Fix audited issues by re-enriching only the problematic fields'
  )
  .action((options) => {
    if (options.audit) {
      audit()
    } else if (options.fix) {
      fix(options)
    } else {
      enrich(options)
    }
  })

program.parse()
