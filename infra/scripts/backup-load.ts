#!/usr/bin/env bun

import { load } from './lib/backup'
import { error, help, info } from './lib/log'

const HELP_TEXT = `Usage: bun run infra:load-backup <prefix> [options]

Load a backup file into the local dev environment.
Stops any running dev PocketBase before overwriting dev/pb_data/.

Arguments:
  <prefix>            Backup filename, date-time part, or unique prefix (e.g. "2026-03-02")

Options:
  --help, -h          Show this help message

Examples:
  bun run infra:load-backup 2026-03-02
  bun run infra:load-backup 2026-03-02_14-34-03`

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  help(HELP_TEXT, 0)
}

const prefix = args.find((a) => !a.startsWith('-'))
if (!prefix) {
  error('Missing prefix argument')
  info('Usage: bun run infra:load-backup <prefix>')
  process.exit(1)
}

load(prefix).catch((err) => {
  error(`Backup load failed: ${err}`)
  process.exitCode = 1
})
