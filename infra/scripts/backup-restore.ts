#!/usr/bin/env bun

import { restore } from './lib/backup'
import { error, help, info } from './lib/log'

const HELP_TEXT = `Usage: bun run env:prod bun run infra:restore <prefix> [options]

Restore a backup file to production PocketBase.
This will overwrite all production data — use with caution!

Arguments:
  <prefix>            Backup filename, date-time part, or unique prefix (e.g. "2026-03-02")

Options:
  --help, -h          Show this help message

Examples:
  bun run env:prod bun run infra:restore 2026-03-02
  bun run env:prod bun run infra:restore 2026-03-02_14-34-03`

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  help(HELP_TEXT, 0)
}

const prefix = args.find((a) => !a.startsWith('-'))
if (!prefix) {
  error('Missing prefix argument')
  info('Usage: bun run env:prod bun run infra:restore <prefix>')
  process.exit(1)
}

restore(prefix).catch((err) => {
  error(`Backup restore failed: ${err}`)
  process.exitCode = 1
})
