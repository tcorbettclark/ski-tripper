import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PROJECT_ROOT = resolve(import.meta.dir, '../..')
const TEMPLATE = resolve(PROJECT_ROOT, 'infra/caddy/Caddyfile.template')
const OUTPUT = resolve(PROJECT_ROOT, 'dist/Caddyfile')

const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function parseArgs(): string | undefined {
  const args = process.argv.slice(2)
  const envFileIdx = args.indexOf('--env-file')
  if (envFileIdx === -1) return undefined
  if (envFileIdx === args.length - 1) {
    console.error(`${RED}${BOLD}Error:${RESET} --env-file requires a path`)
    process.exit(1)
  }
  return resolve(args[envFileIdx + 1])
}

const ENV_FILE = parseArgs()

function loadEnv(envFile: string | undefined): Record<string, string> {
  if (!envFile || !existsSync(envFile)) return {}
  const content = readFileSync(envFile, 'utf-8')
  const env: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    env[key] = val
  }
  return env
}

const env = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined)
  ),
  ...loadEnv(ENV_FILE),
}

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
