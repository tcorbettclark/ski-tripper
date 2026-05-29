#!/usr/bin/env bun

import * as readline from 'node:readline/promises'
import { aiJsonSafeParse } from 'ai-json-safe-parse'
import { Command } from 'commander'
import type { SearchResponse } from 'exa-js'
import Exa from 'exa-js'
import { Client, Query, TablesDB } from 'node-appwrite'
import { Ollama } from 'ollama'
import * as z from 'zod'
import type { JSONSchema } from 'zod/v4/core'

const OLLAMA_HOST = 'https://ollama.com'
const DATABASE_ID = process.env.PUBLIC_APPWRITE_DATABASE_ID as string
const RESORTS_TABLE_ID = process.env.PUBLIC_APPWRITE_RESORTS_TABLE_ID as string
const DEFAULT_MODEL = 'kimi-k2.6:cloud'

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

const webSearchTool = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description:
      'Search the web for factual information about a ski resort. Use this to look up accurate statistics, coordinates, airport codes, transfer times, piste lengths, lift counts, snow reliability, season dates, and official website URLs.',
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

async function executeWebSearch(query: string): Promise<string> {
  log('info', 'search', `Querying Exa for: "${query}"`)
  const results: SearchResponse<{
    text: { maxCharacters: 3000 }
    highlights: { maxCharacters: 500 }
  }> = await exa.search(query, {
    type: 'auto',
    numResults: 3,
    contents: {
      text: { maxCharacters: 3000 },
      highlights: { maxCharacters: 500 },
    },
  })

  const snippets = results.results
    .filter((r) => r.text || r.highlights)
    .map((r) => {
      const parts: string[] = []
      if (r.title) parts.push(`Title: ${r.title}`)
      if (r.url) parts.push(`URL: ${r.url}`)
      if (r.text) parts.push(r.text)
      if (r.highlights) parts.push(r.highlights.join(' ... '))
      return parts.join('\n')
    })

  for (const r of results.results) {
    log(
      'info',
      'search',
      `"${r.title ?? '(no title)'}" - ${r.url ?? '(no url)'}`,
      1
    )
  }
  log(
    'success',
    'search',
    `${results.results.length} result(s) for: "${query}"`
  )
  return snippets.join('\n\n---\n\n')
}

const enrichSchema = z.object({
  description: z
    .string()
    .describe(
      'A few paragraphs describing the ski resort, its terrain, atmosphere, and highlights'
    ),
  latitude: z.string().describe('Latitude as a string, e.g. "46.0939"'),
  longitude: z.string().describe('Longitude as a string, e.g. "7.0765"'),
  topAltitude: z.coerce
    .number()
    .int()
    .describe('Top altitude in metres above sea level'),
  bottomAltitude: z.coerce
    .number()
    .int()
    .describe('Bottom altitude in metres above sea level'),
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
  difficulty: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .describe('Overall difficulty rating of the resort'),
  liftCount: z.coerce.number().int().describe('Number of ski lifts'),
  snowReliability: z
    .enum(['high', 'medium', 'low'])
    .describe('Snow reliability rating'),
  skiSeasonMonths: z.string().describe('Typical ski season, e.g. "Dec-Apr"'),
  websiteUrl: z
    .string()
    .describe(
      'URL of the resort\'s official website for ski season visits, e.g. "https://www.zermatt.ch/en/skiing"'
    ),
})

type EnrichData = z.infer<typeof enrichSchema>

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
  const fieldDescriptions: Record<string, string> = {}
  for (const [key, value] of Object.entries(enrichSchema.shape)) {
    const desc = (value as { description?: string }).description
    if (desc) fieldDescriptions[key] = desc
  }

  return {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description:
          'A few paragraphs describing the ski resort, its terrain, atmosphere, and highlights',
      },
      latitude: {
        type: 'string',
        description: 'Latitude as a string, e.g. "46.0939"',
      },
      longitude: {
        type: 'string',
        description: 'Longitude as a string, e.g. "7.0765"',
      },
      topAltitude: {
        type: 'integer',
        description: 'Top altitude in metres above sea level',
      },
      bottomAltitude: {
        type: 'integer',
        description: 'Bottom altitude in metres above sea level',
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
      difficulty: {
        type: 'string',
        enum: ['beginner', 'intermediate', 'advanced'],
        description: 'Overall difficulty rating of the resort',
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
      websiteUrl: {
        type: 'string',
        description:
          'URL of the most informative website for ski season visits, e.g. "https://www.zermatt.ch/en/skiing"',
      },
    },
    required: [
      'description',
      'latitude',
      'longitude',
      'topAltitude',
      'bottomAltitude',
      'nearestAirport',
      'transferTime',
      'pisteKm',
      'difficulty',
      'liftCount',
      'snowReliability',
      'skiSeasonMonths',
      'websiteUrl',
    ],
  }
}

