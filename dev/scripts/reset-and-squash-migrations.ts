import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { error, fail, section, step, success, warn } from './lib/log'

const PROJECT_ROOT = resolve(import.meta.dir, '../..')
const SQUASHED_MIGRATION_NAME = '0000_init_collections.js'
const MIGRATIONS_DIR = resolve(PROJECT_ROOT, 'src/pb_migrations')
const PB_DATA_DIR = resolve(PROJECT_ROOT, 'dev/pb_data')

function runPocketbase(
  command: string,
  options?: { autoConfirm?: boolean }
): void {
  const args = command.split(' ')
  const result = Bun.spawnSync(['pocketbase', ...args], {
    cwd: PROJECT_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: options?.autoConfirm ? Buffer.from('y\n') : undefined,
  })
  const isPromptLine = (l: string) =>
    l.startsWith('Do you really want') || /^\(y\/N\)/.test(l)
  const filterOutput = (raw: string): string[] =>
    raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !isPromptLine(l))

  const outLines = filterOutput(result.stdout.toString())
  const errLines = filterOutput(result.stderr.toString())

  if (result.exitCode !== 0) {
    for (const line of errLines) error(line)
    fail(`pocketbase ${command} failed with exit code ${result.exitCode}`)
  }

  for (const line of outLines) success(line)
  for (const line of errLines) success(line)
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

step('Formatting squashed migration...')
const squashedPath = resolve(MIGRATIONS_DIR, SQUASHED_MIGRATION_NAME)
const biomeResult = Bun.spawnSync(
  ['bun', 'biome', 'check', '--write', '--unsafe', squashedPath],
  { cwd: PROJECT_ROOT, stdout: 'pipe', stderr: 'pipe' }
)
if (biomeResult.exitCode !== 0) {
  fail(
    `biome check failed with exit code ${biomeResult.exitCode}: ${biomeResult.stderr.toString().trim()}`
  )
}
success('Formatted squashed migration')

section('Manual considerations')
step('Migration')
warn('If other environments have existing _migrations tables, run:')
warn('  pocketbase migrate history-sync')
warn(
  'This removes entries for deleted migration files that are now baked into the squashed snapshot.'
)
