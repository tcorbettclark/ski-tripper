#!/usr/bin/env bun

import * as fs from 'node:fs'
import * as path from 'node:path'
import { pipeline } from '@huggingface/transformers'
import { Command } from 'commander'

interface SeededResort {
  id: string
  resortName: string
  country: string
  region: string
}

interface EnrichedResort {
  id: string
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
  websites: string[]
  linkedResortsDescription: string
}

interface EncodedResort {
  id: string
  embedding: number[]
  searchText: string
}

const SEEDED_PATH = path.join(process.cwd(), 'resorts', 'seeded.jsonl')
const ENRICHED_PATH = path.join(process.cwd(), 'resorts', 'enriched.jsonl')
const ENCODED_PATH = path.join(process.cwd(), 'resorts', 'encoded.jsonl')
const OUTPUT_PATH = path.join(process.cwd(), 'public', 'resort-data.jsonl')

const MODEL_ID = 'Xenova/multi-qa-MiniLM-L6-cos-v1'

const ANSI_RESET = '\x1b[0m'
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

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return []
  const content = fs.readFileSync(filePath, 'utf-8').trim()
  if (!content) return []
  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

function writeJsonl<T>(filePath: string, items: T[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const content = `${items.map((item) => JSON.stringify(item)).join('\n')}\n`
  fs.writeFileSync(filePath, content, 'utf-8')
}

function computeSearchText(
  seeded: SeededResort,
  enriched: EnrichedResort | undefined
): string {
  const parts = [
    seeded.resortName,
    seeded.country,
    seeded.region,
    enriched?.description ?? '',
    enriched?.linkedResortsDescription ?? '',
  ]
  if (enriched?.skiSeasonMonths) {
    parts.push(`Season: ${enriched.skiSeasonMonths}`)
  }
  if (enriched?.snowReliability) {
    parts.push(`Snow: ${enriched.snowReliability}`)
  }
  if (enriched?.nearestAirport) {
    parts.push(`Airport: ${enriched.nearestAirport}`)
  }
  return parts.filter(Boolean).join('. ')
}

function simpleHash(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return hash.toString(36)
}

async function encode() {
  const seeded = readJsonl<SeededResort>(SEEDED_PATH)
  if (seeded.length === 0) {
    log(
      'error',
      'encode',
      `No seeded resorts found in ${SEEDED_PATH}. Run seed-resorts first.`
    )
    process.exit(1)
  }

  const enriched = readJsonl<EnrichedResort>(ENRICHED_PATH)
  const enrichedById = new Map(enriched.map((r) => [r.id, r]))

  const existingEncoded = readJsonl<EncodedResort>(ENCODED_PATH)
  const encodedById = new Map(existingEncoded.map((r) => [r.id, r]))

  log(
    'info',
    'encode',
    `Found ${seeded.length} seeded, ${enriched.length} enriched, ${existingEncoded.length} previously encoded (only enriched resorts will be encoded)`
  )

  const notEnriched = seeded.filter((s) => !enrichedById.has(s.id))

  if (notEnriched.length > 0) {
    log(
      'warn',
      'encode',
      `Skipping ${notEnriched.length} seeded resort(s) without enriched data: ${notEnriched.map((s) => s.resortName).join(', ')}`
    )
  }

  const toEncode: Array<{
    seeded: SeededResort
    enriched: EnrichedResort
    searchText: string
  }> = []

  for (const s of seeded) {
    const e = enrichedById.get(s.id)
    if (!e) continue

    const searchText = computeSearchText(s, e)
    const hash = simpleHash(searchText)
    const existing = encodedById.get(s.id)

    if (existing && existing.searchText === hash) {
      log('info', 'encode', `Skipping ${s.resortName} (unchanged)`, 1)
      continue
    }

    toEncode.push({ seeded: s, enriched: e, searchText })
  }

  if (toEncode.length === 0) {
    log(
      'success',
      'encode',
      'All resorts already encoded with up-to-date embeddings.'
    )
    return
  }

  log(
    'info',
    'encode',
    `Encoding ${toEncode.length} resort(s) with ${MODEL_ID}...`
  )
  log(
    'info',
    'encode',
    'Loading model (this may take a moment on first run)...'
  )

  const extractor = await pipeline('feature-extraction', MODEL_ID, {
    dtype: 'uint8',
  })

  log('success', 'encode', 'Model loaded.')

  let encoded = 0
  for (const { seeded: s, searchText } of toEncode) {
    log(
      'info',
      'encode',
      `[${encoded + 1}/${toEncode.length}] Encoding ${s.resortName}...`,
      1
    )

    const output = await extractor(searchText, {
      pooling: 'mean',
      normalize: true,
    })
    const embedding = Array.from(output.data as Float32Array)
    const hash = simpleHash(searchText)

    const encodedEntry: EncodedResort = {
      id: s.id,
      embedding,
      searchText: hash,
    }

    encodedById.set(s.id, encodedEntry)
    encoded++
  }

  const allEncoded = [...encodedById.values()].sort((a, b) =>
    a.id.localeCompare(b.id)
  )
  writeJsonl(ENCODED_PATH, allEncoded)

  log(
    'success',
    'encode',
    `Encoded ${encoded} resort(s). Total: ${allEncoded.length}`
  )
  log('success', 'encode', `Written to ${ENCODED_PATH}`)
}

function build() {
  log('info', 'build', 'Building resort data file...')

  const seeded = readJsonl<SeededResort>(SEEDED_PATH)
  const enriched = readJsonl<EnrichedResort>(ENRICHED_PATH)
  const encoded = readJsonl<EncodedResort>(ENCODED_PATH)

  const seededIds = new Set(seeded.map((r) => r.id))
  const enrichedIds = new Set(enriched.map((r) => r.id))
  const encodedIds = new Set(encoded.map((r) => r.id))
  const validIds = new Set(
    [...seededIds].filter((id) => enrichedIds.has(id) && encodedIds.has(id))
  )

  if (seeded.length === 0 || validIds.size === 0) {
    log(
      'warn',
      'build',
      'No complete resorts found. Creating empty resort-data.jsonl.'
    )
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
    fs.writeFileSync(OUTPUT_PATH, '\n', 'utf-8')
    return
  }

  const skipped =
    seeded.length + enriched.length + encoded.length - validIds.size * 3
  if (skipped > 0) {
    log(
      'warn',
      'build',
      `Skipping ${skipped} resort(s) missing from one or more files (seeded: ${seeded.length}, enriched: ${enriched.length}, encoded: ${encoded.length}, intersection: ${validIds.size})`
    )
  }

  const enrichedById = new Map(enriched.map((r) => [r.id, r]))
  const encodedById = new Map(encoded.map((r) => [r.id, r]))

  const mergedResorts = seeded
    .filter((s) => validIds.has(s.id))
    .map((s) => {
      const e = enrichedById.get(s.id)!
      const enc = encodedById.get(s.id)!

      return {
        id: s.id,
        resortName: s.resortName,
        country: s.country,
        region: s.region,
        description: e.description,
        latitude: e.latitude,
        longitude: e.longitude,
        summitAltitude: e.summitAltitude,
        baseAltitude: e.baseAltitude,
        nearestAirport: e.nearestAirport,
        transferTime: e.transferTime,
        pisteKm: e.pisteKm,
        beginnerPct: e.beginnerPct,
        intermediatePct: e.intermediatePct,
        advancedPct: e.advancedPct,
        liftCount: e.liftCount,
        snowReliability: e.snowReliability,
        skiSeasonMonths: e.skiSeasonMonths,
        websites: e.websites,
        linkedResortsDescription: e.linkedResortsDescription,
        embedding: enc.embedding,
      }
    })

  writeJsonl(OUTPUT_PATH, mergedResorts)
  log(
    'success',
    'build',
    `Written ${mergedResorts.length} resort(s) to ${OUTPUT_PATH}`
  )
}

const program = new Command()

program
  .name('encode-resorts')
  .description(
    'Encode seeded+enriched resorts into embeddings and build resort data file'
  )
  .version('1.0.0')
  .command('encode', { isDefault: true })
  .description(
    'Encode resorts with embeddings (only resorts that are both seeded and enriched)'
  )
  .action(encode)

program
  .command('build')
  .description(
    'Build resort-data.jsonl from the intersection of seeded, enriched, and encoded files'
  )
  .action(build)

program.parse()