function logEnrichData(data: EnrichData, indent = 0) {
  logSummary('Coordinates', `${data.latitude}, ${data.longitude}`, indent)
  logSummary(
    'Altitude',
    `${data.bottomAltitude}m - ${data.topAltitude}m`,
    indent
  )
  logSummary('Airport', `${data.nearestAirport} (${data.transferTime})`, indent)
  logSummary('Piste', `${data.pisteKm} km`, indent)
  logSummary('Lifts', `${data.liftCount}`, indent)
  logSummary('Difficulty', data.difficulty, indent)
  logSummary('Snow', data.snowReliability, indent)
  logSummary('Season', data.skiSeasonMonths, indent)
  logSummary('Website', data.websiteUrl, indent)
  logSummary('Description', data.description, indent)
}

async function enrichResort(
  resortName: string,
  country: string,
  model: string,
  maxRetries = 3
): Promise<EnrichData | null> {
  const responseCodec = jsonCodec(enrichSchema)
  const jsonSchema = buildJsonSchema()

  const prompt = `Provide detailed information about the ski resort "${resortName}" in ${country}. Return a JSON object with these fields:
- description: a few paragraphs about the resort's terrain, atmosphere, and highlights
- latitude: as a string (e.g. "46.0939")
- longitude: as a string (e.g. "7.0765")
- topAltitude: top altitude in metres (integer)
- bottomAltitude: bottom altitude in metres (integer)
- nearestAirport: IATA code of the nearest airport
- transferTime: transfer time from airport (e.g. "2h 00m")
- pisteKm: total groomed piste length in km (integer)
- difficulty: one of "beginner", "intermediate", "advanced"
- liftCount: number of lifts (integer)
- snowReliability: one of "high", "medium", "low"
- skiSeasonMonths: typical season (e.g. "Dec-Apr")
- websiteUrl: URL of the resort's official website for ski season visits

Be accurate and specific. Use real data. Search the web if you are not certain about any facts.

Do not include any additional text or explanations. Return valid JSON only.`

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(
        'info',
        'enrich',
        `Attempt ${attempt}/${maxRetries} for "${resortName}" (model: ${model})`
      )
      const messages: Array<{
        role: 'system' | 'user' | 'assistant' | 'tool'
        content: string
        tool_name?: string
      }> = [
        {
          role: 'system',
          content: `You are a ski resort expert. Return results as raw JSON without any introductory text. Match this schema: ${JSON.stringify(jsonSchema)}. Be accurate about resort statistics. Use real, factual data. Use the web_search tool to look up any information you are not completely certain about.`,
        },
        { role: 'user', content: prompt },
      ]

      let finalContent = ''

      for (let round = 0; round < 5; round++) {
        log(
          'info',
          'enrich',
          `LLM round ${round + 1}/5 (messages: ${messages.length})`,
          1
        )
        const response = await ollama.chat({
          stream: false as const,
          model,
          messages,
          tools: [webSearchTool],
        })

        if (
          response.message.tool_calls &&
          response.message.tool_calls.length > 0
        ) {
          const toolNames = response.message.tool_calls
            .map((tc) => tc.function.name)
            .join(', ')
          log(
            'info',
            'enrich',
            `LLM requested ${response.message.tool_calls.length} tool call(s): ${toolNames}`,
            1
          )
          messages.push({
            role: 'assistant',
            content: response.message.content ?? '',
          })

          for (const toolCall of response.message.tool_calls) {
            const fnName = toolCall.function.name
            const fnArgs = toolCall.function.arguments as { query?: string }

            if (fnName === 'web_search' && fnArgs.query) {
              log(
                'info',
                'enrich',
                `Executing web_search: "${fnArgs.query}"`,
                2
              )
              const searchResult = await executeWebSearch(fnArgs.query)
              log(
                'success',
                'enrich',
                `web_search returned ${searchResult.length} chars`,
                2
              )
              messages.push({
                role: 'tool',
                content: searchResult,
                tool_name: fnName,
              })
            }
          }

          continue
        }

        finalContent = response.message.content
        log(
          'success',
          'enrich',
          `LLM returned final response (${finalContent.length} chars)`,
          1
        )
        break
      }

      if (!finalContent) {
        log(
          'error',
          'enrich',
          'No final content received after tool call rounds',
          1
        )
        throw new Error('LLM returned empty response after tool calls')
      }

      log(
        'info',
        'enrich',
        `Parsing JSON response (${finalContent.length} chars)...`,
        1
      )
      const result = responseCodec.decode(finalContent, {
        reportInput: true,
      })

      if (!result) {
        log(
          'error',
          'enrich',
          `Failed to parse JSON, raw response: ${finalContent.slice(0, 300)}`,
          1
        )
        throw new Error('LLM returned empty or invalid response')
      }

      log(
        'success',
        'enrich',
        `Successfully parsed enriched data for "${resortName}"`,
        1
      )
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log(
        'error',
        'enrich',
        `Attempt ${attempt}/${maxRetries} failed: ${message}`,
        1
      )
      if (attempt === maxRetries) {
        log(
          'error',
          'enrich',
          `Max retries reached for "${resortName}", skipping.`,
          1
        )
        return null
      }
    }
  }

  return null
}

