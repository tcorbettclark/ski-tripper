import { $, dispose, getDropletIp, getRootSsh } from './lib/infra'
import { error, help, info, raw, step, success, warn } from './lib/log'

const HELP_TEXT = `Usage: bun run infra:status

Checks the status of the production server by connecting via SSH and
inspecting systemd services, the Caddyfile, and key file paths.

Options:
  --help, -h    Show this help message

Examples:
  bun run infra:status`

async function main() {
  const arg = process.argv[2]
  if (arg === '--help' || arg === '-h') {
    help(HELP_TEXT, 0)
  }

  const ip = await getDropletIp()
  step('Checking service status')
  await $`ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@${ip} sleep 3`.nothrow()

  const root = getRootSsh(ip)

  const pbStatus = (
    await root`systemctl is-active ski-tripper-pb`.text()
  ).trim()
  const apiStatus = (
    await root`systemctl is-active ski-tripper-api`.text()
  ).trim()
  const caddyStatus = (await root`systemctl is-active caddy`.text()).trim()

  if (pbStatus === 'active') success(`PocketBase  ${pbStatus}`)
  else {
    warn(`PocketBase  ${pbStatus}`)
    const logs = await root`journalctl -u ski-tripper-pb -n 20 --no-pager`
      .nothrow()
      .text()
    raw(logs)
  }
  if (apiStatus === 'active') success(`API Server  ${apiStatus}`)
  else {
    warn(`API Server  ${apiStatus}`)
    const logs = await root`journalctl -u ski-tripper-api -n 20 --no-pager`
      .nothrow()
      .text()
    raw(logs)
  }
  if (caddyStatus === 'active') success(`Caddy       ${caddyStatus}`)
  else {
    warn(`Caddy       ${caddyStatus}`)
    const logs = await root`journalctl -u caddy -n 20 --no-pager`
      .nothrow()
      .text()
    raw(logs)
  }

  // Read domains from the Caddyfile on the server
  const caddyfile = await root`cat /etc/caddy/Caddyfile`.text()
  const domains = extractCaddyDomains(caddyfile)
  const appDomain = domains.find(
    (d) => !d.startsWith('www.') && !d.includes('pb.')
  )
  const pbDomain = domains.find((d) => d.includes('pb.'))
  const appUrl = appDomain ? `https://${appDomain}` : 'N/A'
  const pbUrl = pbDomain ? `https://${pbDomain}` : 'N/A'

  info(`App:        ${appUrl}`)
  info(`PocketBase: ${pbUrl}`)
  info(`IP:         ${ip}`)
  step('Layout')
  info(`Repo:           /home/ski-tripper/ski-tripper/`)
  info(
    `Installed app:  /opt/ski-tripper/  (static/, server/serve, pb_migrations/)`
  )
  info(`App data:       /var/lib/ski-tripper/pb_data/`)
  info(`Caddyfile:      /etc/caddy/Caddyfile`)
  info(`Binaries:       /usr/local/bin/{bun,caddy,pocketbase}`)
  info(
    `Systemd:        /etc/systemd/system/{ski-tripper-pb,ski-tripper-api,caddy}.service`
  )
  info(
    `Env override:   /etc/systemd/system/ski-tripper-api.service.d/override.conf`
  )
  step('Useful logs (SSH with: doctl compute ssh ski-tripper)')
  info(`Caddy:       journalctl -u caddy`)
  info(`PocketBase:  journalctl -u ski-tripper-pb`)
  info(`API server:  journalctl -u ski-tripper-api`)
}

function extractCaddyDomains(caddyfile: string): string[] {
  // Caddy server blocks start with a domain (or www.domain) at the start of a line
  // e.g. "ski-tripper.com {" or "www.ski-tripper.com {"
  const lines = caddyfile.split('\n')
  const domains: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') || trimmed === '' || trimmed.startsWith('('))
      continue
    // Match a domain-like pattern at the start of a server block
    const match = trimmed.match(/^([a-z0-9][a-z0-9.-]+\.[a-z]{2,})\s*\{/)
    if (match) {
      const domain = match[1]
      // Strip www. prefix but include the bare domain
      if (domain.startsWith('www.')) {
        const bare = domain.slice(4)
        if (!domains.includes(bare)) domains.push(bare)
      } else {
        if (!domains.includes(domain)) domains.push(domain)
      }
    }
  }
  return domains
}

main()
  .catch((err: unknown) => {
    error(`Status check failed: ${err}`)
    process.exitCode = 1
  })
  .finally(() => dispose())
