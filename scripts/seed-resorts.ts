#!/usr/bin/env bun

import * as readline from 'node:readline/promises'
import { aiJsonSafeParse } from 'ai-json-safe-parse'
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
const OLLAMA_HOST = 'https://ollama.com'
const EXA_NUM_RESULTS = 3
const EXA_MAX_CHARS = 3000 as const
const EXA_HIGHLIGHT_CHARS = 500 as const
const LLM_MAX_RETRIES = 3
const LLM_MAX_TOOL_ROUNDS = 5

const LLM_CANDIDATE_SYSTEM_PROMPT = (jsonSchema: JSONSchema.JSONSchema) =>
  `You are a ski resort expert. Return results as raw JSON matching this schema: ${JSON.stringify(jsonSchema)}. Only include real, well-known ski resorts. Be accurate about which country each resort is in. Use the web_search tool to look up any information you are not completely certain about.`

const LLM_CANDIDATE_USER_PROMPT = (count: number, region: string) =>
  `List ${count} well-known ski resorts in the "${region}" region. Include the resort name and the country it is in. Return results as JSON without any introductory text.`

const LLM_DEDUPE_SYSTEM_PROMPT = (jsonSchema: JSONSchema.JSONSchema) =>
  `Return results as raw JSON matching this schema: ${JSON.stringify(jsonSchema)}. Only flag clear duplicates where the same resort has a different spelling or name variant.`

const LLM_DEDUPE_USER_PROMPT = (
  existingNames: string[],
  candidateNames: string[]
) =>
  `Given these existing ski resorts in the database:
${existingNames.join(', ')}

And these candidate resorts to add:
${candidateNames.join(', ')}

Which candidates are duplicates of existing resorts? Consider alternate spellings, abbreviations, and common name variations (e.g., "St. Anton" = "Sankt Anton", "Val d'Isere" = "Val d'Isère"). Only flag clear duplicates, not merely resorts in the same area. Only return valid JSON.`

