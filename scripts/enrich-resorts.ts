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
const EXA_NUM_RESULTS = 7
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
  `Official website and ski area information for ${resortName} ski resort in ${country}, including piste maps, lift status, altitude, and resort facilities`

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
- If a value is not found in the text, use reasonable defaults but never make up specific numbers
- For altitude, the summitAltitude must be HIGHER than the baseAltitude
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
    `${pad}${ANSI_DIM}${label.padEnd(16)}${ANSI_RESET} ${ANSI_BOLD}${value}${ANSI_RESET}`
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
  beginnerKm: z.coerce
    .number()
    .int()
    .describe('Length of beginner (blue) piste in kilometres'),
  intermediateKm: z.coerce
    .number()
    .int()
    .describe('Length of intermediate (red) piste in kilometres'),
  advancedKm: z.coerce
    .number()
    .int()
    .describe('Length of advanced (black) piste in kilometres'),
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

interface Coordinates {
  latitude: string
  longitude: string
}

async function fetchCoordinates(
  resortName: string,
  country: string,
  includeDomains?: readonly string[]
): Promise<Coordinates | null> {
  log('info', 'enrich', 'Fetching coordinates from Exa...', 1)
  try {
    const response = await exa.search(EXA_COORDS_QUERY(resortName, country), {
      type: 'deep-lite',
      numResults: 3,
      useAutoprompt: true,
      includeDomains: includeDomains ? [...includeDomains] : undefined,
      contents: { text: { maxCharacters: 2000 } },
      outputSchema: COORDS_SCHEMA,
    })

    const output = response.output?.content as
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
      includeDomains: includeDomains ? [...includeDomains] : undefined,
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
      beginnerKm: {
        type: 'integer',
        description: 'Length of beginner (blue) piste in kilometres',
      },
      intermediateKm: {
        type: 'integer',
        description: 'Length of intermediate (red) piste in kilometres',
      },
      advancedKm: {
        type: 'integer',
        description: 'Length of advanced (black) piste in kilometres',
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
      'beginnerKm',
      'intermediateKm',
      'advancedKm',
      'liftCount',
      'snowReliability',
      'skiSeasonMonths',
      'websites',
      'linkedResortsDescription',
    ],
  }
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
  logSummary('Beginner', `${data.beginnerKm} km`, indent)
  logSummary('Intermediate', `${data.intermediateKm} km`, indent)
  logSummary('Advanced', `${data.advancedKm} km`, indent)
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
  model: string,
  includeDomains?: readonly string[]
): Promise<{ data: EnrichData; coords: Coordinates | null } | null> {
  const responseCodec = jsonCodec(enrichSchema)

  log('info', 'enrich', `Enriching "${resortName}" via Exa+LLM`)

  const coords = await fetchCoordinates(resortName, country, includeDomains)

  log('info', 'enrich', 'Fetching source text from Exa...', 1)
  const results = await exa.search(EXA_SEARCH_QUERY(resortName, country), {
    type: 'auto',
    numResults: EXA_NUM_RESULTS,
    useAutoprompt: true,
    includeDomains: includeDomains ? [...includeDomains] : undefined,
    contents: {
      text: { maxCharacters: EXA_MAX_CHARS },
      highlights: true,
    },
  })

  if (includeDomains) {
    const domains = [
      ...new Set(results.results.map((r) => new URL(r.url).hostname)),
    ]
    log('info', 'enrich', `Domains used: ${domains.join(', ')}`, 1)
    for (const r of results.results) {
      log('info', 'enrich', `  ${r.url}`, 2)
    }
  }

  const sourceText = results.results
    .filter((r) => r.text)
    .map((r) => {
      const parts = [`## ${r.title ?? 'Untitled'}`]
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
    `Got ${sourceText.length} chars of source text from ${results.results.length} results`,
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
  log('info', 'enrich', 'Stream created, reading chunks...', 1)

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
  return { data: result, coords }
}

interface UnenrichedResort {
  $id: string
  resortName: string
  country: string
  region: string
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
      beginnerKm: data.beginnerKm,
      intermediateKm: data.intermediateKm,
      advancedKm: data.advancedKm,
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
  sources?: boolean
}) {
  const model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL
  const includeDomains = options.sources ? SOURCE_WEBSITES : undefined

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
    if (includeDomains) {
      log('info', 'enrich', `Sources: ${includeDomains.join(', ')}`)
    }

    const result = await enrichResort(
      resortName,
      country,
      model,
      includeDomains
    )
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
  if (includeDomains) {
    log('info', 'enrich', `Sources: ${includeDomains.join(', ')}`)
  }

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

    const result = await enrichResort(
      resort.resortName,
      resort.country,
      model,
      includeDomains
    )
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
    '--sources',
    'Restrict Exa searches to known ski info websites via includeDomains'
  )
  .action(enrich)

program.parse()
