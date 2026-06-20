import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { $, configure, dispose } from '@xec-sh/core'

function getDefaultPrivateKey(): string | undefined {
  const keyPath = resolve(homedir(), '.ssh', 'id_rsa')
  const edKeyPath = resolve(homedir(), '.ssh', 'id_ed25519')
  for (const path of [edKeyPath, keyPath]) {
    if (existsSync(path)) return readFileSync(path, 'utf-8')
  }
  return undefined
}

const SSH_KEY = getDefaultPrivateKey()

configure({ timeout: 600000 })

async function scanHostKey(ip: string) {
  step('Adding droplet host key to known_hosts')
  await $`ssh-keyscan -H ${ip} >> ~/.ssh/known_hosts`.nothrow()
  success('Host key added')
}

const DROPLET_NAME = 'ski-tripper'
const DROPLET_SIZE = 's-1vcpu-1gb'
const DROPLET_REGION = 'lon1'
const DROPLET_IMAGE = 'ubuntu-24-04-x64'
const SWAP_SIZE_MB = 1024
const RESERVED_IP_REGION = DROPLET_REGION

const BUN_VERSION = '1.3.14'
const POCKETBASE_VERSION = '0.39.4'
const CADDY_VERSION = '2.11.4'

const REPO_DIR = '/home/ski-tripper/ski-tripper'
const INSTALL_DIR = '/opt/ski-tripper'
const REPO_URL = 'https://github.com/tcorbettclark/ski-tripper'
const ENV_PRODUCTION_PATH = resolve(import.meta.dir, '../../.env.production')

function step(msg: string) {
  console.log(`\n▸ ${msg}`)
}

function success(msg: string) {
  console.log(`  ✓ ${msg}`)
}

function warn(msg: string) {
  console.log(`  ⚠ ${msg}`)
}

function fail(msg: string) {
  console.error(`  ✗ ${msg}`)
  process.exit(1)
}

async function requireDoctl() {
  const result = await $`doctl version`.nothrow().text()
  if (!result.includes('doctl')) {
    fail(
      'doctl is not installed. Install it: https://docs.digitalocean.com/reference/doctl/'
    )
  }
}

function requireEnvProduction() {
  if (!existsSync(ENV_PRODUCTION_PATH)) {
    fail(
      `.env.production not found at ${ENV_PRODUCTION_PATH}\n  Copy .env.example to .env.production and fill in production values.`
    )
  }
}

async function getDropletId(): Promise<string> {
  const result =
    await $`doctl compute droplet get ${DROPLET_NAME} --format ID --no-header`.text()
  const id = result.trim()
  if (!id) {
    fail('Could not determine droplet ID. Is the droplet running?')
  }
  return id
}

async function getReservedIp(): Promise<string | undefined> {
  const result =
    await $`doctl compute reserved-ip list --format IP,Region --no-header`
      .nothrow()
      .text()
  const line = result.split('\n').find((l) => l.includes(RESERVED_IP_REGION))
  return line?.split(/\s+/)[0] || undefined
}

