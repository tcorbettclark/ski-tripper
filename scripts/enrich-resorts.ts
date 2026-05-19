#!/usr/bin/env bun

import * as readline from 'node:readline/promises'
import { Command } from 'commander'
import Exa from 'exa-js'
import {
  Client as NodeClient,
  TablesDB as NodeTablesDB,
  Query,
} from 'node-appwrite'
import { Ollama } from 'ollama'
import * as z from 'zod'
import type { JSONSchema } from 'zod/v4/core'

const DATABASE_ID = process.env.PUBLIC_APPWRITE_DATABASE_ID as string
const RESORTS_TABLE_ID = process.env.PUBLIC_APPWRITE_RESORTS_TABLE_ID as string
const DEFAULT_MODEL = 'kimi-k2.6:cloud'

const adminClient = new NodeClient()
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT as string)
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID as string)
  .setKey(process.env.APPWRITE_DATABASE_API_KEY as string)

const adminTablesDb = new NodeTablesDB(adminClient)

const ollama = new Ollama({
  host: 'https://ollama.com',
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
  console.log(`[executeWebSearch] Searching for: "${query}"`)
  const results = await exa.search(query, {
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
      if (r.text) parts.push(r.text)
      if (r.highlights) parts.push(r.highlights.join(' ... '))
      return parts.join('\n')
    })

  console.log(
    `[executeWebSearch] Got ${results.results.length} result(s) for: "${query}"`
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
  websiteUrl: z.string().describe('Official resort website URL'),
})

type EnrichData = z.infer<typeof enrichSchema>

function jsonCodec<T extends z.core.$ZodType>(schema: T) {
  return z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      try {
        return JSON.parse(jsonString)
      } catch (err) {
        if (err instanceof SyntaxError) {
          ctx.issues.push({
            code: 'invalid_format',
            format: 'json',
            input: jsonString,
            message: err.message,
          })
          return z.NEVER
        }
        throw err
      }
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
        description: 'Official resort website URL',
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
- websiteUrl: official resort website URL

Be accurate and specific. Use real data. Search the web if you are not certain about any facts.

Do not include any additional text or explanations. Return valid JSON only.`

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `  [enrichResort] Attempt ${attempt}/${maxRetries} for "${resortName}"`
      )
      const messages: Array<{
        role: 'system' | 'user' | 'assistant' | 'tool'
        content: string
        tool_name?: string
      }> = [
        {
          role: 'system',
          content: `You are a ski resort expert. Return results as raw JSON matching this schema: ${JSON.stringify(jsonSchema)}. Be accurate about resort statistics. Use real, factual data. Use the web_search tool to look up any information you are not completely certain about.`,
        },
        { role: 'user', content: prompt },
      ]

      let finalContent = ''

      for (let round = 0; round < 5; round++) {
        console.log(`  [enrichResort] LLM round ${round + 1}/5`)
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
          console.log(
            `  [enrichResort] LLM requested ${response.message.tool_calls.length} tool call(s)`
          )
          messages.push({
            role: 'assistant',
            content: response.message.content ?? '',
          })

          for (const toolCall of response.message.tool_calls) {
            const fnName = toolCall.function.name
            const fnArgs = toolCall.function.arguments as { query?: string }

            if (fnName === 'web_search' && fnArgs.query) {
              console.log(`  [enrichResort] [web_search] ${fnArgs.query}`)
              const searchResult = await executeWebSearch(fnArgs.query)
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
        console.log(
          `  [enrichResort] LLM returned final response (${finalContent.length} chars)`
        )
        break
      }

      if (!finalContent) {
        console.error(
          `  [enrichResort] No final content received after tool call rounds`
        )
        throw new Error('LLM returned empty response after tool calls')
      }

      console.log(
        `  [enrichResort] Parsing enriched data for "${resortName}"...`
      )
      const result = responseCodec.decode(finalContent, {
        reportInput: true,
      })

      if (!result) {
        console.error(
          `  [enrichResort] Failed to parse enriched data, raw response: ${finalContent.slice(0, 300)}`
        )
        throw new Error('LLM returned empty or invalid response')
      }

      console.log(
        `  [enrichResort] Successfully parsed enriched data for "${resortName}"`
      )
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(
        `  [enrichResort] Attempt ${attempt}/${maxRetries} failed: ${message}`
      )
      if (attempt === maxRetries) {
        console.error(
          `  [enrichResort] Max retries reached for "${resortName}", skipping.`
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

async function listUnenrichedResorts(): Promise<UnenrichedResort[]> {
  console.log(
    '[listUnenrichedResorts] Fetching un-enriched resorts from database...'
  )
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
    console.log(
      `[listUnenrichedResorts] Fetched ${rows.length} rows (total so far: ${resorts.length})`
    )
    if (rows.length < limit) break
    offset += limit
  }
  console.log(
    `[listUnenrichedResorts] Total un-enriched resorts: ${resorts.length}`
  )
  return resorts
}

function displayEnrichedData(resort: UnenrichedResort, data: EnrichData) {
  console.log(`\n  ${resort.resortName} (${resort.country}, ${resort.region})`)
  console.log(`  Description:    ${data.description.slice(0, 100)}...`)
  console.log(`  Coordinates:    ${data.latitude}, ${data.longitude}`)
  console.log(
    `  Altitude:       ${data.bottomAltitude}m - ${data.topAltitude}m`
  )
  console.log(`  Nearest airport:${data.nearestAirport} (${data.transferTime})`)
  console.log(`  Piste:          ${data.pisteKm} km`)
  console.log(`  Difficulty:     ${data.difficulty}`)
  console.log(`  Lifts:          ${data.liftCount}`)
  console.log(`  Snow:           ${data.snowReliability}`)
  console.log(`  Season:         ${data.skiSeasonMonths}`)
  console.log(`  Website:        ${data.websiteUrl}`)
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
      console.log('  Auto-accepting all remaining resorts.')
      return { accepted: true, data, autoAcceptRest: true }
    }

    if (trimmed === 'skip') {
      return { accepted: false, data, autoAcceptRest: false }
    }

    if (trimmed === 'quit') {
      console.log('  Stopping enrichment.')
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
            console.log(`      Invalid value, keeping original.`)
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
  resortId: string,
  data: EnrichData
): Promise<void> {
  console.log(
    `  [writeEnrichedResort] Writing enriched data for resort ${resortId}...`
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
  console.log(
    `  [writeEnrichedResort] Successfully wrote enriched data for resort ${resortId}`
  )
}

async function enrich(options: { model?: string }) {
  const model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL

  console.log('[enrich] Fetching un-enriched resorts from database...')
  const resorts = await listUnenrichedResorts()

  if (resorts.length === 0) {
    console.log('[enrich] No un-enriched resorts found. Nothing to do.')
    process.exit(0)
  }

  console.log(`[enrich] Found ${resorts.length} un-enriched resort(s).`)
  console.log(`[enrich] Using model: ${model}\n`)

  let enriched = 0
  let skipped = 0
  let autoAccept = false
  let stopRequested = false

  for (let i = 0; i < resorts.length; i++) {
    if (stopRequested) {
      console.log(
        `\n[enrich] Stopped. Skipped ${resorts.length - i} remaining resort(s).`
      )
      break
    }

    const resort = resorts[i]
    console.log(
      `\n[enrich] [${i + 1}/${resorts.length}] Enriching ${resort.resortName} (${resort.country})...`
    )

    const data = await enrichResort(resort.resortName, resort.country, model)
    if (!data) {
      console.log(`  [enrich] Failed to enrich ${resort.resortName}, skipping.`)
      skipped++
      continue
    }

    const result = await confirmEnrichedData(resort, data, autoAccept)
    autoAccept = result.autoAcceptRest

    if (result.accepted) {
      await writeEnrichedResort(resort.$id, result.data)
      enriched++
      console.log(`  [enrich] Written to database (enriched: true).`)
    } else {
      if (result.data === data && !autoAccept) {
        stopRequested = true
      }
      skipped++
      console.log(`  [enrich] Skipped ${resort.resortName}.`)
    }
  }

  console.log(
    `\n[enrich] Done. Enriched: ${enriched}, Skipped: ${skipped}, Total: ${resorts.length}`
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
  .action(enrich)

program.parse()