const WEB_SEARCH_TOOL_DEFINITION = {
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

const CANDIDATE_JSON_SCHEMA: JSONSchema.JSONSchema = {
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

const DEDUPE_JSON_SCHEMA: JSONSchema.JSONSchema = {
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

const adminClient = new NodeClient()
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT as string)
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID as string)
  .setKey(process.env.APPWRITE_DATABASE_API_KEY as string)

const adminTablesDb = new NodeTablesDB(adminClient)

const ollama = new Ollama({
  host: OLLAMA_HOST,
  headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
})

const exa = new Exa(process.env.EXA_API_KEY as string)

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

async function executeWebSearch(query: string): Promise<string> {
  log('info', 'exa', `Searching for: "${query}"`, 1)
  const results = await exa.search(query, {
    type: 'auto',
    numResults: EXA_NUM_RESULTS,
    useAutoprompt: true,
    contents: {
      text: { maxCharacters: EXA_MAX_CHARS },
      highlights: { maxCharacters: EXA_HIGHLIGHT_CHARS },
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

  log('success', 'exa', `Got ${results.results.length} result(s)`, 1)
  return snippets.join('\n\n---\n\n')
}

async function callLLM(
  prompt: string,
  model: string,
  maxRetries = LLM_MAX_RETRIES
): Promise<Candidate[]> {
  log('info', 'llm', `Calling model ${model} (max ${maxRetries} retries)...`)
  log('info', 'llm', `Prompt: ${prompt.slice(0, 200)}...`, 1)
  const responseCodec = jsonCodec(candidateSchema)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log('info', 'llm', `Attempt ${attempt}/${maxRetries}`, 1)
      const messages: Array<{
        role: 'system' | 'user' | 'assistant' | 'tool'
        content: string
        tool_name?: string
      }> = [
        {
          role: 'system',
          content: LLM_CANDIDATE_SYSTEM_PROMPT(CANDIDATE_JSON_SCHEMA),
        },
        { role: 'user', content: prompt },
      ]

      let finalContent = ''

      for (let round = 0; round < LLM_MAX_TOOL_ROUNDS; round++) {
        log('info', 'llm', `Tool round ${round + 1}/${LLM_MAX_TOOL_ROUNDS}`, 2)
        const response = await ollama.chat({
          stream: false as const,
          model,
          messages,
          tools: [WEB_SEARCH_TOOL_DEFINITION],
        })

        if (
          response.message.tool_calls &&
          response.message.tool_calls.length > 0
        ) {
          log(
            'info',
            'llm',
            `LLM requested ${response.message.tool_calls.length} tool call(s)`,
            2
          )
          messages.push({
            role: 'assistant',
            content: response.message.content ?? '',
          })

          for (const toolCall of response.message.tool_calls) {
            const fnName = toolCall.function.name
            const fnArgs = toolCall.function.arguments as { query?: string }

            if (fnName === 'web_search' && fnArgs.query) {
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
        log(
          'info',
          'llm',
          `LLM returned final response (${finalContent.length} chars)`,
          2
        )
        break
      }

      if (!finalContent) {
        log(
          'error',
          'llm',
          'No final content received after tool call rounds',
          2
        )
        throw new Error('LLM returned empty response after tool calls')
      }

      const result = responseCodec.decode(finalContent, {
        reportInput: true,
      })

      if (!result) {
        log(
          'error',
          'llm',
          `Attempt ${attempt}: decode returned null, raw: ${finalContent.slice(0, 300)}`,
          2
        )
        throw new Error('LLM returned empty or invalid response')
      }

      log(
        'success',
        'llm',
        `Successfully parsed ${result.resorts.length} candidate(s)`,
        1
      )
      return result.resorts
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log(
        'error',
        'llm',
        `Attempt ${attempt}/${maxRetries} failed: ${message}`,
        1
      )
      if (attempt === maxRetries) {
        log('error', 'llm', 'Max retries reached, skipping this batch.')
        return []
      }
    }
  }

  return []
}

async function listAllResortNames(): Promise<string[]> {
  log('info', 'appwrite', 'Fetching existing resort names from database...')
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
    log(
      'info',
      'appwrite',
      `Fetched ${rows.length} rows (total: ${names.length})`,
      1
    )
    if (rows.length < limit) break
    offset += limit
  }
  log('success', 'appwrite', `Total existing resorts: ${names.length}`)
  return names
}

async function deduplicateWithLLM(
  candidates: Candidate[],
  existingNames: string[],
  model: string
): Promise<Candidate[]> {
  log(
    'info',
    'dedup',
    `Deduplicating ${candidates.length} candidates against ${existingNames.length} existing resorts`
  )
  if (existingNames.length === 0 || candidates.length === 0) {
    log(
      'info',
      'dedup',
      'Skipping deduplication (no existing resorts or no candidates)',
      1
    )
    return candidates
  }

  const existingLower = new Set(existingNames.map((n) => n.toLowerCase()))

  const afterExact = candidates.filter((c) => {
    if (existingLower.has(c.resortName.toLowerCase())) {
      log('info', 'dedup', `Exact duplicate removed: ${c.resortName}`, 1)
      return false
    }
    return true
  })

  log(
    'success',
    'dedup',
    `After exact dedup: ${afterExact.length} remain (removed ${candidates.length - afterExact.length})`,
    1
  )

  if (afterExact.length === 0) {
    log('warn', 'dedup', 'No candidates remain after exact dedup', 1)
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

  const prompt = LLM_DEDUPE_USER_PROMPT(
    existingNames,
    afterExact.map((c) => c.resortName)
  )

  log('info', 'dedup', 'Calling LLM for fuzzy deduplication...', 1)
  try {
    const response = await ollama.chat({
      stream: false as const,
      model,
      messages: [
        {
          role: 'system',
          content: LLM_DEDUPE_SYSTEM_PROMPT(DEDUPE_JSON_SCHEMA),
        },
        { role: 'user', content: prompt },
      ],
    })

    const result = dedupeCodec.decode(response.message.content, {
      reportInput: true,
    })

    if (!result) {
      log(
        'warn',
        'dedup',
        'LLM dedup decode returned null, keeping all candidates',
        1
      )
      return afterExact
    }

    const duplicateNames = new Set(result.duplicates.map((d) => d.candidate))
    const kept = afterExact.filter((c) => !duplicateNames.has(c.resortName))
    const removed = afterExact.filter((c) => duplicateNames.has(c.resortName))

    if (removed.length > 0) {
      log(
        'info',
        'dedup',
        `LLM identified ${removed.length} fuzzy duplicate(s):`,
        1
      )
      for (const d of result.duplicates) {
        log('info', 'dedup', `${d.candidate}: ${d.reason}`, 2)
      }
    }

    log(
      'success',
      'dedup',
      `After fuzzy dedup: ${kept.length} candidates remain`,
      1
    )
    return kept
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log(
      'error',
      'dedup',
      `Deduplication LLM call failed: ${message}. Keeping all candidates.`,
      1
    )
    return afterExact
  }
}

async function confirmWithUser(candidates: Candidate[]): Promise<Candidate[]> {
  if (candidates.length === 0) {
    log('warn', 'seed', 'No candidates to review.')
    return []
  }

  console.log()
  console.log(`  ${ANSI_BOLD}Proposed resorts to add:${ANSI_RESET}`)
  for (const [i, c] of candidates.entries()) {
    console.log(
      `  ${ANSI_CYAN}${i + 1}.${ANSI_RESET} ${ANSI_BOLD}${c.resortName}${ANSI_RESET} ${ANSI_DIM}(${c.country})${ANSI_RESET}`
    )
  }
  console.log()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question('  Accept all? (y/n/remove): ')
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
  log(
    'info',
    'appwrite',
    `Writing ${candidates.length} resort(s) (region: ${region})...`
  )
  let created = 0
  for (const candidate of candidates) {
    log(
      'info',
      'appwrite',
      `Creating: ${candidate.resortName} (${candidate.country}) [region=${region}]`,
      1
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
    log(
      'success',
      'appwrite',
      `Created: ${candidate.resortName} (${candidate.country}) [enriched=false]`,
      1
    )
  }
  log(
    'success',
    'appwrite',
    `Done. Created ${created}/${candidates.length} resort(s).`
  )
}

async function seed(options: {
  region: string
  count: string
  model?: string
  dryRun?: boolean
}) {
  const region = options.region
  const count = Number.parseInt(options.count, 10)
  const model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL

  if (!REGIONS.includes(region as (typeof REGIONS)[number])) {
    log(
      'error',
      'seed',
      `Unknown region "${region}". Valid regions:\n${REGIONS.map((r) => `  - ${r}`).join('\n')}`
    )
    process.exit(1)
  }

  if (Number.isNaN(count) || count < 1) {
    log(
      'error',
      'seed',
      `Invalid count "${options.count}". Must be a positive integer.`
    )
    process.exit(1)
  }

  const dryRun = options.dryRun ?? false

  if (dryRun) {
    log(
      'info',
      'seed',
      `${ANSI_BOLD}Dry run mode${ANSI_RESET} (no database reads or writes)`
    )
  }

  log('info', 'seed', `Seeding resorts for region: ${region}`)
  log(
    'info',
    'seed',
    `Requesting ${count} candidate(s) from LLM (model: ${model})`,
    1
  )

  const prompt = LLM_CANDIDATE_USER_PROMPT(count, region)

  const candidates = await callLLM(prompt, model)
  if (candidates.length === 0) {
    log('error', 'seed', 'No candidates returned from LLM. Aborting.')
    process.exit(1)
  }

  console.log()
  log('success', 'seed', `LLM returned ${candidates.length} candidate(s):`)
  for (const c of candidates) {
    log('info', 'seed', `${c.resortName} (${c.country})`, 1)
  }

  const existingNames = dryRun ? [] : await listAllResortNames()
  if (!dryRun) {
    log(
      'info',
      'seed',
      `Found ${existingNames.length} existing resort(s) in database.`,
      1
    )
  }

  const afterDedup = await deduplicateWithLLM(candidates, existingNames, model)
  log(
    'success',
    'seed',
    `After deduplication: ${afterDedup.length} candidate(s)`
  )

  const confirmed = dryRun ? afterDedup : await confirmWithUser(afterDedup)
  if (confirmed.length === 0) {
    log('warn', 'seed', 'No resorts confirmed. Aborting.')
    process.exit(0)
  }

  console.log()
  if (dryRun) {
    log(
      'info',
      'seed',
      `${confirmed.length} resort(s) would be written (region: ${region}):`
    )
    for (const c of confirmed) {
      log(
        'info',
        'seed',
        `${c.resortName} (${c.country}) [region=${region}, enriched=false]`,
        1
      )
    }
    log('success', 'seed', 'Dry run complete. No resorts written to database.')
  } else {
    log('info', 'seed', `Writing ${confirmed.length} resort(s) to database...`)
    await writeResorts(confirmed, region)
  }
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
  .option(
    '--dry-run',
    'Run interactively without reading from or writing to the database'
  )
  .action(seed)

program.parse()
