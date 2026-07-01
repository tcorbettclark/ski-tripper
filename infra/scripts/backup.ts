#!/usr/bin/env bun

import { Database } from 'bun:sqlite'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import PocketBase from 'pocketbase'
import {
  CYAN,
  error,
  fail,
  GREEN,
  help,
  info,
  RESET,
  step,
  success,
  warn,
} from './lib/log'

const PROJECT_ROOT = resolve(import.meta.dir, '../..')
const BACKUPS_DIR = resolve(PROJECT_ROOT, 'infra/backups')
const DEV_PB_DATA_DIR = resolve(PROJECT_ROOT, 'dev/pb_data')

const STATS_COLLECTIONS = ['users', 'trips', 'proposals', 'polls']

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    fail(`Required env var ${name} is not set`)
  }
  return value
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function todayBackupName(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const sec = String(now.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}_${hour}-${min}-${sec}`
}

function pbKeyFromDate(dateStr: string): string {
  return `backup_${dateStr}.zip`
}

function localFileFromDate(dateStr: string): string {
  return resolve(BACKUPS_DIR, `${dateStr}.zip`)
}

async function authenticate(pb: PocketBase): Promise<void> {
  const email = requireEnv('POCKETBASE_ADMIN_EMAIL')
  const password = requireEnv('POCKETBASE_ADMIN_PASSWORD')
  await pb.collection('_superusers').authWithPassword(email, password)
}

async function waitForPocketBase(
  url: string,
  maxAttempts = 60,
  delayMs = 2000
): Promise<void> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok) {
        success(`PocketBase is healthy (attempt ${i}/${maxAttempts})`)
        return
      }
    } catch {
      // not ready yet
    }
    if (i < maxAttempts) {
      process.stdout.write(
        `Waiting for PocketBase at ${url}... (attempt ${i}/${maxAttempts})\r`
      )
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  fail(`PocketBase did not become healthy after ${maxAttempts} attempts`)
}

function getBackupStats(zipPath: string): Record<string, number> | null {
  const tmpDir = join(BACKUPS_DIR, '.tmp-stats')
  try {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true })
    }
    mkdirSync(tmpDir, { recursive: true })

    // Extract the entire archive — data.db may be at root or inside pb_data/
    execSync(`unzip -o "${zipPath}" -d "${tmpDir}"`, {
      stdio: 'pipe',
    })

    // Find data.db — could be at root or inside pb_data/
    let dbPath = join(tmpDir, 'data.db')
    if (!existsSync(dbPath)) {
      dbPath = join(tmpDir, 'pb_data', 'data.db')
    }
    if (!existsSync(dbPath)) {
      return null
    }

    const db = new Database(dbPath, { readonly: true })
    const stats: Record<string, number> = {}

    for (const collection of STATS_COLLECTIONS) {
      try {
        const result = db
          .query(`SELECT COUNT(*) as count FROM "${collection}"`)
          .get() as { count: number } | null
        stats[collection] = result?.count ?? 0
      } catch {
        // collection table doesn't exist in this backup
        stats[collection] = 0
      }
    }

    db.close()
    return stats
  } catch {
    return null
  } finally {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  }
}

// ── Commands ──

async function create(): Promise<void> {
  const pbUrl = requireEnv('POCKETBASE_EXTERNAL_URL')
  const dateStr = todayBackupName()
  const pbBackupKey = pbKeyFromDate(dateStr)
  const localPath = localFileFromDate(dateStr)

  if (existsSync(localPath)) {
    fail(
      `Backup already exists: ${localPath}\n  Delete it first if you want to re-create it.`
    )
  }

  mkdirSync(BACKUPS_DIR, { recursive: true })

  const pb = new PocketBase(pbUrl)

  step('Authenticating as superuser')
  await authenticate(pb)

  step(`Creating backup on prod: ${pbBackupKey}`)
  await pb.send('/api/backups', {
    method: 'POST',
    body: { name: pbBackupKey },
  })
  success('Backup creation initiated')

  step('Waiting for backup to appear in backup list')
  let backupReady = false
  for (let i = 0; i < 60; i++) {
    const backups = (await pb.send('/api/backups', {
      method: 'GET',
    })) as { key: string; size: number; modified: string }[]
    if (backups.some((b) => b.key === pbBackupKey)) {
      backupReady = true
      break
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  if (!backupReady) {
    fail('Backup did not appear in backup list after 120 seconds')
  }
  success('Backup is ready')

  step('Getting file download token')
  const tokenResult = (await pb.send('/api/files/token', {
    method: 'POST',
  })) as { token: string }

  step('Downloading backup')
  const downloadUrl = `${pbUrl}/api/backups/${pbBackupKey}?token=${tokenResult.token}`
  const response = await fetch(downloadUrl)
  if (!response.ok) {
    fail(
      `Failed to download backup: ${response.status} ${await response.text()}`
    )
  }
  const buffer = await response.arrayBuffer()
  const { writeFileSync } = await import('node:fs')
  writeFileSync(localPath, Buffer.from(buffer))
  success(`Downloaded to ${localPath} (${formatBytes(buffer.byteLength)})`)

  step('Deleting backup from prod storage')
  try {
    await pb.send(`/api/backups/${pbBackupKey}`, { method: 'DELETE' })
    success('Backup deleted from prod storage')
  } catch (err) {
    warn(
      `Could not delete backup from prod storage: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  pb.authStore.clear()
}