async function enrichResortViaExa(
  resortName: string,
  country: string,
  model: string,
  maxRetries = 3
): Promise<EnrichData | null> {
  const responseCodec = jsonCodec(enrichSchema)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(
        'info',
        'enrich-exa-llm',
        `Attempt ${attempt}/${maxRetries} for "${resortName}" via Exa+LLM`
      )

      log('info', 'enrich-exa-llm', 'Fetching source text from Exa...', 1)
      const results: SearchResponse<{ text: { maxCharacters: 5000 } }> =
        await exa.search(
          `"${resortName}" ${country} ski resort statistics altitude piste lifts airport`,
          {
            type: 'auto',
            numResults: 5,
            contents: { text: { maxCharacters: 5000 } },
          }
        )

      const sourceText = results.results
        .filter((r) => r.text)
        .map((r) => `## ${r.title ?? 'Untitled'}\n${r.text}`)
        .join('\n\n')

      if (!sourceText) {
        log('error', 'enrich-exa-llm', 'No source text found', 1)
        throw new Error('No source text found from Exa')
      }

      log(
        'success',
        'enrich-exa-llm',
        `Got ${sourceText.length} chars of source text from ${results.results.length} results`,
        1
      )

      const systemPrompt = `You are a ski resort data extractor. Given source text from web searches, extract factual data about the ski resort into a JSON object matching this schema:

${JSON.stringify(buildJsonSchema(), null, 2)}

Rules:
- Extract only information that is explicitly stated in the source text
- If a value is not found in the text, use reasonable defaults but never make up specific numbers
- For altitude, the topAltitude must be HIGHER than the bottomAltitude
- Return valid JSON only, no explanatory text`

      const userPrompt = `Extract ski resort data for "${resortName}" in ${country} from the following source text:

${sourceText}`

      log('info', 'enrich-exa-llm', 'Streaming LLM extraction...', 1)
      const stream = await ollama.chat({
        stream: true,
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      })
      log('info', 'enrich-exa-llm', 'Stream created, reading chunks...', 1)

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
            log(
              'info',
              'enrich-exa-llm',
              `Model thought for ${thinking.length} chars`,
              1
            )
          }
          content += chunk.message.content
          process.stdout.write(chunk.message.content)
        }
      }
      console.log()
      if (!content) {
        log(
          'error',
          'enrich-exa-llm',
          'LLM returned empty content after thinking',
          1
        )
        throw new Error('LLM returned empty content')
      }
      log(
        'info',
        'enrich-exa-llm',
        `LLM response received (${content.length} chars)`,
        1
      )

      const result = responseCodec.decode(content, { reportInput: true })
      if (!result) {
        log(
          'error',
          'enrich-exa-llm',
          `Failed to parse LLM response: ${content.slice(0, 300)}`,
          1
        )
        throw new Error('Failed to parse LLM response as valid enrichment data')
      }

      log(
        'success',
        'enrich-exa-llm',
        `Successfully enriched "${resortName}" via Exa+LLM`,
        1
      )
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log(
        'error',
        'enrich-exa-llm',
        `Attempt ${attempt}/${maxRetries} failed: ${message}`,
        1
      )
      if (attempt === maxRetries) {
        log(
          'error',
          'enrich-exa-llm',
          `Max retries reached for "${resortName}", skipping.`,
          1
        )
        return null
      }
    }
  }

  return null
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

