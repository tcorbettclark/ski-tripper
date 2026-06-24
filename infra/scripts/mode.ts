#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { $, configure, dispose } from '@xec-sh/core'

const DROPLET_NAME = 'ski-tripper'

const PB_INCLUDES_DIR = '/etc/caddy/pb-includes'
const BLOCK_ADMIN_FILE = 'block-pb-admin.caddy'
const BLOCK_ADMIN_PATH = `${PB_INCLUDES_DIR}/${BLOCK_ADMIN_FILE}`
const BLOCK_ADMIN_DISABLED_PATH = `${PB_INCLUDES_DIR}/${BLOCK_ADMIN_FILE}.disabled`

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

configure({ timeout: 60000 })

function getDefaultPrivateKey(): string | undefined {
  const keyPath = resolve(homedir(), '.ssh', 'id_rsa')
  const edKeyPath = resolve(homedir(), '.ssh', 'id_ed25519')
  for (const path of [edKeyPath, keyPath]) {
    if (existsSync(path)) return readFileSync(path, 'utf-8')
  }
  return undefined
}

const SSH_KEY = getDefaultPrivateKey()

async function getDropletIp(): Promise<string> {
  const result =
    await $`doctl compute droplet get ${DROPLET_NAME} --format PublicIPv4 --no-header`.text()
  const ip = result.trim()
  if (!ip) {
    console.error(`${RED}${BOLD}Error:${RESET} Could not determine droplet IP`)
    process.exit(1)
  }
  return ip
}

async function ssh(ip: string) {
  return $.ssh({
    host: ip,
    username: 'root',
    privateKey: SSH_KEY,
  }).timeout(30000)
}

function printHelp() {
  console.log(`Usage: bun run infra:mode <command>

Commands:
  debug   Enable PocketBase admin UI (renames ${BLOCK_ADMIN_FILE} to .disabled, reloads Caddy)
  prod    Block PocketBase admin UI (renames ${BLOCK_ADMIN_FILE} back, reloads Caddy)

The admin UI is blocked in production by ${BLOCK_ADMIN_PATH}, a Caddy include file
that returns 403 for /_/* requests on the PocketBase domain. This script toggles
that file by renaming it with a .disabled suffix.

After toggling, Caddy is reloaded (not restarted) for zero-downtime config
changes. Deploying with infra:provision always resets to prod mode.`)
}

async function modeDebug() {
  const ip = await getDropletIp()
  console.log(`\n${BOLD}Connecting to ${ip}...${RESET}`)
  const root = await ssh(ip)

  const disabledExists =
    (await root`test -f ${BLOCK_ADMIN_DISABLED_PATH}`.nothrow()).exitCode === 0
  const enabledExists =
    (await root`test -f ${BLOCK_ADMIN_PATH}`.nothrow()).exitCode === 0

  if (disabledExists && !enabledExists) {
    console.log(
      `${YELLOW}Already in debug mode — admin UI is accessible${RESET}`
    )
    return
  }

  if (enabledExists) {
    await root`mv ${BLOCK_ADMIN_PATH} ${BLOCK_ADMIN_DISABLED_PATH}`
    console.log(
      `${GREEN}Renamed ${BLOCK_ADMIN_FILE} → ${BLOCK_ADMIN_FILE}.disabled${RESET}`
    )
  } else {
    console.log(
      `${YELLOW}Warning: Neither ${BLOCK_ADMIN_PATH} nor ${BLOCK_ADMIN_DISABLED_PATH} found. Creating disabled placeholder.${RESET}`
    )
    await root`mkdir -p ${PB_INCLUDES_DIR}`
    await root`touch ${BLOCK_ADMIN_DISABLED_PATH}`
  }

  await root`systemctl reload caddy`
  console.log(`${GREEN}Caddy reloaded${RESET}`)
  console.log(
    `\n${BOLD}${YELLOW}Admin UI is now accessible at the PocketBase domain.${RESET}`
  )
  console.log(
    `${YELLOW}Run ${BOLD}bun run infra:mode prod${RESET}${YELLOW} to block it again.${RESET}\n`
  )
}

async function modeProd() {
  const ip = await getDropletIp()
  console.log(`\n${BOLD}Connecting to ${ip}...${RESET}`)
  const root = await ssh(ip)

  const enabledExists =
    (await root`test -f ${BLOCK_ADMIN_PATH}`.nothrow()).exitCode === 0
  const disabledExists =
    (await root`test -f ${BLOCK_ADMIN_DISABLED_PATH}`.nothrow()).exitCode === 0

  if (enabledExists && !disabledExists) {
    console.log(`${GREEN}Already in prod mode — admin UI is blocked${RESET}`)
    return
  }

  if (disabledExists) {
    await root`mv ${BLOCK_ADMIN_DISABLED_PATH} ${BLOCK_ADMIN_PATH}`
    console.log(
      `${GREEN}Renamed ${BLOCK_ADMIN_FILE}.disabled → ${BLOCK_ADMIN_FILE}${RESET}`
    )
  } else if (!enabledExists) {
    console.log(
      `${RED}${BOLD}Error:${RESET} No file found at ${BLOCK_ADMIN_PATH} or ${BLOCK_ADMIN_DISABLED_PATH}`
    )
    console.log(
      `  Run ${BOLD}bun run infra:provision deploy${RESET} to deploy the snippet first.`
    )
    process.exit(1)
  }

  await root`systemctl reload caddy`
  console.log(`${GREEN}Caddy reloaded${RESET}`)
  console.log(`\n${GREEN}${BOLD}Admin UI is now blocked (prod mode).${RESET}\n`)
}

async function main() {
  const command = process.argv[2]

  if (!command || command === '--help' || command === '-h') {
    printHelp()
    process.exit(command ? 0 : 1)
  }

  switch (command) {
    case 'debug':
      await modeDebug()
      break
    case 'prod':
      await modeProd()
      break
    default:
      console.log(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

main()
  .catch((err) => {
    console.error(`\n${RED}${BOLD}Error:${RESET} ${err}`)
    process.exitCode = 1
  })
  .finally(() => dispose())
