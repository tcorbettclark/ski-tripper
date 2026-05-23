#!/usr/bin/env bun

import * as readline from 'node:readline/promises'
import { Command } from 'commander'
import Exa from 'exa-js'
import {
  ID,
  Client as NodeClient,
  TablesDB as NodeTablesDB,
  Query,
} from 'node-appwrite'
import { Ollama } from 'ollama'
import * as z from 'zod'
import type { JSONSchema } from 'zod/v4/core'
import { REGIONS } from '../src/regions'

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

const candidateSchema = z.object({
  resorts: z.array(
    z.object({
      resortName: z
        .string()
        .describe('The commonly known name of the ski resort'),
      country: z.string().describe('The country where the resort is located'),
    })
  ),
})

type Candidate = z.infer<typeof candidateSchema>['resorts'][number]

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

async function callLLM(
  prompt: string,
  model: string,
  maxRetries = 3
): Promise<Candidate[]> {
  console.log(`[callLLM] Calling model ${model} (max ${maxRetries} retries)...`)
  console.log(`[callLLM] Prompt: ${prompt.slice(0, 200)}...`)
  const responseCodec = jsonCodec(candidateSchema)
  const jsonSchema: JSONSchema.JSONSchema = {
    type: 'object',
    properties: {
      resorts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            resortName: {
              type: 'string',
              description: 'The commonly known name of the ski resort',
            },
            country: {
              type: 'string',
              description: 'The country where the resort is located',
            },
          },
          required: ['resortName', 'country'],
        },
      },
    },
    required: ['resorts'],
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[callLLM] Attempt ${attempt}/${maxRetries}`)
      const messages: Array<{
        role: 'system' | 'user' | 'assistant' | 'tool'
        content: string
        tool_name?: string
      }> = [
        {
          role: 'system',
          content: `You are a ski resort expert. Return results as raw JSON matching this schema: ${JSON.stringify(jsonSchema)}. Only include real, well-known ski resorts. Be accurate about which country each resort is in. Use the web_search tool to look up any information you are not completely certain about.`,
        },
        { role: 'user', content: prompt },
      ]

      let finalContent = ''

      for (let round = 0; round < 5; round++) {
        console.log(`[callLLM] LLM round ${round + 1}/5`)
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
            `[callLLM] LLM requested ${response.message.tool_calls.length} tool call(s)`
          )
          messages.push({
            role: 'assistant',
            content: response.message.content ?? '',
          })

          for (const toolCall of response.message.tool_calls) {
            const fnName = toolCall.function.name
            const fnArgs = toolCall.function.arguments as { query?: string }

            if (fnName === 'web_search' && fnArgs.query) {
              console.log(`[callLLM] [web_search] ${fnArgs.query}`)
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
          `[callLLM] LLM returned final response (${finalContent.length} chars)`
        )
        break
      }

      if (!finalContent) {
        console.error(
          `[callLLM] No final content received after tool call rounds`
        )
        throw new Error('LLM returned empty response after tool calls')
      }

      const result = responseCodec.decode(finalContent, {
        reportInput: true,
      })

      if (!result) {
        console.error(
          `[callLLM] Attempt ${attempt}: decode returned null/falsy, raw response: ${finalContent.slice(0, 300)}`
        )
        throw new Error('LLM returned empty or invalid response')
      }

      console.log(
        `[callLLM] Successfully parsed ${result.resorts.length} candidate(s)`
      )
      return result.resorts
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(
        `[callLLM] Attempt ${attempt}/${maxRetries} failed: ${message}`
      )
      if (attempt === maxRetries) {
        console.error('[callLLM] Max retries reached, skipping this batch.')
        return []
      }
    }
  }

  return []
}

async function listAllResortNames(): Promise<string[]> {
  console.log(
    '[listAllResortNames] Fetching existing resort names from database...'
  )
  const names: string[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const { rows } = await adminTablesDb.listRows({
      databaseId: DATABASE_ID,
      tableId: RESORTS_TABLE_ID,
      queries: [Query.limit(limit), Query.offset(offset)],
    })
    for (const row of rows) {
      names.push((row as Record<string, unknown>).resortName as string)
    }
    console.log(
      `[listAllResortNames] Fetched ${rows.length} rows (total so far: ${names.length})`
    )
    if (rows.length < limit) break
    offset += limit
  }
  console.log(`[listAllResortNames] Total existing resorts: ${names.length}`)
  return names
}

async function deduplicateWithLLM(
  candidates: Candidate[],
  existingNames: string[],
  model: string
): Promise<Candidate[]> {
  console.log(
    `[deduplicateWithLLM] Starting deduplication: ${candidates.length} candidates against ${existingNames.length} existing resorts`
  )
  if (existingNames.length === 0 || candidates.length === 0) {
    console.log(
      '[deduplicateWithLLM] Skipping deduplication (no existing resorts or no candidates)'
    )
    return candidates
  }

  const existingLower = new Set(existingNames.map((n) => n.toLowerCase()))

  const afterExact = candidates.filter((c) => {
    if (existingLower.has(c.resortName.toLowerCase())) {
      console.log(
        `[deduplicateWithLLM] Exact duplicate removed: ${c.resortName}`
      )
      return false
    }
    return true
  })

  console.log(
    `[deduplicateWithLLM] After exact dedup: ${afterExact.length} candidates remain (removed ${candidates.length - afterExact.length})`
  )

  if (afterExact.length === 0) {
    console.log('[deduplicateWithLLM] No candidates remain after exact dedup')
    return afterExact
  }

  const dedupeSchema = z.object({
    duplicates: z.array(
      z.object({
        candidate: z.string(),
        reason: z.string(),
      })
    ),
  })

  const dedupeCodec = jsonCodec(dedupeSchema)
  const jsonSchema: JSONSchema.JSONSchema = {
    type: 'object',
    properties: {
      duplicates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            candidate: {
              type: 'string',
              description:
                'The resortName from the candidates list that is a duplicate',
            },
            reason: {
              type: 'string',
              description: 'Brief explanation of why it is a duplicate',
            },
          },
          required: ['candidate', 'reason'],
        },
      },
    },
    required: ['duplicates'],
  }

  const prompt = `Given these existing ski resorts in the database:
