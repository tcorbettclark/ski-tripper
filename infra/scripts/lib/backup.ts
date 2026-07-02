import { Database } from 'bun:sqlite'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import PocketBase from 'pocketbase'
import { CYAN, fail, GREEN, info, RESET, step, success, warn } from './log'

export const PROJECT_ROOT = resolve(import.meta.dir, '../../..')
export const BACKUPS_DIR = resolve(PROJECT_ROOT, 'infra/backups')
const DEV_PB_DATA_DIR = resolve(PROJECT_ROOT, 'dev/pb_data')

const STATS_COLLECTIONS = ['users', 'trips', 'proposals', 'polls']

export function requireEnv(name: string): string {
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

    execSync(`unzip -o "${zipPath}" -d "${tmpDir}"`, {
      stdio: 'pipe',
    })

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

export function resolveBackupFile(fileArg: string): string {
  if (!existsSync(BACKUPS_DIR)) {
    fail(`Backups directory not found: ${BACKUPS_DIR}`)
  }

  if (fileArg.endsWith('.zip')) {
    const candidate = resolve(BACKUPS_DIR, fileArg)
    if (existsSync(candidate)) return candidate
  }

  const exact = resolve(
    BACKUPS_DIR,
    fileArg.endsWith('.zip') ? fileArg : `${fileArg}.zip`
  )
  if (existsSync(exact)) return exact

  const matches = readdirSync(BACKUPS_DIR)
    .filter((f) => f.startsWith(fileArg) && f.endsWith('.zip'))
    .sort()

  if (matches.length === 0) {
    fail(`No backup matching "${fileArg}" found in ${BACKUPS_DIR}`)
  }
  if (matches.length > 1) {
    fail(
      `Ambiguous prefix "${fileArg}" matches ${matches.length} backups:\n${matches.map((m) => `  ${m}`).join('\n')}\nUse a more specific prefix.`
    )
  }

  return resolve(BACKUPS_DIR, matches[0])
}

export async function create(): Promise<void> {
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

export async function restore(fileArg: string): Promise<void> {
  const pbUrl = requireEnv('POCKETBASE_EXTERNAL_URL')
  const localPath = resolveBackupFile(fileArg)

  if (!existsSync(localPath)) {
    fail(`Backup file not found: ${localPath}`)
  }

  const filename = localPath.split('/').pop()!
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

export async function load(fileArg: string): Promise<void> {
  const localPath = resolveBackupFile(fileArg)

  if (!existsSync(localPath)) {
    fail(`Backup file not found: ${localPath}`)
  }

  const dbPath = join(DEV_PB_DATA_DIR, 'data.db')
  if (existsSync(dbPath)) {
    let db: Database | null = null
    try {
      db = new Database(dbPath, { readonly: true })
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

export async function list(): Promise<void> {
  if (!existsSync(BACKUPS_DIR)) {
    info('No backups directory found (infra/backups/)')
    info('Run `bun run env:prod bun run infra:backup` to create a backup.')
    return
  }

  const files = readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.zip'))
    .sort()
    .reverse()

  if (files.length === 0) {
    info('No backups found in infra/backups/')
    info('Run `bun run env:prod bun run infra:backup` to create a backup.')
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
