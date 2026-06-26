import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { $, configure, dispose } from '@xec-sh/core'
import { fail, step, success, warn } from './log'

configure({ timeout: 600000 })

export const PROJECT_ROOT = resolve(import.meta.dir, '../../..')

export const DROPLET_NAME = 'ski-tripper'
export const DROPLET_SIZE = 's-1vcpu-1gb'
export const DROPLET_REGION = 'lon1'
export const DROPLET_IMAGE = 'ubuntu-24-04-x64'
export const SWAP_SIZE_MB = 1024
export const RESERVED_IP_REGION = DROPLET_REGION

export const BUN_VERSION = '1.3.14'
export const POCKETBASE_VERSION = '0.39.4'
export const CADDY_VERSION = '2.11.4'

export const REPO_DIR = '/home/ski-tripper/ski-tripper'
export const INSTALL_DIR = '/opt/ski-tripper'
export const REPO_URL = 'https://github.com/tcorbettclark/ski-tripper'

export { $, configure, dispose, fail, step, success, warn }

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