async function restore(fileArg: string): Promise<void> {
  const pbUrl = requireEnv('POCKETBASE_EXTERNAL_URL')
  const filename = fileArg.endsWith('.zip') ? fileArg : `${fileArg}.zip`
  const localPath = resolve(BACKUPS_DIR, filename)

  if (!existsSync(localPath)) {
    fail(`Backup file not found: ${localPath}`)
  }

  // Extract the date part from the filename (e.g., "2026-Jul-01.zip" -> "2026-Jul-01")
  const dateStr = filename.replace(/\.zip$/, '')
  const pbBackupKey = pbKeyFromDate(dateStr)

  const pb = new PocketBase(pbUrl)

  step('Authenticating as superuser')
  await authenticate(pb)

  step('Uploading backup to prod')
  const fileContent = await import('node:fs').then((fs) =>
    fs.readFileSync(localPath)
  )
  const blob = new Blob([fileContent], { type: 'application/zip' })
  await pb.send('/api/backups/upload', {
    method: 'POST',
    body: { file: blob },
  })
  success('Backup uploaded')

  step('Triggering restore (this will restart PocketBase)')
  await pb.send(`/api/backups/${pbBackupKey}/restore`, {
    method: 'POST',
  })
  success('Restore initiated — PocketBase will restart')

  step('Waiting for PocketBase to become healthy')
  // The auth token will be invalid after restart, so we need to re-authenticate
  // but first wait for PB to come back
  await waitForPocketBase(pbUrl)

  step('Cleaning up backup from prod storage')
  const pb2 = new PocketBase(pbUrl)
  try {
    await authenticate(pb2)
    await pb2.send(`/api/backups/${pbBackupKey}`, { method: 'DELETE' })
    success('Backup deleted from prod storage')
  } catch (err) {
    warn(
      `Could not delete backup from prod storage: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  pb2.authStore.clear()

  success('Restore complete!')
}

async function load(fileArg: string): Promise<void> {
  const filename = fileArg.endsWith('.zip') ? fileArg : `${fileArg}.zip`
  const localPath = resolve(BACKUPS_DIR, filename)

  if (!existsSync(localPath)) {
    fail(`Backup file not found: ${localPath}`)
  }

  // Check if dev PB is running by trying to lock the data.db
  const dbPath = join(DEV_PB_DATA_DIR, 'data.db')
  if (existsSync(dbPath)) {
    let db: Database | null = null
    try {
      db = new Database(dbPath, { readonly: true })
      // Try an exclusive lock — if PB is running, this will fail or the DB will be locked
      db.exec('BEGIN EXCLUSIVE')
      db.exec('ROLLBACK')
      db.close()
      db = null
    } catch {
      if (db) {
        try {
          db.close()
        } catch {
          // ignore
        }
      }
      fail(
        'Cannot load backup while dev PocketBase is running.\n  Stop it with Ctrl+C and try again.'
      )
    }
  }

  step('Clearing dev/pb_data/')
  if (existsSync(DEV_PB_DATA_DIR)) {
    const entries = readdirSync(DEV_PB_DATA_DIR)
    for (const entry of entries) {
      rmSync(join(DEV_PB_DATA_DIR, entry), { recursive: true, force: true })
    }
  } else {
    mkdirSync(DEV_PB_DATA_DIR, { recursive: true })
  }
  success('Cleared dev/pb_data/')

  step('Extracting backup into dev/pb_data/')
  try {
    execSync(`unzip -o "${localPath}" -d "${DEV_PB_DATA_DIR}"`, {
      stdio: 'pipe',
    })
  } catch (err) {
    fail(
      `Failed to extract backup: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  success('Backup extracted')

  success('Load complete! Run `bun run dev` to start the dev server.')
  info(
    'The superuser and settings will be configured automatically on dev startup.'
  )
}

async function list(): Promise<void> {
  if (!existsSync(BACKUPS_DIR)) {
    info('No backups directory found (infra/backups/)')
    info(
      'Run `bun run env:prod bun run infra:backup create` to create a backup.'
    )
    return
  }

  const files = readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.zip'))
    .sort()
    .reverse()

  if (files.length === 0) {
    info('No backups found in infra/backups/')
    info(
      'Run `bun run env:prod bun run infra:backup create` to create a backup.'
    )
    return
  }

  step(`Found ${files.length} backup(s) in infra/backups/`)
  for (const file of files) {
    const filePath = join(BACKUPS_DIR, file)
    const stat = statSync(filePath)
    const size = formatBytes(stat.size)
    info(`${file}  ${size}`)

    const stats = getBackupStats(filePath)
    if (stats) {
      for (const collection of STATS_COLLECTIONS) {
        const count = stats[collection] ?? 0
        info(
          `    ${CYAN}${collection.padEnd(12)}${RESET} ${GREEN}${count}${RESET}`
        )
      }
    }
  }
}

// ── Main ──

const HELP_TEXT = `Usage: bun run infra:backup <command> [options]

Commands:
  create              Create a backup from production and download it locally
  restore <file>      Restore a backup file to production (dangerous!)
  load <file>         Load a backup file into the local dev environment
  list                List available backups with stats

Options:
  --help, -h          Show this help message

File arguments:
  Use just the date-time part (e.g. "2026-03-02_14-34-03") or the full filename (e.g. "2026-03-02_14-34-03.zip").
  Backup files are stored in infra/backups/.

Examples:
  bun run env:prod bun run infra:backup create                        Create a backup from prod
  bun run env:prod bun run infra:backup restore 2026-03-02_14-34-03  Restore a backup to prod
  bun run infra:backup load 2026-03-02_14-34-03                      Load a backup into dev
  bun run infra:backup list                                           List available backups`

async function main() {
  const command = process.argv[2]

  if (!command || command === '--help' || command === '-h') {
    help(HELP_TEXT, command ? 0 : 1)
  }

  switch (command) {
    case 'create':
      await create()
      break
    case 'restore': {
      const file = process.argv[3]
      if (!file) {
        error('Missing file argument')
        info('Usage: bun run env:prod bun run infra:backup restore <file>')
        process.exit(1)
      }
      await restore(file)
      break
    }
    case 'load': {
      const file = process.argv[3]
      if (!file) {
        error('Missing file argument')
        info('Usage: bun run infra:backup load <file>')
        process.exit(1)
      }
      await load(file)
      break
    }
    case 'list':
      await list()
      break
    default:
      error(`Unknown command: ${command}`)
      help(HELP_TEXT, 1)
  }
}

main().catch((err) => {
  error(`Backup command failed: ${err}`)
  process.exitCode = 1
})
