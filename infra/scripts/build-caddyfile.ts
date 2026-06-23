import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PROJECT_ROOT = resolve(import.meta.dir, '../..')
const TEMPLATE = resolve(PROJECT_ROOT, 'infra/caddy/Caddyfile.template')
const OUTPUT = resolve(PROJECT_ROOT, 'dist/Caddyfile')

const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const env = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== undefined)
) as Record<string, string>

const requiredVars = [
  'PUBLIC_DOMAIN',
  'PUBLIC_POCKETBASE_DOMAIN',
  'SERVER_HOSTNAME',
  'SERVER_PORT',
  'POCKETBASE_HOSTNAME',
  'POCKETBASE_PORT',
  'STATIC_ROOT',
]

const missing = requiredVars.filter((v) => !env[v])
if (missing.length > 0) {
  console.error(
    `${RED}${BOLD}Error:${RESET} Missing required env vars for Caddyfile:`
  )
  for (const v of missing) {
    console.error(`  ${v}`)
  }
  process.exit(1)
}

let template = readFileSync(TEMPLATE, 'utf-8')
for (const [key, value] of Object.entries(env)) {
  template = template.split(`__${key}__`).join(value)
}

const unreplaced = template.match(/__[A-Z_]+__/g)
if (unreplaced) {
  console.error(
    `${RED}${BOLD}Error:${RESET} Unreplaced placeholders in Caddyfile: ${unreplaced.join(', ')}`
  )
  process.exit(1)
}

writeFileSync(OUTPUT, template)

execSync(`caddy fmt --overwrite ${OUTPUT}`, { stdio: 'inherit' })
