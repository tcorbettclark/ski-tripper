#!/usr/bin/env bun

import { list } from './lib/backup'
import { error, help } from './lib/log'

const HELP_TEXT = `Usage: bun run infra:list-backups [options]

List available backup files in infra/backups/ with record counts
for each collection (users, trips, proposals, polls).

Options:
  --help, -h          Show this help message

Examples:
  bun run infra:list-backups`

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  help(HELP_TEXT, 0)
}

list().catch((err) => {
  error(`Backup list failed: ${err}`)
  process.exitCode = 1
})
