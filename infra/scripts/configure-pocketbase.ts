import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import JSON5 from 'json5'
import PocketBase from 'pocketbase'

const PROJECT_ROOT = resolve(import.meta.dir, '../..')
const SETTINGS_FILE = resolve(PROJECT_ROOT, 'infra/pocketbase/settings.json5')
const EMAIL_TEMPLATES_FILE = resolve(
  PROJECT_ROOT,
  'infra/pocketbase/email-templates.json5'
)

function parseArgs(): string {
  const args = process.argv.slice(2)
  const envFileIdx = args.indexOf('--env-file')
  if (envFileIdx === -1 || envFileIdx === args.length - 1) {
    console.error(
      `${RED}${BOLD}Usage:${RESET} bun run pb:config --env-file <path>`
    )
    console.error(
      `${RED}${BOLD}Error:${RESET} --env-file is required (e.g. --env-file .env or --env-file /opt/ski-tripper/.env)`
    )
    process.exit(1)
  }
  return resolve(args[envFileIdx + 1])
}

const ENV_FILE = parseArgs()

const BOLD = '\x1b[1m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const RESET = '\x1b[0m'

const OVERRIDES: Record<
  string,
  { env: string; type: 'string' | 'number' | 'boolean' }
> = {
  'smtp.host': { env: 'SMTP_HOST', type: 'string' },
  'smtp.port': { env: 'SMTP_PORT', type: 'number' },
  'smtp.username': { env: 'SMTP_USERNAME', type: 'string' },
  'smtp.password': { env: 'SMTP_PASSWORD', type: 'string' },
  'smtp.localName': { env: 'SMTP_LOCAL_NAME', type: 'string' },
  'smtp.tls': { env: 'SMTP_TLS', type: 'boolean' },
  'meta.appURL': { env: 'APP_URL', type: 'string' },
  'meta.senderAddress': { env: 'SENDER_ADDRESS', type: 'string' },
  'meta.hideControls': { env: 'HIDE_CONTROLS', type: 'boolean' },
}

const SENSITIVE_KEYS = new Set([
  'smtp.password',
  's3.secret',
  'backups.s3.secret',
])

function loadEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {}
  const content = readFileSync(ENV_FILE, 'utf-8')
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

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = path.split('.')
  let current: Record<string, unknown> = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current) || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {}
    }
    current = current[keys[i]] as Record<string, unknown>
  }
  current[keys[keys.length - 1]] = value
}

function interpolateSettings(
  settings: Record<string, unknown>,
  env: Record<string, string>
): Record<string, unknown> {
  const missing: string[] = []

  for (const [path, { env: envVar, type }] of Object.entries(OVERRIDES)) {
    const value = env[envVar]
    if (value === undefined) {
      missing.push(envVar)
      continue
    }

    let resolved: unknown
    switch (type) {
      case 'number':
        resolved = Number(value)
        if (Number.isNaN(resolved)) {
          console.error(
            `${RED}${BOLD}Error:${RESET} ${envVar}="${value}" is not a valid number`
          )
          process.exit(1)
        }
        break
      case 'boolean':
        resolved = value === 'true'
        break
      default:
        resolved = value
    }
    setNestedValue(settings, path, resolved)
  }

  if (missing.length > 0) {
    console.error(
      `${RED}${BOLD}Error:${RESET} Missing required environment variables:`
    )
    for (const v of missing) {
      console.error(`  ${YELLOW}${v}${RESET}`)
    }
    console.error(`\nSet them in ${ENV_FILE} and try again.`)
    process.exit(1)
  }

  return settings
}

function maskValue(path: string, value: unknown): string {
  if (SENSITIVE_KEYS.has(path)) return '***'
  const str = String(value)
  if (str.length > 80) return `${str.slice(0, 77)}...`
  return str
}

function deepDiff(
  desired: Record<string, unknown>,
  current: Record<string, unknown>,
  prefix = ''
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  for (const key of Object.keys(desired)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    const desiredVal = desired[key]
    const currentVal = current[key]

    if (
      desiredVal !== null &&
      typeof desiredVal === 'object' &&
      !Array.isArray(desiredVal)
    ) {
      const nested = deepDiff(
        desiredVal as Record<string, unknown>,
        (currentVal ?? {}) as Record<string, unknown>,
        fullPath
      )
      Object.assign(changes, nested)
    } else if (JSON.stringify(desiredVal) !== JSON.stringify(currentVal)) {
      // PocketBase masks secret fields in GET responses (returns undefined).
      // Skip comparison for secrets when the current value is masked,
      // since we can't determine if they actually changed.
      if (SENSITIVE_KEYS.has(fullPath) && currentVal === undefined) continue
      changes[fullPath] = { old: currentVal, new: desiredVal }
    }
  }

  return changes
}

function buildPatch(
  changes: Record<string, { old: unknown; new: unknown }>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const [path, { new: value }] of Object.entries(changes)) {
    setNestedValue(patch, path, value)
  }
  return patch
}

async function waitForPocketBase(
  url: string,
  maxAttempts = 30,
  delayMs = 1000
): Promise<void> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok) {
        console.log(
          `${GREEN}PocketBase is healthy${RESET} (attempt ${i}/${maxAttempts})`
        )
        return
      }
    } catch {
      // not ready yet
    }
    if (i < maxAttempts) {
      process.stdout.write(
        `Waiting for PocketBase at ${url}... (attempt ${i}/${maxAttempts})\r`
      )
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  console.error(
    `${RED}${BOLD}Error:${RESET} PocketBase did not become healthy after ${maxAttempts} attempts`
  )
  process.exit(1)
}

