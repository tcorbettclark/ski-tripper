#!/usr/bin/env bun

import { restore } from './lib/backup'
import { error, help, info } from './lib/log'

const HELP_TEXT = `Usage: bun run env:prod bun run infra:restore <file> [options]

Restore a backup file to production PocketBase.
This will overwrite all production data — use with caution!

Arguments:
  <file>              Backup filename or date-time part (e.g. "2026-03-02_14-34-03")

Options:
  --help, -h          Show this help message

Examples:
  bun run env:prod bun run infra:restore 2026-03-02_14-34-03`

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  help(HELP_TEXT, 0)
}

const file = args.find((a) => !a.startsWith('-'))
if (!file) {
  error('Missing file argument')
  info('Usage: bun run env:prod bun run infra:restore <file>')
  process.exit(1)
}

restore(file).catch((err) => {
  error(`Backup restore failed: ${err}`)
  process.exitCode = 1
})
