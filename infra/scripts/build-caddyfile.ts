import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fail } from './lib/log'

const PROJECT_ROOT = resolve(import.meta.dir, '../..')
const TEMPLATE = resolve(PROJECT_ROOT, 'infra/caddy/Caddyfile.template')
const OUTPUT = resolve(PROJECT_ROOT, 'dist/Caddyfile')

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
  fail(`Missing required env vars for Caddyfile: ${missing.join(', ')}`)
}

let template = readFileSync(TEMPLATE, 'utf-8')
for (const [key, value] of Object.entries(env)) {
  template = template.split(`__${key}__`).join(value)
}

const unreplaced = template.match(/__[A-Z_]+__/g)
if (unreplaced) {
  fail(`Unreplaced placeholders in Caddyfile: ${unreplaced.join(', ')}`)
}

writeFileSync(OUTPUT, template)

execSync(`caddy fmt --overwrite ${OUTPUT}`, { stdio: 'inherit' })
