import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import type { SSHExecutionContext } from '@xec-sh/core'
import { $, configure, dispose } from '@xec-sh/core'
import JSON5 from 'json5'
import { fail, info, retrying, step, success } from './log'

configure({ timeout: 600000 })

export const PROJECT_ROOT = resolve(import.meta.dir, '../../..')

const config = JSON5.parse(
  readFileSync(resolve(PROJECT_ROOT, 'infra/config.jsonc'), 'utf-8')
)

export const DROPLET_NAME = config.dropletName
export const DROPLET_SIZE = config.dropletSize
export const DROPLET_REGION = config.dropletRegion
export const DROPLET_IMAGE = config.dropletImage
export const SWAP_SIZE_MB = config.swapSizeMb
export const RESERVED_IP_REGION = DROPLET_REGION

export const BUN_VERSION = config.bunVersion
export const POCKETBASE_VERSION = config.pocketbaseVersion
export const CADDY_VERSION = config.caddyVersion

export const REPO_DIR = config.repoDir
export const INSTALL_DIR = config.installDir
export const REPO_URL = config.repoUrl

export const FINGERPRINT_PATH = `${config.installDir}/provision-fingerprint.json`

const PROVISION_CONFIG_KEYS = [
  'bunVersion',
  'pocketbaseVersion',
  'caddyVersion',
  'swapSizeMb',
  'repoDir',
  'installDir',
] as const

export interface ProvisionFingerprint {
  timestamp: string
  git: {
    branch: string | null
    commit: string
    tag: string | null
  }
  config: Record<(typeof PROVISION_CONFIG_KEYS)[number], string | number>
}

export { $, configure, dispose }

export function buildFingerprint(): ProvisionFingerprint {
  const gitCommit = execSync('git rev-parse --short HEAD', {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
  }).trim()
  const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
  }).trim()
  const gitTag =
    execSync('git tag --points-at HEAD', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
    }).trim() || null

  const fingerprintConfig: Record<string, string | number> = {}
  for (const key of PROVISION_CONFIG_KEYS) {
    fingerprintConfig[key] = config[key]
  }

  return {
    timestamp: new Date().toISOString(),
    git: { branch: gitBranch, commit: gitCommit, tag: gitTag },
    config: fingerprintConfig,
  }
}

export async function writeFingerprint(
  root: SSHExecutionContext
): Promise<void> {
  const fingerprint = buildFingerprint()
  const content = JSON.stringify(fingerprint, null, 2)
  const b64 = Buffer.from(content).toString('base64')
  await root`bash -c "echo ${b64} | base64 -d > ${FINGERPRINT_PATH}"`
  success(`Provision fingerprint written to ${FINGERPRINT_PATH}`)
  info(
    `  Config: bun=${fingerprint.config.bunVersion} pb=${fingerprint.config.pocketbaseVersion} caddy=${fingerprint.config.caddyVersion}`
  )
  info(
    `  Git: ${fingerprint.git.commit} (${fingerprint.git.tag ?? fingerprint.git.branch})`
  )
}

export async function checkFingerprint(
  root: SSHExecutionContext
): Promise<void> {
  step('Checking provision fingerprint')
  const exists =
    (await root`test -f ${FINGERPRINT_PATH}`.nothrow()).exitCode === 0
  if (!exists) {
    fail(
      `Server not provisioned. ${FINGERPRINT_PATH} not found.\n` +
        `Run 'bun run infra:provision configure' first.`
    )
  }

  const raw = await root`cat ${FINGERPRINT_PATH}`.text()
  let serverFingerprint: ProvisionFingerprint
  try {
    serverFingerprint = JSON.parse(raw)
  } catch {
    fail(
      `Corrupt provision fingerprint at ${FINGERPRINT_PATH}:\n${raw}\n` +
        `Re-run 'bun run infra:provision configure' to fix.`
    )
  }

  const localFingerprint = buildFingerprint()

  const serverConfig = serverFingerprint.config
  const localConfig = localFingerprint.config
  const mismatches: string[] = []
  for (const key of PROVISION_CONFIG_KEYS) {
    if (serverConfig[key] !== localConfig[key]) {
      mismatches.push(
        `  ${key}: server=${serverConfig[key]} local=${localConfig[key]}`
      )
    }
  }

  if (mismatches.length > 0) {
    fail(
      `Provision config mismatch (server vs local config):\n${mismatches.join('\n')}\n` +
        `Re-run 'bun run infra:provision configure' to update.`
    )
  }

  if (serverFingerprint.git) {
    const gitInfo = serverFingerprint.git
    info(
      `  Server provisioned at ${serverFingerprint.timestamp} from ${gitInfo.commit} (${gitInfo.tag ?? gitInfo.branch ?? 'detached'})`
    )
  }
  success('Provision fingerprint matches')
}