${existingNames.join(', ')}

And these candidate resorts to add:
${afterExact.map((c) => c.resortName).join(', ')}

Which candidates are duplicates of existing resorts? Consider alternate spellings, abbreviations, and common name variations (e.g., "St. Anton" = "Sankt Anton", "Val d'Isere" = "Val d'Isère"). Only flag clear duplicates, not merely resorts in the same area. Only return valid JSON.`

  console.log(
    `[deduplicateWithLLM] Calling LLM for fuzzy deduplication with ${afterExact.length} candidates...`
  )
  try {
    const response = await ollama.chat({
      stream: false as const,
      model,
      messages: [
        {
          role: 'system',
          content: `Return results as raw JSON matching this schema: ${JSON.stringify(jsonSchema)}. Only flag clear duplicates where the same resort has a different spelling or name variant.`,
        },
        { role: 'user', content: prompt },
      ],
    })

    const result = dedupeCodec.decode(response.message.content, {
      reportInput: true,
    })

    if (!result) {
      console.log(
        '[deduplicateWithLLM] LLM dedup decode returned null, keeping all candidates'
      )
      return afterExact
    }

    const duplicateNames = new Set(result.duplicates.map((d) => d.candidate))
    const kept = afterExact.filter((c) => !duplicateNames.has(c.resortName))
    const removed = afterExact.filter((c) => duplicateNames.has(c.resortName))

    if (removed.length > 0) {
      console.log(
        `[deduplicateWithLLM] LLM identified ${removed.length} fuzzy duplicate(s):`
      )
      for (const d of result.duplicates) {
        console.log(`[deduplicateWithLLM]   - ${d.candidate}: ${d.reason}`)
      }
    }

    console.log(
      `[deduplicateWithLLM] After fuzzy dedup: ${kept.length} candidates remain`
    )
    return kept
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `[deduplicateWithLLM] Deduplication LLM call failed: ${message}. Keeping all candidates.`
    )
    return afterExact
  }
}

async function confirmWithUser(candidates: Candidate[]): Promise<Candidate[]> {
  if (candidates.length === 0) {
    console.log('No candidates to review.')
    return []
  }

  console.log('\nProposed resorts to add:')
  for (const [i, c] of candidates.entries()) {
    console.log(`  ${i + 1}. ${c.resortName} (${c.country})`)
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question('\nAccept all? (y/n/remove): ')
    const trimmed = answer.trim().toLowerCase()

    if (trimmed === 'y' || trimmed === '') {
      return candidates
    }

    if (trimmed === 'n') {
      return []
    }

    const indicesToRemove = new Set<number>()
    const parts = trimmed.split(/[\s,]+/).filter(Boolean)
    for (const part of parts) {
      const idx = Number.parseInt(part, 10) - 1
      if (idx >= 0 && idx < candidates.length) {
        indicesToRemove.add(idx)
      }
    }

    return candidates.filter((_, i) => !indicesToRemove.has(i))
  } finally {
    rl.close()
  }
}

async function writeResorts(
  candidates: Candidate[],
  region: string
): Promise<void> {
  console.log(
    `[writeResorts] Writing ${candidates.length} resort(s) to database (region: ${region})...`
  )
  let created = 0
  for (const candidate of candidates) {
    console.log(
      `[writeResorts] Creating: ${candidate.resortName} (${candidate.country}) [region=${region}]`
    )
    await adminTablesDb.createRow({
      databaseId: DATABASE_ID,
      tableId: RESORTS_TABLE_ID,
      rowId: ID.unique(),
      data: {
        resortName: candidate.resortName,
        country: candidate.country,
        region,
        enriched: false,
      },
    })
    created++
    console.log(
      `[writeResorts] Created: ${candidate.resortName} (${candidate.country}) [enriched=false]`
    )
  }
  console.log(
    `[writeResorts] Done. Created ${created}/${candidates.length} resort(s).`
  )
}

async function seed(options: {
  region: string
  count: string
  model?: string
}) {
  const region = options.region
  const count = Number.parseInt(options.count, 10)
  const model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL

  if (!REGIONS.includes(region as (typeof REGIONS)[number])) {
    console.error(
      `Unknown region "${region}". Valid regions:\n${REGIONS.map((r) => `  - ${r}`).join('\n')}`
    )
    process.exit(1)
  }

  if (Number.isNaN(count) || count < 1) {
    console.error(
      `Invalid count "${options.count}". Must be a positive integer.`
    )
    process.exit(1)
  }

  console.log(`[seed] Seeding resorts for region: ${region}`)
  console.log(
    `[seed] Requesting ${count} candidate(s) from LLM (model: ${model})...\n`
  )

  const prompt = `List ${count} well-known ski resorts in the "${region}" region. Include the resort name and the country it is in. Return results as JSON without any introductory text.`

  const candidates = await callLLM(prompt, model)
  if (candidates.length === 0) {
    console.error('[seed] No candidates returned from LLM. Aborting.')
    process.exit(1)
  }

  console.log(`[seed] LLM returned ${candidates.length} candidate(s):\n`)
  for (const c of candidates) {
    console.log(`  - ${c.resortName} (${c.country})`)
  }

  const existingNames = await listAllResortNames()
  console.log(
    `[seed] Found ${existingNames.length} existing resort(s) in database.`
  )

  const afterDedup = await deduplicateWithLLM(candidates, existingNames, model)
  console.log(`\n[seed] After deduplication: ${afterDedup.length} candidate(s)`)

  const confirmed = await confirmWithUser(afterDedup)
  if (confirmed.length === 0) {
    console.log('[seed] No resorts confirmed. Aborting.')
    process.exit(0)
  }

  console.log(`\n[seed] Writing ${confirmed.length} resort(s) to database...`)
  await writeResorts(confirmed, region)
}

const program = new Command()

program
  .name('seed-resorts')
  .description(
    'Seed ski resorts into the database using LLM-generated candidates'
  )
  .version('1.0.0')
  .requiredOption(
    '--region <region>',
    'Region name (must match a value from src/regions.ts)'
  )
  .requiredOption(
    '--count <number>',
    'Number of resort candidates to request from LLM'
  )
  .option(
    '--model <model>',
    'LLM model to use (default: kimi-k2.6:cloud or OLLAMA_MODEL env var)'
  )
  .action(seed)

program.parse()
