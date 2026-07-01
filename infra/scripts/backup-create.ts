#!/usr/bin/env bun

import { create } from './lib/backup'
import { error, help } from './lib/log'

const HELP_TEXT = `Usage: bun run env:prod bun run infra:backup [options]

Create a backup from production PocketBase and download it locally.
The backup file is saved to infra/backups/.

Options:
  --help, -h          Show this help message

Examples:
  bun run env:prod bun run infra:backup`

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  help(HELP_TEXT, 0)
}

create().catch((err) => {
  error(`Backup create failed: ${err}`)
  process.exitCode = 1
})