async function main() {
  const env: Record<string, string> = {
    ...(Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== undefined)
    ) as Record<string, string>),
    ...loadEnv(),
  }

  if (!existsSync(SETTINGS_FILE)) {
    console.error(`${RED}${BOLD}Error:${RESET} ${SETTINGS_FILE} not found`)
    process.exit(1)
  }

  const rawSettings = JSON5.parse(
    readFileSync(SETTINGS_FILE, 'utf-8')
  ) as Record<string, unknown>
  const desiredSettings = interpolateSettings(rawSettings, env)

  const hostname = env.POCKETBASE_HOSTNAME || '127.0.0.1'
  const port = env.POCKETBASE_PORT || '8090'
  const pbUrl = `http://${hostname}:${port}`

  console.log(`Connecting to PocketBase at ${pbUrl}`)
  await waitForPocketBase(pbUrl)

  const adminEmail = env.POCKETBASE_ADMIN_EMAIL
  const adminPassword = env.POCKETBASE_ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) {
    console.error(
      `${RED}${BOLD}Error:${RESET} POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set`
    )
    process.exit(1)
  }

  console.log('Authenticating as superuser...')
  const pb = new PocketBase(pbUrl)
  try {
    await pb
      .collection('_superusers')
      .authWithPassword(adminEmail, adminPassword)
  } catch (err) {
    console.error(`${RED}${BOLD}Error:${RESET} Authentication failed: ${err}`)
    process.exit(1)
  }

  console.log('Fetching current settings...')
  const currentSettings = (await pb.send('/api/settings', {
    method: 'GET',
  })) as Record<string, unknown>

  const changes = deepDiff(desiredSettings, currentSettings)
  const changeCount = Object.keys(changes).length

  if (changeCount === 0) {
    console.log(
      `${GREEN}No changes needed — settings are already up to date${RESET}`
    )
    return
  }

  console.log(`\n${BOLD}Applying ${changeCount} setting change(s):${RESET}`)
  for (const [path, { old, new: newVal }] of Object.entries(changes)) {
    console.log(
      `  ${path}: ${maskValue(path, old)} → ${maskValue(path, newVal)}`
    )
  }

  const patch = buildPatch(changes)
  await pb.send('/api/settings', {
    method: 'PATCH',
    body: patch,
  })

  console.log(
    `\n${GREEN}${BOLD}Done${RESET} — ${changeCount} setting(s) updated successfully`
  )

  // Apply email templates
  if (existsSync(EMAIL_TEMPLATES_FILE)) {
    await applyEmailTemplates(pb)
  } else {
    console.log(
      `\n${YELLOW}Skipping email templates${RESET} — ${EMAIL_TEMPLATES_FILE} not found`
    )
  }
}

async function applyEmailTemplates(pb: PocketBase): Promise<void> {
  const templates = JSON5.parse(
    readFileSync(EMAIL_TEMPLATES_FILE, 'utf-8')
  ) as Record<string, Record<string, { subject: string; body: string }>>

  const collectionNames = Object.keys(templates)
  if (collectionNames.length === 0) return

  let totalChanges = 0

  for (const collectionName of collectionNames) {
    const desired = templates[collectionName]
    const templateKeys = Object.keys(desired)
    if (templateKeys.length === 0) continue

    const current = (await pb.send(
      `/api/collections/${encodeURIComponent(collectionName)}`,
      { method: 'GET' }
    )) as Record<string, unknown>

    const patch: Record<string, unknown> = {}

    for (const key of templateKeys) {
      const desiredTemplate = desired[key]
      const currentTemplate = current[key] as
        | { subject: string; body: string }
        | undefined

      if (
        !currentTemplate ||
        currentTemplate.subject !== desiredTemplate.subject ||
        currentTemplate.body !== desiredTemplate.body
      ) {
        patch[key] = desiredTemplate
      }
    }

    if (Object.keys(patch).length === 0) continue

    console.log(
      `\n${BOLD}Applying email templates for ${collectionName}:${RESET}`
    )
    for (const [key, template] of Object.entries(patch)) {
      const t = template as { subject: string; body: string }
      const old = current[key] as { subject: string; body: string } | undefined
      const oldSubject = old?.subject ?? '(none)'
      const oldBody = old?.body ?? '(none)'
      console.log(
        `  ${key}.subject: ${maskValue(`${collectionName}.${key}.subject`, oldSubject)} → ${maskValue(`${collectionName}.${key}.subject`, t.subject)}`
      )
      console.log(
        `  ${key}.body: ${maskValue(`${collectionName}.${key}.body`, oldBody)} → ${maskValue(`${collectionName}.${key}.body`, t.body)}`
      )
    }

    await pb.send(`/api/collections/${encodeURIComponent(collectionName)}`, {
      method: 'PATCH',
      body: patch,
    })

    totalChanges += Object.keys(patch).length
  }

  if (totalChanges === 0) {
    console.log(
      `${GREEN}No changes needed — email templates are already up to date${RESET}`
    )
  } else {
    console.log(
      `\n${GREEN}${BOLD}Done${RESET} — ${totalChanges} email template(s) updated successfully`
    )
  }
}

main().catch((err) => {
  console.error(`${RED}${BOLD}Error:${RESET} ${err}`)
  process.exit(1)
})
