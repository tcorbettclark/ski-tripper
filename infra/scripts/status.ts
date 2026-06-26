import {
  $,
  dispose,
  getDropletIp,
  getRootSsh,
  step,
  success,
  warn,
} from './lib/infra'

function printHelp() {
  console.log(`Usage: bun run infra:status

Checks the status of the production server by connecting via SSH and
inspecting systemd services, the Caddyfile, and key file paths.

Options:
  --help, -h    Show this help message

Examples:
  bun run infra:status`)
}

async function main() {
  const arg = process.argv[2]
  if (arg === '--help' || arg === '-h') {
    printHelp()
    process.exit(0)
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
    console.log(logs)
  }
  if (apiStatus === 'active') success(`API Server  ${apiStatus}`)
  else {
    warn(`API Server  ${apiStatus}`)
    const logs = await root`journalctl -u ski-tripper-api -n 20 --no-pager`
      .nothrow()
      .text()
    console.log(logs)
  }
  if (caddyStatus === 'active') success(`Caddy       ${caddyStatus}`)
  else {
    warn(`Caddy       ${caddyStatus}`)
    const logs = await root`journalctl -u caddy -n 20 --no-pager`
      .nothrow()
      .text()
    console.log(logs)
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

  console.log(`\n  App:        ${appUrl}`)
  console.log(`  PocketBase: ${pbUrl}`)
  console.log(`  IP:         ${ip}`)
  console.log(`\n  Layout:`)
  console.log(`    Repo:           /home/ski-tripper/ski-tripper/`)
  console.log(
    `    Installed app:  /opt/ski-tripper/  (static/, server/serve, pb_migrations/)`
  )
  console.log(`    App data:       /var/lib/ski-tripper/pb_data/`)
  console.log(`    Caddyfile:      /etc/caddy/Caddyfile`)
  console.log(`    Binaries:       /usr/local/bin/{bun,caddy,pocketbase}`)
  console.log(
    `    Systemd:        /etc/systemd/system/{ski-tripper-pb,ski-tripper-api,caddy}.service`
  )
  console.log(
    `    Env override:   /etc/systemd/system/ski-tripper-api.service.d/override.conf`
  )
  console.log(`\n  Useful logs (SSH with: doctl compute ssh ski-tripper):`)
  console.log(`    Caddy:       journalctl -u caddy`)
  console.log(`    PocketBase:  journalctl -u ski-tripper-pb`)
  console.log(`    API server:  journalctl -u ski-tripper-api`)
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
    console.error('\n✗ Status check failed:', err)
    process.exitCode = 1
  })
  .finally(() => dispose())