async function getDropletIp(): Promise<string> {
  const reservedIp = await getReservedIp()
  if (reservedIp) {
    success(`Using reserved IP: ${reservedIp}`)
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

async function createDroplet() {
  step('Creating DigitalOcean droplet')

  const existing =
    await $`doctl compute droplet list --format Name,ID,Status --no-header`
      .nothrow()
      .text()
  const alreadyExists = existing
    .split('\n')
    .some((line) => line.startsWith(DROPLET_NAME))

  if (alreadyExists) {
    warn(`Droplet '${DROPLET_NAME}' already exists, skipping creation.`)
  } else {
    const sshKeyIds =
      await $`doctl compute ssh-key list --format ID --no-header`.text()
    const keyList = sshKeyIds
      .split('\n')
      .map((id) => id.trim())
      .filter(Boolean)

    if (keyList.length === 0) {
      fail(
        'No SSH keys registered with DigitalOcean. Register one with: doctl compute ssh-key import id_ed25519 --public-key-file ~/.ssh/id_ed25519.pub'
      )
    }

    const sshKeys = keyList.join(',')

    await $`doctl compute droplet create ${DROPLET_NAME} \
      --size ${DROPLET_SIZE} \
      --region ${DROPLET_REGION} \
      --image ${DROPLET_IMAGE} \
      --ssh-keys ${sshKeys} \
      --wait`.timeout(300000)

    const ip = await getDropletIp()
    success(`Droplet created at ${ip}`)
  }

  const reservedIp = await getReservedIp()
  if (reservedIp) {
    step('Assigning reserved IP to droplet')
    const dropletId = await getDropletId()
    await $`doctl compute reserved-ip-action assign ${reservedIp} ${dropletId}`
    success(`Reserved IP ${reservedIp} assigned`)
  } else {
    step('Creating reserved IP')
    const result =
      await $`doctl compute reserved-ip create --region ${RESERVED_IP_REGION} --format IP --no-header`.text()
    const ip = result.trim()
    if (!ip) {
      fail('Failed to create reserved IP')
    }
    success(`Reserved IP created: ${ip}`)
    console.log(
      '  Point your DNS records to this IP. It will persist across droplet recreations.'
    )
    const dropletId = await getDropletId()
    step('Assigning reserved IP to droplet')
    await $`doctl compute reserved-ip-action assign ${ip} ${dropletId}`
    success(`Reserved IP ${ip} assigned`)
  }
}

async function waitForSsh(ip: string) {
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

async function configureDroplet() {
  const ip = await getDropletIp()
  step(`Configuring droplet at ${ip}`)

  await scanHostKey(ip)
  await waitForSsh(ip)
  const root = $.ssh({
    host: ip,
    username: 'root',
    privateKey: SSH_KEY,
  }).timeout(300000)

  step('Configuring unattended upgrades')
  async function waitForAptLock() {
    step('Waiting for apt lock')
    for (let i = 0; i < 60; i++) {
      const result =
        await root`fuser /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock`
          .nothrow()
          .text()
      if (result.trim() === '') break
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
    success('Apt lock available')
  }

  await waitForAptLock()
  await root`dpkg-reconfigure -plow unattended-upgrades`
  success('Unattended upgrades configured')

  const swapCheck = await root`swapon --show --noheadings`.nothrow().text()
  if (!swapCheck.includes('/swapfile')) {
    step('Setting up swap')
    await root`fallocate -l ${SWAP_SIZE_MB}M /swapfile`
    await root`chmod 600 /swapfile`
    await root`mkswap /swapfile`
    await root`swapon /swapfile`
    await root`bash -c "echo '/swapfile none swap sw 0 0' >> /etc/fstab"`
    await root`bash -c "echo 'vm.swappiness=10' >> /etc/sysctl.conf"`
    await root`sysctl vm.swappiness=10`
    success('Swap configured')
  } else {
    success('Swap already configured')
  }

  const ufwCheck = await root`ufw status`.nothrow().text()
  if (!ufwCheck.includes('Status: active')) {
    step('Configuring firewall')
    await root`ufw --force reset`
    await root`ufw allow 22/tcp`
    await root`ufw allow 80/tcp`
    await root`ufw allow 443/tcp`
    await root`ufw --force enable`
    success('Firewall configured')
  } else {
    success('Firewall already configured')
  }

  const userCheck = await root`id ski-tripper`.nothrow().text()
  if (!userCheck.includes('uid')) {
    step('Creating ski-tripper user')
    await root`useradd --system --home-dir /home/ski-tripper --create-home --shell /bin/bash ski-tripper`
    success('User ski-tripper created')
  } else {
    success('User ski-tripper already exists')
  }

  step('Setting up ski-tripper SSH access')
  const skiTripperHome = '/home/ski-tripper'
  await root`mkdir -p ${skiTripperHome}/.ssh`
  const hasAuthorizedKeys =
    await root`test -f ${skiTripperHome}/.ssh/authorized_keys`.nothrow()
  if (hasAuthorizedKeys.exitCode !== 0) {
    await root`cp /root/.ssh/authorized_keys ${skiTripperHome}/.ssh/authorized_keys`
  }
  await root`chown -R ski-tripper:ski-tripper ${skiTripperHome}/.ssh`
  await root`chmod 700 ${skiTripperHome}/.ssh`
  await root`chmod 600 ${skiTripperHome}/.ssh/authorized_keys`
  success('ski-tripper SSH access configured')

  const app = $.ssh({
    host: ip,
    username: 'ski-tripper',
    privateKey: SSH_KEY,
  }).timeout(300000)

  const repoCheck = await app`test -d ${REPO_DIR}/.git`.nothrow()
  if (repoCheck.exitCode !== 0) {
    step('Cloning repository')
    await app`git clone ${REPO_URL} ${REPO_DIR}`
    success('Repository cloned')
  } else {
    success('Repository already cloned')
  }

  step('Creating install directory')
  await root`mkdir -p ${INSTALL_DIR}`
  await root`chown ski-tripper:ski-tripper ${INSTALL_DIR}`
  success('Install directory ready')

  const caddyUserCheck = await root`id caddy`.nothrow().text()
  if (!caddyUserCheck.includes('uid')) {
    step('Creating caddy user')
    await root`useradd --system --home-dir /var/lib/caddy --shell /usr/sbin/nologin caddy`
    success('User caddy created')
  } else {
    success('User caddy already exists')
  }

  const bunCheck = await root`/usr/local/bin/bun --version`.nothrow().text()
  if (!bunCheck.includes(BUN_VERSION)) {
    step(`Installing Bun ${BUN_VERSION}`)
    await waitForAptLock()
    await root`apt-get install -y unzip`
    const bunUrl = `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64.zip`
    await root`curl -fsSL ${bunUrl} -o /tmp/bun.zip`
    await root`unzip -o /tmp/bun.zip -d /tmp/bun`
    await root`mv /tmp/bun/bun-linux-x64/bun /usr/local/bin/bun`
    await root`chmod +x /usr/local/bin/bun`
    await root`rm -rf /tmp/bun /tmp/bun.zip`
    success(`Bun ${BUN_VERSION} installed`)
  } else {
    success(`Bun already installed: ${bunCheck.trim()}`)
  }

  const pbCheck = await root`/usr/local/bin/pocketbase --version`
    .nothrow()
    .text()
  if (!pbCheck.includes(POCKETBASE_VERSION)) {
    step(`Installing PocketBase ${POCKETBASE_VERSION}`)
    const arch = await root`dpkg --print-architecture`.text()
    const pbArch = arch.trim() === 'amd64' ? 'amd64' : 'arm64'
    const pbUrl = `https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${pbArch}.zip`
    await root`curl -L ${pbUrl} -o /tmp/pocketbase.zip`
    await root`unzip -o /tmp/pocketbase.zip -d /tmp/pocketbase`
    await root`mv /tmp/pocketbase/pocketbase /usr/local/bin/pocketbase`
    await root`chmod +x /usr/local/bin/pocketbase`
    await root`rm -rf /tmp/pocketbase /tmp/pocketbase.zip`
    success(`PocketBase ${POCKETBASE_VERSION} installed`)
  } else {
    success(`PocketBase already installed: ${pbCheck.trim()}`)
  }

  const caddyCheck = await root`/usr/local/bin/caddy version`.nothrow().text()
  if (!caddyCheck.includes(CADDY_VERSION)) {
    step(`Installing Caddy ${CADDY_VERSION}`)
    const caddyUrl = `https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_amd64.tar.gz`
    await root`curl -L ${caddyUrl} -o /tmp/caddy.tar.gz`
    await root`tar -xzf /tmp/caddy.tar.gz -C /usr/local/bin caddy`
    await root`chmod +x /usr/local/bin/caddy`
    await root`rm -f /tmp/caddy.tar.gz`
    await root`mkdir -p /var/lib/caddy/.local/share/caddy`
    await root`chown -R caddy:caddy /var/lib/caddy`
    success(`Caddy ${CADDY_VERSION} installed`)
  } else {
    success(`Caddy already installed: ${caddyCheck.trim()}`)
  }

  step('Installing systemd units')
  await root`mkdir -p /etc/systemd/system`

  await root`bash -c "cat > /etc/systemd/system/caddy.service << 'EOF'
[Unit]
Description=Caddy web server
Documentation=https://caddyserver.com/docs/
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --force
EnvironmentFile=/opt/ski-tripper/.env
TimeoutStopSec=5s
LimitNOFILE=1048576
LimitNPROC=512
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF"`

  await root`bash -c "cat > /etc/systemd/system/ski-tripper-pb.service << 'EOF'
[Unit]
Description=Ski Tripper - PocketBase
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=simple
User=ski-tripper
Group=ski-tripper
ExecStart=/usr/local/bin/pocketbase serve --http 127.0.0.1:8090 --migrationsDir /opt/ski-tripper/pb_migrations --dir /var/lib/ski-tripper/pb_data
WorkingDirectory=/opt/ski-tripper
EnvironmentFile=/opt/ski-tripper/.env
StateDirectory=ski-tripper
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF"`

  await root`bash -c "cat > /etc/systemd/system/ski-tripper-api.service << 'EOF'
[Unit]
Description=Ski Tripper - API server
After=network.target network-online.target ski-tripper-pb.service
Requires=network-online.target
Wants=ski-tripper-pb.service

[Service]
Type=simple
User=ski-tripper
Group=ski-tripper
ExecStart=/opt/ski-tripper/server/serve
WorkingDirectory=/opt/ski-tripper
EnvironmentFile=/opt/ski-tripper/.env
StateDirectory=ski-tripper
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF"`

  await root`systemctl daemon-reload`
  success('Systemd units installed')

  await root`mkdir -p /etc/caddy`

  success('Configuration complete')
}

async function deploy() {
  requireEnvProduction()
  const branchOrTag = process.argv[3] || 'main'
  const ip = await getDropletIp()
  step(`Deploying to ${ip} (branch/tag: ${branchOrTag})`)

  await scanHostKey(ip)
  await waitForSsh(ip)
  const root = $.ssh({
    host: ip,
    username: 'root',
    privateKey: SSH_KEY,
  }).timeout(300000)
  const app = $.ssh({
    host: ip,
    username: 'ski-tripper',
    privateKey: SSH_KEY,
  }).timeout(300000)

  step('Uploading .env.production')
  await app.uploadFile(ENV_PRODUCTION_PATH, `${INSTALL_DIR}/.env`)
  success('.env.production uploaded')

  step('Fetching and checking out latest code')
  await app`cd ${REPO_DIR} && git fetch --all`
  const isTag = await app`cd ${REPO_DIR} && git tag -l ${branchOrTag}`.text()
  if (isTag.trim()) {
    await app`cd ${REPO_DIR} && git checkout ${branchOrTag}`
    success(`Checked out tag ${branchOrTag}`)
  } else {
    await app`cd ${REPO_DIR} && git reset --hard origin/${branchOrTag}`
    success(`Checked out branch ${branchOrTag}`)
  }

  step('Installing dependencies')
  await app`cd ${REPO_DIR} && /usr/local/bin/bun install --frozen-lockfile`
  success('Dependencies installed')

  step('Building application')
  await app`cd ${REPO_DIR} && /usr/local/bin/bun run build`
  success('Build complete')

  step('Stopping services')
  await root`systemctl stop ski-tripper-api`.nothrow()
  success('Services stopped')

  step('Installing artefacts')
  await root`mkdir -p ${INSTALL_DIR}/server`
  await root`cp ${REPO_DIR}/dist/server/serve ${INSTALL_DIR}/server/serve`
  await root`rsync -a --delete ${REPO_DIR}/dist/static/ ${INSTALL_DIR}/static/`
  await root`rsync -a --delete ${REPO_DIR}/dist/pb_migrations/ ${INSTALL_DIR}/pb_migrations/`
  await root`chown -R ski-tripper:ski-tripper ${INSTALL_DIR}`
  success('Artefacts installed')

  step('Creating data directory')
  await root`mkdir -p /var/lib/ski-tripper/pb_data`
  await root`chown -R ski-tripper:ski-tripper /var/lib/ski-tripper`
  success('Data directory ready')

  step('Copying Caddyfile')
  await root`cp ${REPO_DIR}/infra/caddy/Caddyfile /etc/caddy/Caddyfile`
  await root`chown caddy:caddy /etc/caddy/Caddyfile`
  success('Caddyfile copied')

  step('Creating PocketBase superuser')
  const adminEmail =
    await app`grep ^POCKETBASE_ADMIN_EMAIL= ${INSTALL_DIR}/.env | cut -d= -f2`.text()
  const adminPassword =
    await app`grep ^POCKETBASE_ADMIN_PASSWORD= ${INSTALL_DIR}/.env | cut -d= -f2`.text()
  if (adminEmail.trim() && adminPassword.trim()) {
    const createResult =
      await app`/usr/local/bin/pocketbase --dir /var/lib/ski-tripper/pb_data superuser create ${adminEmail.trim()} ${adminPassword.trim()}`.nothrow()
    const output = [createResult.stdout, createResult.stderr].join('\n')
    if (
      output.includes('created') ||
      output.includes('already exists') ||
      output.includes('must be unique')
    ) {
      success('PocketBase superuser ready')
    } else {
      warn(`PocketBase superuser creation returned: ${output.trim()}`)
    }
  } else {
    warn(
      'POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD not set in .env.production'
    )
    warn('Create the superuser manually via the PocketBase admin UI')
  }

  step('Restarting services')
  await root`systemctl restart ski-tripper-pb`
  await root`systemctl restart ski-tripper-api`
  await root`systemctl restart caddy`.nothrow()
  success('Services restarted')

  step('Configuring PocketBase settings')
  await app`cd ${REPO_DIR} && /usr/local/bin/bun run infra/scripts/configure-pocketbase.ts --env-file ${INSTALL_DIR}/.env`
  success('PocketBase settings configured')

  await status()
}

async function status() {
  const ip = await getDropletIp()
  step('Checking service status')
  await $`ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@${ip} sleep 3`.nothrow()

  const root = $.ssh({
    host: ip,
    username: 'root',
    privateKey: SSH_KEY,
  }).timeout(300000)

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

  console.log(`\n  App:        https://ski-tripper.com`)
  console.log(`  PocketBase: https://pb.ski-tripper.com`)
  console.log(`  IP:         ${ip}`)
  console.log(`\n  Layout:`)
  console.log(`    Repo:           /home/ski-tripper/ski-tripper/`)
  console.log(
    `    Installed app:  /opt/ski-tripper/  (static/, server/serve, pb_migrations/, .env)`
  )
  console.log(`    App data:       /var/lib/ski-tripper/pb_data/`)
  console.log(`    Caddyfile:      /etc/caddy/Caddyfile`)
  console.log(`    Binaries:       /usr/local/bin/{bun,caddy,pocketbase}`)
  console.log(
    `    Systemd:        /etc/systemd/system/{ski-tripper-pb,ski-tripper-api,caddy}.service`
  )
  console.log(`\n  Useful logs (SSH with: doctl compute ssh ski-tripper):`)
  console.log(`    Caddy:       journalctl -u caddy`)
  console.log(`    PocketBase:  journalctl -u ski-tripper-pb`)
  console.log(`    API server:  journalctl -u ski-tripper-api`)
}

async function destroyDroplet(forgetReservedIp: boolean) {
  await getDropletIp().catch(() => {
    fail('Droplet not found.')
  })

  const reservedIp = await getReservedIp()
  if (reservedIp) {
    if (forgetReservedIp) {
      step('Deleting reserved IP')
      await $`doctl compute reserved-ip delete ${reservedIp} --force`
      success(`Reserved IP ${reservedIp} deleted`)
    } else {
      step('Unassigning reserved IP (preserving for future use)')
      await $`doctl compute reserved-ip-action unassign ${reservedIp}`.nothrow()
      success(`Reserved IP ${reservedIp} unassigned and preserved`)
    }
  }

  step(`Destroying droplet ${DROPLET_NAME}`)
  await $`doctl compute droplet delete ${DROPLET_NAME} --force`

  step('Waiting for droplet to be destroyed')
  for (let i = 0; i < 60; i++) {
    const result = await $`doctl compute droplet list --format Name --no-header`
      .nothrow()
      .text()
    if (!result.split('\n').some((line) => line.trim() === DROPLET_NAME)) {
      success(`Droplet ${DROPLET_NAME} destroyed`)
      if (reservedIp && !forgetReservedIp) {
        console.log(
          `\n  Reserved IP ${reservedIp} is preserved and ready for next deployment.`
        )
      }
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
  fail('Timed out waiting for droplet to be destroyed')
}

function printHelp() {
  console.log(`Usage: bun run infra:provision <command> [options]

Commands:
  create      Create a droplet and reserved IP (idempotent)
  configure   Install dependencies and set up systemd services on an existing droplet
  deploy      Pull latest code, build, and restart services [default branch: main]
  status      Show service status, IP, and layout info
  setup       Create, configure, and deploy (full setup)
  destroy     Unassign IP and delete the droplet (preserves the reserved IP)

Options:
  --help                 Show this help message
  --forget-reserved-ip   Also delete the reserved IP (use with destroy)

Requirements:
  doctl           Required for create/destroy. Install: https://docs.digitalocean.com/reference/doctl/
                  Authenticate with: doctl auth init (stores DO API token)
  SSH access      Required for configure/deploy. The droplet is created with your DO SSH keys.
  .env.production Required for deploy. Copy .env.example to .env.production and fill in secrets.
  bun             Required to run this script.

Examples:
  bun run infra:provision setup                          Full setup from scratch
  bun run infra:provision deploy                         Deploy current main branch
  bun run infra:provision deploy v1.2.3                  Deploy a specific tag
  bun run infra:provision destroy                        Tear down droplet (preserves reserved IP)
  bun run infra:provision destroy --forget-reserved-ip   Also delete the reserved IP`)
}

async function provision() {
  const command = process.argv[2] || 'setup'

  if (command === '--help' || command === '-h') {
    printHelp()
    process.exit(0)
  }

  switch (command) {
    case 'create':
      await requireDoctl()
      await createDroplet()
      break
    case 'configure':
      await configureDroplet()
      break
    case 'deploy':
      await deploy()
      break
    case 'status':
      await status()
      break
    case 'setup':
      await requireDoctl()
      await createDroplet()
      await configureDroplet()
      await deploy()
      break
    case 'destroy':
      await requireDoctl()
      await destroyDroplet(process.argv.includes('--forget-reserved-ip'))
      break
    default:
      console.log(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

provision()
  .catch((err) => {
    console.error('\n✗ Provision failed:', err)
    process.exitCode = 1
  })
  .finally(() => dispose())