const APT_LOCK_PATTERNS = [
  'Could not get lock',
  'dpkg lock',
  'lock-frontend',
  'Resource temporarily unavailable',
  'Unable to acquire the dpkg lock',
  'Could not open lock file',
]

export async function withAptRetry<T>(
  run: () => Promise<T>,
  maxAttempts = 60,
  delayMs = 5000
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run()
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message +
            (err.cause instanceof Error ? `\n${err.cause.message}` : '')
          : String(err)
      const isLockError = APT_LOCK_PATTERNS.some((p) =>
        message.toLowerCase().includes(p.toLowerCase())
      )
      if (!isLockError || attempt >= maxAttempts) {
        throw err
      }
      if (attempt === 0) {
        retrying('Apt lock busy, retrying...')
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

function getDefaultPrivateKey(): string | undefined {
  const keyPath = resolve(homedir(), '.ssh', 'id_rsa')
  const edKeyPath = resolve(homedir(), '.ssh', 'id_ed25519')
  for (const path of [edKeyPath, keyPath]) {
    if (existsSync(path)) return readFileSync(path, 'utf-8')
  }
  return undefined
}

export const SSH_KEY = getDefaultPrivateKey()

export async function requireDoctl() {
  const result = await $`doctl version`.nothrow().text()
  if (!result.includes('doctl')) {
    fail(
      'doctl is not installed. Install it: https://docs.digitalocean.com/reference/doctl/'
    )
  }
}

export async function getDropletId(): Promise<string> {
  const result =
    await $`doctl compute droplet get ${DROPLET_NAME} --format ID --no-header`.text()
  const id = result.trim()
  if (!id) {
    fail('Could not determine droplet ID. Is the droplet running?')
  }
  return id
}

export async function getReservedIp(): Promise<string | undefined> {
  const result =
    await $`doctl compute reserved-ip list --format IP,Region --no-header`
      .nothrow()
      .text()
  const line = result.split('\n').find((l) => l.includes(RESERVED_IP_REGION))
  return line?.split(/\s+/)[0] || undefined
}

export async function getDropletIp(): Promise<string> {
  const reservedIp = await getReservedIp()
  if (reservedIp) {
    return reservedIp
  }
  const result =
    await $`doctl compute droplet get ${DROPLET_NAME} --format PublicIPv4 --no-header`.text()
  const ip = result.trim()
  if (!ip) {
    fail('Could not determine droplet IP. Is the droplet running?')
  }
  return ip
}

export async function scanHostKey(ip: string) {
  step('Adding droplet host key to known_hosts')
  await $`ssh-keyscan -H ${ip} >> ~/.ssh/known_hosts`.nothrow()
  success('Host key added')
}

export async function waitForSsh(ip: string) {
  step('Waiting for SSH to become available')
  for (let i = 0; i < 30; i++) {
    try {
      const result =
        await $`ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@${ip} echo ok`
          .nothrow()
          .text()
      if (result.trim() === 'ok') {
        success('SSH available')
        return
      }
    } catch {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
  fail('Timed out waiting for SSH')
}

export function getRootSsh(ip: string) {
  return $.ssh({
    host: ip,
    username: 'root',
    privateKey: SSH_KEY,
  }).timeout(300000)
}

export function getAppSsh(ip: string) {
  return $.ssh({
    host: ip,
    username: 'ski-tripper',
    privateKey: SSH_KEY,
  }).timeout(300000)
}
