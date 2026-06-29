#!/usr/bin/env bun

import { dispose, getDropletIp, getRootSsh } from './lib/infra'
import { error, fail, help, notice, step, success, warn } from './lib/log'

const PB_INCLUDES_DIR = '/etc/caddy/pb-includes'
const BLOCK_ADMIN_FILE = 'block-pb-admin.caddy'
const BLOCK_ADMIN_PATH = `${PB_INCLUDES_DIR}/${BLOCK_ADMIN_FILE}`
const BLOCK_ADMIN_DISABLED_PATH = `${PB_INCLUDES_DIR}/${BLOCK_ADMIN_FILE}.disabled`

const HELP_TEXT = `Usage: bun run infra:mode <command>

Commands:
  debug   Enable PocketBase admin UI (renames ${BLOCK_ADMIN_FILE} to .disabled, reloads Caddy)
  prod    Block PocketBase admin UI (renames ${BLOCK_ADMIN_FILE} back, reloads Caddy)

The admin UI is blocked in production by ${BLOCK_ADMIN_PATH}, a Caddy include file
that returns 403 for /_/* requests on the PocketBase domain. This script toggles
that file by renaming it with a .disabled suffix.

After toggling, Caddy is reloaded (not restarted) for zero-downtime config
changes. Deploying with infra:deploy always resets to prod mode.`

async function modeDebug() {
  const ip = await getDropletIp()
  step(`Connecting to ${ip}`)
  const root = getRootSsh(ip)

  const disabledExists =
    (await root`test -f ${BLOCK_ADMIN_DISABLED_PATH}`.nothrow()).exitCode === 0
  const enabledExists =
    (await root`test -f ${BLOCK_ADMIN_PATH}`.nothrow()).exitCode === 0

  if (disabledExists && !enabledExists) {
    warn('Already in debug mode — admin UI is accessible')
    return
  }

  if (enabledExists) {
    await root`mv ${BLOCK_ADMIN_PATH} ${BLOCK_ADMIN_DISABLED_PATH}`
    success(`Renamed ${BLOCK_ADMIN_FILE} → ${BLOCK_ADMIN_FILE}.disabled`)
  } else {
    warn(
      `Neither ${BLOCK_ADMIN_PATH} nor ${BLOCK_ADMIN_DISABLED_PATH} found. Creating disabled placeholder.`
    )
    await root`mkdir -p ${PB_INCLUDES_DIR}`
    await root`touch ${BLOCK_ADMIN_DISABLED_PATH}`
  }

  await root`systemctl reload caddy`
  success('Caddy reloaded')
  notice('Admin UI is now accessible at the PocketBase domain.')
  warn('Run bun run infra:mode prod to block it again.')
}

async function modeProd() {
  const ip = await getDropletIp()
  step(`Connecting to ${ip}`)
  const root = getRootSsh(ip)

  const enabledExists =
    (await root`test -f ${BLOCK_ADMIN_PATH}`.nothrow()).exitCode === 0
  const disabledExists =
    (await root`test -f ${BLOCK_ADMIN_DISABLED_PATH}`.nothrow()).exitCode === 0

  if (enabledExists && !disabledExists) {
    success('Already in prod mode — admin UI is blocked')
    return
  }

  if (disabledExists) {
    await root`mv ${BLOCK_ADMIN_DISABLED_PATH} ${BLOCK_ADMIN_PATH}`
    success(`Renamed ${BLOCK_ADMIN_FILE}.disabled → ${BLOCK_ADMIN_FILE}`)
  } else if (!enabledExists) {
    fail(
      `No file found at ${BLOCK_ADMIN_PATH} or ${BLOCK_ADMIN_DISABLED_PATH}. Run \`bun run env:prod bun run infra:deploy\` to deploy first.`
    )
  }

  await root`systemctl reload caddy`
  success('Caddy reloaded')
  notice('Admin UI is now blocked (prod mode).')
}

async function main() {
  const command = process.argv[2]

  if (!command || command === '--help' || command === '-h') {
    help(HELP_TEXT, command ? 0 : 1)
  }

  switch (command) {
    case 'debug':
      await modeDebug()
      break
    case 'prod':
      await modeProd()
      break
    default:
      error(`Unknown command: ${command}`)
      help(HELP_TEXT, 1)
  }
}

main()
  .catch((err) => {
    error(String(err))
    process.exitCode = 1
  })
  .finally(() => dispose())