function displayEnrichedData(resort: UnenrichedResort, data: EnrichData) {
  console.log()
  const location = resort.region
    ? `${resort.country}, ${resort.region}`
    : resort.country
  console.log(
    `  ${ANSI_BOLD}${resort.resortName}${ANSI_RESET} ${ANSI_DIM}(${location})${ANSI_RESET}`
  )
  console.log()
  logEnrichData(data, 2)
}

async function confirmEnrichedData(
  resort: UnenrichedResort,
  data: EnrichData,
  autoAccept: boolean
): Promise<{ accepted: boolean; data: EnrichData; autoAcceptRest: boolean }> {
  if (autoAccept) {
    return { accepted: true, data, autoAcceptRest: true }
  }

  displayEnrichedData(resort, data)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question('\n  Accept? (y/modify/auto/skip/quit): ')
    const trimmed = answer.trim().toLowerCase()

    if (trimmed === 'y' || trimmed === '') {
      return { accepted: true, data, autoAcceptRest: false }
    }

    if (trimmed === 'auto') {
      log('info', 'enrich', 'Auto-accepting all remaining resorts.', 1)
      return { accepted: true, data, autoAcceptRest: true }
    }

    if (trimmed === 'skip') {
      return { accepted: false, data, autoAcceptRest: false }
    }

    if (trimmed === 'quit') {
      log('warn', 'enrich', 'Stopping enrichment.', 1)
      return { accepted: false, data, autoAcceptRest: false }
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

      return { accepted: true, data: modified, autoAcceptRest: false }
    }

    return { accepted: true, data, autoAcceptRest: false }
  } finally {
    rl.close()
  }
}

async function writeEnrichedResort(
  adminTablesDb: TablesDB,
  resortId: string,
  data: EnrichData
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
      latitude: data.latitude,
      longitude: data.longitude,
      topAltitude: data.topAltitude,
      bottomAltitude: data.bottomAltitude,
      nearestAirport: data.nearestAirport,
      transferTime: data.transferTime,
      pisteKm: data.pisteKm,
      difficulty: data.difficulty,
      liftCount: data.liftCount,
      snowReliability: data.snowReliability,
      skiSeasonMonths: data.skiSeasonMonths,
      websiteUrl: data.websiteUrl,
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
  exa?: boolean
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
    log(
      'info',
      'enrich',
      `Model: ${model}${options.exa ? ' (using Exa search + LLM)' : ''}`
    )

    const data = options.exa
      ? await enrichResortViaExa(resortName, country, model)
      : await enrichResort(resortName, country, model)
    if (!data) {
      log('error', 'enrich', `Failed to enrich "${resortName}".`)
      process.exit(1)
    }

    if (options.output) {
      const outputData = {
        resortName,
        country,
        region: options.region,
        ...data,
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
        data
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

    const data = options.exa
      ? await enrichResortViaExa(resort.resortName, resort.country, model)
      : await enrichResort(resort.resortName, resort.country, model)
    if (!data) {
      log(
        'warn',
        'enrich',
        `Failed to enrich ${resort.resortName}, skipping.`,
        1
      )
      skipped++
      continue
    }

    const result = await confirmEnrichedData(resort, data, autoAccept)
    autoAccept = result.autoAcceptRest

    if (result.accepted) {
      await writeEnrichedResort(adminTablesDb, resort.$id, result.data)
      enriched++
      log('success', 'enrich', 'Written to database (enriched: true).', 1)
    } else {
      if (result.data === data && !autoAccept) {
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
    '--exa',
    'Use Exa text search + LLM extraction instead of LLM with tool-calling'
  )
  .action(enrich)

program.parse()
