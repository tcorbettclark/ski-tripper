#!/usr/bin/env bun

import { load } from './lib/backup'
import { error, help, info } from './lib/log'

const HELP_TEXT = `Usage: bun run infra:load-backup <file> [options]

Load a backup file into the local dev environment.
Stops any running dev PocketBase before overwriting dev/pb_data/.

Arguments:
  <file>              Backup filename or date-time part (e.g. "2026-03-02_14-34-03")

Options:
  --help, -h          Show this help message

Examples:
  bun run infra:load-backup 2026-03-02_14-34-03`

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  help(HELP_TEXT, 0)
}

const file = args.find((a) => !a.startsWith('-'))
if (!file) {
  error('Missing file argument')
  info('Usage: bun run infra:load-backup <file>')
  process.exit(1)
}

load(file).catch((err) => {
  error(`Backup load failed: ${err}`)
  process.exitCode = 1
})
