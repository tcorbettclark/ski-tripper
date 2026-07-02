import { fail, section, step, success } from './lib/log'

const VALID_BUMPS = ['major', 'minor', 'patch'] as const
type Bump = (typeof VALID_BUMPS)[number]

const HELP_TEXT = `Usage: bun run version:bump <major|minor|patch>

Bumps the project version using bun pm version, which also runs the
preversion checks (typecheck, lint, tests) and creates a git commit and tag.

Fails early if run inside a git worktree, since bun pm version cannot
create git commits from worktrees.

Options:
  --help, -h    Show this help message

Examples:
  bun run version:bump patch
  bun run version:bump minor
  bun run version:bump major`

function isWorktree(): boolean {
  const gitDir = Bun.spawnSync(['git', 'rev-parse', '--git-dir'], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (gitDir.exitCode !== 0) return true
  const dir = gitDir.stdout.toString().trim()
  return dir !== '.git'
}

section('Version Bump')

const arg = process.argv[2]
if (arg === '--help' || arg === '-h') {
  console.log(`\n${HELP_TEXT}\n`)
  process.exit(0)
}

if (!arg || !VALID_BUMPS.includes(arg as Bump)) {
  fail(`Expected major, minor, or patch but got: ${arg ?? '(none)'}`)
}

step('Checking git worktree status')
if (isWorktree()) {
  fail('Cannot bump version in a git worktree. Run from the main working tree.')
}
success('Not in a worktree')

step(`Bumping ${arg} version`)
const result = Bun.spawnSync(['bun', 'pm', 'version', arg], {
  stdout: 'inherit',
  stderr: 'inherit',
})
if (result.exitCode !== 0) {
  fail(`bun pm version ${arg} failed with exit code ${result.exitCode}`)
}

success(`Version bumped`)
