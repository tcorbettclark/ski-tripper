import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fail, section, step, success } from './lib/log'

const PROJECT_ROOT = resolve(import.meta.dir, '../..')
const SQUASHED_MIGRATION_NAME = '0000_init_collections.js'
const MIGRATIONS_DIR = resolve(PROJECT_ROOT, 'src/pb_migrations')
const PB_DATA_DIR = resolve(PROJECT_ROOT, 'dev/pb_data')

function runPocketbase(command: string, options?: { autoConfirm?: boolean }) {
  const args = command.split(' ')
  const result = Bun.spawnSync(['pocketbase', ...args], {
    cwd: PROJECT_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: options?.autoConfirm ? Buffer.from('y\n') : undefined,
  })
  if (result.exitCode !== 0) {
    fail(`pocketbase ${command} failed with exit code ${result.exitCode}`)
  }
}

function getJsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.js'))
}

section('Reset & Squash Migrations')

step('Applying all current migrations to dev database...')
runPocketbase(
  `migrate up --dir ${PB_DATA_DIR} --migrationsDir ${MIGRATIONS_DIR}`
)
success('All migrations applied')

const preExistingFiles = getJsFiles(MIGRATIONS_DIR)

step('Generating squashed snapshot from current database state...')
runPocketbase(
  `migrate collections --dir ${PB_DATA_DIR} --migrationsDir ${MIGRATIONS_DIR}`,
  { autoConfirm: true }
)
success('Snapshot generated')

step('Removing old migration files...')
for (const file of preExistingFiles) {
  const filepath = resolve(MIGRATIONS_DIR, file)
  rmSync(filepath)
  success(`Removed ${file}`)
}

const remainingFiles = getJsFiles(MIGRATIONS_DIR)
if (remainingFiles.length !== 1) {
  fail(
    `Expected exactly 1 migration file after cleanup, found ${remainingFiles.length}: ${remainingFiles.join(', ')}`
  )
}

step(`Renaming squashed migration to ${SQUASHED_MIGRATION_NAME}...`)
const squashedFile = remainingFiles[0]
const oldPath = resolve(MIGRATIONS_DIR, squashedFile)
const newPath = resolve(MIGRATIONS_DIR, SQUASHED_MIGRATION_NAME)
if (squashedFile !== SQUASHED_MIGRATION_NAME) {
  renameSync(oldPath, newPath)
  success(`Renamed ${squashedFile} → ${SQUASHED_MIGRATION_NAME}`)
} else {
  success(`Already named ${SQUASHED_MIGRATION_NAME}`)
}

step('Resetting dev database...')
rmSync(PB_DATA_DIR, { recursive: true, force: true })
success('Dev database removed')

step('Applying squashed migration to fresh database...')
runPocketbase(
  `migrate up --dir ${PB_DATA_DIR} --migrationsDir ${MIGRATIONS_DIR}`
)
success('Squashed migration applied to fresh database')

section('Done')
