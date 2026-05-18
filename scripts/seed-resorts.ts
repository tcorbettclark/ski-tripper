#!/usr/bin/env bun

import * as readline from 'node:readline/promises'
import { Command } from 'commander'
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
              description: 'The country ISO code where the resort is located',
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
      const response = await ollama.chat({
        stream: false as const,
        model,
        messages: [
          {
            role: 'system',
            content: `You are a ski resort expert. Return results as raw JSON matching this schema: ${JSON.stringify(jsonSchema)}. Only include real, well-known ski resorts. Be accurate about which country each resort is in.`,
          },
          { role: 'user', content: prompt },
        ],
      })

      const result = responseCodec.decode(response.message.content, {
        reportInput: true,
      })

      if (!result) {
        throw new Error('LLM returned empty or invalid response')
      }

      return result.resorts
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Attempt ${attempt}/${maxRetries} failed: ${message}`)
      if (attempt === maxRetries) {
        console.error('Max retries reached, skipping this batch.')
        return []
      }
    }
  }

  return []
}

async function listAllResortNames(): Promise<string[]> {
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
    if (rows.length < limit) break
    offset += limit
  }
  return names
}

async function deduplicateWithLLM(
  candidates: Candidate[],
  existingNames: string[],
  model: string
): Promise<Candidate[]> {
  if (existingNames.length === 0 || candidates.length === 0) {
    return candidates
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
${candidates.map((c) => c.resortName).join(', ')}

Which candidates are duplicates of existing resorts? Consider alternate spellings, abbreviations, and common name variations (e.g., "St. Anton" = "Sankt Anton", "Val d'Isere" = "Val d'Isère"). Only flag clear duplicates, not merely resorts in the same area. Return the result as JSON.`

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
      return candidates
    }

    const duplicateNames = new Set(result.duplicates.map((d) => d.candidate))
    const kept = candidates.filter((c) => !duplicateNames.has(c.resortName))
    const removed = candidates.filter((c) => duplicateNames.has(c.resortName))

    if (removed.length > 0) {
      console.log('\nLLM identified duplicates:')
      for (const d of result.duplicates) {
        console.log(`  - ${d.candidate}: ${d.reason}`)
      }
    }

    return kept
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `Deduplication LLM call failed: ${message}. Keeping all candidates.`
    )
    return candidates
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
  let created = 0
  for (const candidate of candidates) {
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
    console.log(`  Created: ${candidate.resortName} (${candidate.country})`)
  }
  console.log(`\nDone. Created ${created} resort(s).`)
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

  console.log(`Seeding resorts for region: ${region}`)
  console.log(
    `Requesting ${count} candidate(s) from LLM (model: ${model})...\n`
  )

  const prompt = `List ${count} well-known ski resorts in the "${region}" region. Include the resort name and the country it is in. Return results as JSON.`

  const candidates = await callLLM(prompt, model)
  if (candidates.length === 0) {
    console.error('No candidates returned from LLM. Aborting.')
    process.exit(1)
  }

  console.log(`LLM returned ${candidates.length} candidate(s):\n`)
  for (const c of candidates) {
    console.log(`  - ${c.resortName} (${c.country})`)
  }

  const existingNames = await listAllResortNames()
  console.log(`\nFound ${existingNames.length} existing resort(s) in database.`)

  const afterDedup = await deduplicateWithLLM(candidates, existingNames, model)
  console.log(`\nAfter deduplication: ${afterDedup.length} candidate(s)`)

  const confirmed = await confirmWithUser(afterDedup)
  if (confirmed.length === 0) {
    console.log('No resorts confirmed. Aborting.')
    process.exit(0)
  }

  console.log(`\nWriting ${confirmed.length} resort(s) to database...`)
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
