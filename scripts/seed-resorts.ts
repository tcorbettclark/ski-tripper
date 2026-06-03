#!/usr/bin/env bun

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline/promises'
import { aiJsonSafeParse } from 'ai-json-safe-parse'
import { Command } from 'commander'
import Exa from 'exa-js'
import { Ollama } from 'ollama'
import * as z from 'zod'
import type { JSONSchema } from 'zod/v4/core'
import { REGIONS } from '../src/regions'

interface SeededResort {
  id: string
  resortName: string
  country: string
  region: string
}

function slugify(name: string, region: string, country: string): string {
  const parts = [name, region, country]
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const OLLAMA_HOST = 'https://ollama.com'
const DEFAULT_MODEL = 'kimi-k2.6:cloud'
const SOURCE_WEBSITES = [
  'skiresort.info',
  'onthesnow.com',
  'snow-forecast.com',
  'skimuggle.com',
  'piste-map.com',
  'weski.com',
  'en.wikipedia.org/wiki/List_of_ski_areas_and_resorts_in_Europe',
] as const

const EXA_NUM_RESULTS = 3
const EXA_MAX_CHARS = 10000 as const
const EXA_HIGHLIGHT_CHARS = 500 as const
const LLM_MAX_RETRIES = 3
const LLM_MAX_TOOL_ROUNDS = 5

const LLM_CANDIDATE_SYSTEM_PROMPT = (jsonSchema: JSONSchema.JSONSchema) =>
  `You are a ski resort expert. Return results as raw JSON matching this schema: ${JSON.stringify(jsonSchema)}. Only include real ski resorts. Be accurate about which country each resort is in. Use the web_search tool to look up any information you are not completely certain about.`

const LLM_CANDIDATE_USER_PROMPT = (
  region: string,
  sources?: readonly string[],
  existingResorts?: readonly string[]
) => {
  const excludeClause =
    existingResorts && existingResorts.length > 0
      ? ` Do NOT include any of these already-listed resorts: ${existingResorts.join(', ')}.`
      : ''
  return `List all the ski resorts you can find in the "${region}" region, from major well-known resorts to smaller lesser-known ones. Do not throw any resorts away. By repeated requests I am aiming for an exhaustive list of resorts. Include the resort name and the country it is in.${sources ? ` Use the web_search tool to consult these sites for comprehensive resort lists: ${sources.join(', ')}.` : ''}${excludeClause} Return results as JSON without any introductory text.`
}

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

async function executeWebSearch(
  query: string,
  exclude?: readonly string[],
  includeDomains?: readonly string[]
): Promise<string> {
  const excludeClause =
    exclude && exclude.length > 0 ? ` -${exclude.slice(0, 20).join(' -')}` : ''
  const fullQuery = `${query}${excludeClause}`
  log('info', 'exa', `Searching for: "${fullQuery}"`, 1)
  const results = await exa.search(query, {
    type: 'auto',
    numResults: EXA_NUM_RESULTS,
    useAutoprompt: true,
    includeDomains: includeDomains ? [...includeDomains] : undefined,
    contents: {
      text: { maxCharacters: EXA_MAX_CHARS },
      highlights: { maxCharacters: EXA_HIGHLIGHT_CHARS },
    },
  })

  if (includeDomains) {
    const domains = [
      ...new Set(results.results.map((r) => new URL(r.url).hostname)),
    ]
    log('info', 'exa', `Domains used: ${domains.join(', ')}`, 1)
    for (const r of results.results) {
      log('info', 'exa', `  ${r.url}`, 2)
    }
  }

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
  maxRetries = LLM_MAX_RETRIES,
  exclude?: readonly string[],
  includeDomains?: readonly string[]
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
        const stream = await ollama.chat({
          stream: true,
          model,
          messages,
          tools: [WEB_SEARCH_TOOL_DEFINITION],
        })

        let content = ''
        let thinking = ''
        let isThinking = true
        const toolCalls: Array<{
          name: string
          arguments: Record<string, unknown>
        }> = []

        for await (const chunk of stream) {
          const thinkPart = (
            chunk.message as unknown as Record<string, unknown>
          ).thinking
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
                'llm',
                `Model thought for ${thinking.length} chars`,
                2
              )
            }
            content += chunk.message.content
          }
          if (chunk.message.tool_calls) {
            for (const tc of chunk.message.tool_calls) {
              toolCalls.push({
                name: tc.function.name,
                arguments: tc.function.arguments as Record<string, unknown>,
              })
            }
          }
        }
        console.log()

        if (toolCalls.length > 0) {
          log(
            'info',
            'llm',
            `LLM requested ${toolCalls.length} tool call(s)`,
            2
          )
          messages.push({
            role: 'assistant',
            content,
          })

          for (const tc of toolCalls) {
            const fnArgs = tc.arguments as { query?: string }

            if (tc.name === 'web_search' && fnArgs.query) {
              const searchResult = await executeWebSearch(
                fnArgs.query,
                exclude,
                includeDomains
              )
              messages.push({
                role: 'tool',
                content: searchResult,
                tool_name: tc.name,
              })
            }
          }

          continue
        }

        finalContent = content
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
          `Attempt ${attempt}: failed to parse LLM response as JSON. Full response:`,
          2
        )
        log('error', 'llm', finalContent, 2)
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
    const stream = await ollama.chat({
      stream: true,
      model,
      messages: [
        {
          role: 'system',
          content: LLM_DEDUPE_SYSTEM_PROMPT(DEDUPE_JSON_SCHEMA),
        },
        { role: 'user', content: prompt },
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
          log('info', 'dedup', `Model thought for ${thinking.length} chars`, 2)
        }
        content += chunk.message.content
      }
    }
    console.log()

    const result = dedupeCodec.decode(content, {
      reportInput: true,
    })

    if (!result) {
      log(
        'warn',
        'dedup',
        'Failed to parse dedup response as JSON. Full response:',
        1
      )
      log('warn', 'dedup', content, 1)
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

function readSeededJsonl(filePath: string): SeededResort[] {
  if (!fs.existsSync(filePath)) return []
  const lines = fs
    .readFileSync(filePath, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
  return lines.map((line) => JSON.parse(line) as SeededResort)
}

function writeSeededJsonl(filePath: string, resorts: SeededResort[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const content = `${resorts.map((r) => JSON.stringify(r)).join('\n')}\n`
  fs.writeFileSync(filePath, content, 'utf-8')
}

async function seed(options: {
  region: string
  batches: string
  model?: string
  dryRun?: boolean
  sources?: boolean
}) {
  const region = options.region
  const batches = Number.parseInt(options.batches, 10)
  const model = options.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL
  const sources = options.sources ? SOURCE_WEBSITES : undefined
  const includeDomains = options.sources ? SOURCE_WEBSITES : undefined

  if (!REGIONS.includes(region as (typeof REGIONS)[number])) {
    log(
      'error',
      'seed',
      `Unknown region "${region}". Valid regions:\n${REGIONS.map((r) => `  - ${r}`).join('\n')}`
    )
    process.exit(1)
  }

  if (Number.isNaN(batches) || batches < 1) {
    log(
      'error',
      'seed',
      `Invalid batches "${options.batches}". Must be a positive integer.`
    )
    process.exit(1)
  }

  const dryRun = options.dryRun ?? false

  const seededPath = path.join(process.cwd(), 'resorts', 'seeded.jsonl')
  const existingSeeded = readSeededJsonl(seededPath)
  const existingSlugs = new Set(existingSeeded.map((r) => r.id))
  const existingNames = existingSeeded.map((r) => r.resortName)

  if (dryRun) {
    log(
      'info',
      'seed',
      `${ANSI_BOLD}Dry run mode${ANSI_RESET} (no file writes)`
    )
  }

  log('info', 'seed', `Seeding resorts for region: ${region}`)
  log(
    'info',
    'seed',
    `Up to ${batches} batch(es) (model: ${model}), stopping early if no new resorts found`,
    1
  )
  if (includeDomains) {
    log('info', 'seed', `Sources: ${includeDomains.join(', ')}`, 1)
  }

  log(
    'info',
    'seed',
    `Existing seeded resorts: ${existingSeeded.length} (${seededPath})`,
    1
  )

  const allCandidates: Candidate[] = []
  const seenCandidateNames = new Set<string>()

  for (let i = 0; i < batches; i++) {
    log(
      'info',
      'seed',
      `Batch ${i + 1}/${batches} (have ${allCandidates.length} unique so far)`,
      1
    )

    const existingResortNames = allCandidates.map((c) => c.resortName)
    const prompt = LLM_CANDIDATE_USER_PROMPT(
      region,
      sources,
      existingResortNames
    )
    const batchCandidates = await callLLM(
      prompt,
      model,
      LLM_MAX_RETRIES,
      existingResortNames,
      includeDomains
    )

    if (batchCandidates.length === 0) {
      log(
        'warn',
        'seed',
        `Batch ${i + 1} returned no candidates, stopping early.`,
        1
      )
      break
    }

    const prevCount = allCandidates.length
    for (const c of batchCandidates) {
      const key = c.resortName.toLowerCase()
      if (!seenCandidateNames.has(key)) {
        seenCandidateNames.add(key)
        allCandidates.push(c)
      }
    }
    const added = allCandidates.length - prevCount
    const dupes = batchCandidates.length - added
    log(
      'success',
      'seed',
      `Batch ${i + 1}: ${batchCandidates.length} found, ${dupes} duplicate(s), ${added} new (${allCandidates.length} unique total)`,
      1
    )

    if (added === 0) {
      log('warn', 'seed', 'No new resorts found, stopping early.', 1)
      break
    }
  }

  if (allCandidates.length === 0) {
    log('error', 'seed', 'No candidates returned from any batch. Aborting.')
    process.exit(1)
  }

  console.log()
  log(
    'success',
    'seed',
    `All batches complete. ${allCandidates.length} unique candidate(s):`
  )
  for (const c of allCandidates) {
    log('info', 'seed', `${c.resortName} (${c.country})`, 1)
  }

  const allExistingNames = [
    ...existingNames,
    ...existingSeeded.map((r) => r.resortName),
  ]
  const afterDedup = await deduplicateWithLLM(
    allCandidates,
    allExistingNames,
    model
  )
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

  const newSeeded: SeededResort[] = confirmed.map((c) => {
    const id = slugify(c.resortName, region, c.country)
    return {
      id,
      resortName: c.resortName,
      country: c.country,
      region,
    }
  })

  const duplicateIds = newSeeded.filter((r) => existingSlugs.has(r.id))
  if (duplicateIds.length > 0) {
    log(
      'error',
      'seed',
      `Duplicate slug IDs generated: ${duplicateIds.map((r) => r.id).join(', ')}`
    )
    process.exit(1)
  }

  const allSeeded = [...existingSeeded, ...newSeeded]

  console.log()
  if (dryRun) {
    log(
      'info',
      'seed',
      `${newSeeded.length} resort(s) would be written to ${seededPath}:`
    )
    for (const r of newSeeded) {
      log('info', 'seed', `${r.resortName} (${r.country}) [id=${r.id}]`, 1)
    }
    log('success', 'seed', 'Dry run complete. No files written.')
  } else {
    writeSeededJsonl(seededPath, allSeeded)
    log(
      'success',
      'seed',
      `Wrote ${newSeeded.length} new resort(s) to ${seededPath} (total: ${allSeeded.length})`
    )
  }
}

const program = new Command()

program
  .name('seed-resorts')
  .description(
    'Seed ski resorts into resorts/seeded.jsonl using LLM-generated candidates'
  )
  .version('1.0.0')
  .requiredOption(
    '--region <region>',
    'Region name (must match a value from src/regions.ts)'
  )
  .requiredOption(
    '--batches <number>',
    'Maximum number of LLM batch calls (stops early if no new resorts found)'
  )
  .option(
    '--model <model>',
    'LLM model to use (default: kimi-k2.6:cloud or OLLAMA_MODEL env var)'
  )
  .option(
    '--dry-run',
    'Run interactively without reading from or writing to any files'
  )
  .option(
    '--sources',
    'Include source website recommendations in the LLM prompt to guide web search'
  )
  .action(seed)

program.parse()
