import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const isDebug = process.argv.includes('--debug')

const ENV_FILE = resolve(import.meta.dir, '../..', '.env')
const CADDY_CMD = 'caddy'
const CADDY_ARGS = ['run']

const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'
const GRAY = '\x1b[90m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'

const levelStyle: Record<string, string> = {
  debug: GRAY,
  info: CYAN,
  warn: YELLOW,
  error: RED,
}

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

function formatAccessLog(entry: Record<string, unknown>) {
  const req = entry.request as Record<string, unknown> | undefined
  const method = (req?.method as string) ?? '?'
  const uri = (req?.uri as string) ?? '?'
  const status = entry.status as number
  const duration = entry.duration as number
  const size = entry.size as number

  const statusColor =
    status >= 500 ? RED : status >= 400 ? YELLOW : status >= 300 ? CYAN : GREEN

  const path = uri.length > 60 ? `${uri.slice(0, 57)}...` : uri
  const dur =
    duration < 0.001
      ? `${Math.round(duration * 1_000_000)}µs`
      : duration < 1
        ? `${(duration * 1000).toFixed(1)}ms`
        : `${duration.toFixed(2)}s`
  const sz =
    size > 1024 * 1024
      ? `${(size / (1024 * 1024)).toFixed(1)}MB`
      : size > 1024
        ? `${(size / 1024).toFixed(1)}KB`
        : `${size}B`

  return `${BOLD}${method}${RESET} ${path} ${statusColor}${status}${RESET} ${DIM}${dur}${RESET} ${DIM}${sz}${RESET}`
}

function formatRuntimeLog(entry: Record<string, unknown>) {
  const level = (entry.level as string) ?? 'info'
  const msg = (entry.msg as string) ?? ''
  const style = levelStyle[level] ?? CYAN

  if (isDebug) {
    const extra = Object.entries(entry)
      .filter(([k]) => !['level', 'ts', 'msg', 'logger'].includes(k))
      .map(([k, v]) => `${DIM}${k}${RESET}=${GRAY}${JSON.stringify(v)}${RESET}`)
      .join(' ')
    return `${style}${level.padEnd(5)}${RESET} ${msg}${extra ? `  ${extra}` : ''}`
  }

  const noisy = [
    'maxprocs',
    'GOMEMLIMIT',
    'adapted config to JSON',
    'admin endpoint started',
    'autosaved config',
    'serving initial configuration',
    'storage cleaning happened too recently',
    'finished cleaning storage units',
  ]
  if (noisy.some((n) => msg.includes(n))) {
    return null
  }

  return `${style}${level.padEnd(5)}${RESET} ${msg}`
}

function handleLine(line: string) {
  if (!line.trim()) return

  try {
    const entry = JSON.parse(line)
    if (entry.msg === 'handled request' && entry.request) {
      const formatted = formatAccessLog(entry)
      if (formatted) console.log(formatted)
    } else {
      const formatted = formatRuntimeLog(entry)
      if (formatted) console.log(formatted)
    }
  } catch {
    if (isDebug) console.log(line)
  }
}

const fileEnv = loadEnv()
const mergedEnv = { ...process.env, ...fileEnv }

const child = spawn(CADDY_CMD, CADDY_ARGS, {
  cwd: resolve(import.meta.dir, '../..', 'output'),
  env: mergedEnv,
  stdio: ['pipe', 'pipe', 'pipe'],
})

child.stderr.on('data', (data: Buffer) => {
  for (const line of data.toString().split('\n')) {
    handleLine(line)
  }
})

child.stdout.on('data', (data: Buffer) => {
  for (const line of data.toString().split('\n')) {
    handleLine(line)
  }
})

child.on('exit', (code) => process.exit(code ?? 0))

process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
