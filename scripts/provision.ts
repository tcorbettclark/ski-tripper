import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { $ } from '@xec-sh/core'

const DROPLET_NAME = 'ski-tripper'
const DROPLET_SIZE = 's-1vcpu-512mb-1gb-intel'
const DROPLET_REGION = 'lon1'
const DROPLET_IMAGE = 'ubuntu-24-04-x64'
const SWAP_SIZE_MB = 1024

const BUN_VERSION = '1.3.14'
const POCKETBASE_VERSION = '0.39.4'
const CADDY_VERSION = '2.11.4'

const APP_DIR = '/opt/ski-tripper'
const REPO_URL = 'https://github.com/tcorbettclark/ski-tripper'
const ENV_PRODUCTION_PATH = resolve(import.meta.dir, '..', '.env.production')

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

async function getDropletIp(): Promise<string> {
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
    return
  }

  const sshKeyIds =
    await $`doctl compute ssh-key list --format ID --no-header`.text()
  const sshKeys = sshKeyIds
    .split('\n')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => `--ssh-keys ${id}`)
    .join(' ')

  const userData = `#!/bin/bash
echo "Setting up swap..."
fallocate -l ${SWAP_SIZE_MB}M /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' >> /etc/sysctl.conf
sysctl vm.swappiness=10

echo "Configuring firewall..."
ufw --force reset
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Enabling unattended upgrades..."
apt-get update
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

echo "Setup complete!"
`

  await $`doctl compute droplet create ${DROPLET_NAME} \
    --size ${DROPLET_SIZE} \
    --region ${DROPLET_REGION} \
    --image ${DROPLET_IMAGE} \
    --user-data ${userData} \
    ${sshKeys} \
    --wait`

  const ip = await getDropletIp()
  success(`Droplet created at ${ip}`)
  step('Waiting 60s for cloud-init to complete')
  await new Promise((resolve) => setTimeout(resolve, 60000))
  success('Cloud-init complete')
}

async function configureDroplet() {
  const ip = await getDropletIp()
  step(`Configuring droplet at ${ip}`)

  const server = $.ssh({ host: ip, username: 'root' })

  const swapCheck = await server`swapon --show --noheadings`.nothrow().text()
  if (!swapCheck.includes('/swapfile')) {
    step('Setting up swap')
    await server`fallocate -l ${SWAP_SIZE_MB}M /swapfile`
    await server`chmod 600 /swapfile`
    await server`mkswap /swapfile`
    await server`swapon /swapfile`
    await server`bash -c "echo '/swapfile none swap sw 0 0' >> /etc/fstab"`
    await server`bash -c "echo 'vm.swappiness=10' >> /etc/sysctl.conf"`
    await server`sysctl vm.swappiness=10`
    success('Swap configured')
  } else {
    success('Swap already configured')
  }

  const ufwCheck = await server`ufw status`.nothrow().text()
  if (!ufwCheck.includes('Status: active')) {
    step('Configuring firewall')
    await server`ufw --force reset`
    await server`ufw allow 22/tcp`
    await server`ufw allow 80/tcp`
    await server`ufw allow 443/tcp`
    await server`ufw --force enable`
    success('Firewall configured')
  } else {
    success('Firewall already configured')
  }

  const userCheck = await server`id ski-tripper`.nothrow().text()
  if (!userCheck.includes('uid')) {
    step('Creating ski-tripper user')
    await server`useradd --system --home-dir ${APP_DIR} --shell /usr/sbin/nologin ski-tripper`
    success('User ski-tripper created')
  } else {
    success('User ski-tripper already exists')
  }

  const caddyUserCheck = await server`id caddy`.nothrow().text()
  if (!caddyUserCheck.includes('uid')) {
    step('Creating caddy user')
    await server`useradd --system --home-dir /var/lib/caddy --shell /usr/sbin/nologin caddy`
    success('User caddy created')
  } else {
    success('User caddy already exists')
  }

  const bunCheck = await server`bun --version`.nothrow().text()
  if (!bunCheck.includes(BUN_VERSION)) {
    step(`Installing Bun ${BUN_VERSION}`)
    await server`curl -fsSL https://bun.sh/install | bash -s "bun@${BUN_VERSION}"`
    await server`ln -sf /root/.bun/bin/bun /usr/local/bin/bun`
    success(`Bun ${BUN_VERSION} installed`)
  } else {
    success(`Bun already installed: ${bunCheck.trim()}`)
  }

  const pbCheck = await server`test -f /opt/ski-tripper/pocketbase/pocketbase`
    .nothrow()
    .text()
  if (pbCheck.trim() === '') {
    step(`Installing PocketBase ${POCKETBASE_VERSION}`)
    await server`mkdir -p ${APP_DIR}/pocketbase`
    const arch = await server`dpkg --print-architecture`.text()
    const pbArch = arch.trim() === 'amd64' ? 'amd64' : 'arm64'
    await server`curl -L "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${pbArch}.zip" -o /tmp/pocketbase.zip`
    await server`unzip -o /tmp/pocketbase.zip -d ${APP_DIR}/pocketbase`
    await server`chmod +x ${APP_DIR}/pocketbase/pocketbase`
    await server`rm -f /tmp/pocketbase.zip`
    success(`PocketBase ${POCKETBASE_VERSION} installed`)
  } else {
    success('PocketBase already installed')
  }

  const caddyCheck = await server`caddy version`.nothrow().text()
  if (!caddyCheck.includes(CADDY_VERSION)) {
    step(`Installing Caddy ${CADDY_VERSION}`)
    await server`curl -L "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_amd64.tar.gz" -o /tmp/caddy.tar.gz`
    await server`tar -xzf /tmp/caddy.tar.gz -C /usr/bin caddy`
    await server`chmod +x /usr/bin/caddy`
    await server`rm -f /tmp/caddy.tar.gz`
    await server`mkdir -p /var/lib/caddy/.local/share/caddy`
    await server`chown -R caddy:caddy /var/lib/caddy`
    success(`Caddy ${CADDY_VERSION} installed`)
  } else {
    success(`Caddy already installed: ${caddyCheck.trim()}`)
  }

  step('Installing systemd units')
  await server`mkdir -p /etc/systemd/system`

  await server`bash -c "cat > /etc/systemd/system/caddy.service << 'EOF'
[Unit]
Description=Caddy web server
Documentation=https://caddyserver.com/docs/
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
ExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile
ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile --force
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

  await server`bash -c "cat > /etc/systemd/system/ski-tripper-setup.service << 'EOF'
[Unit]
Description=Ski Tripper - Create data directories
DefaultDependencies=no
After=local-fs.target
Before=ski-tripper-pb.service

[Service]
Type=oneshot
User=ski-tripper
Group=ski-tripper
ExecStart=/usr/bin/mkdir -p /opt/ski-tripper/data/pb_data
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF"`

  await server`bash -c "cat > /etc/systemd/system/ski-tripper-pb.service << 'EOF'
[Unit]
Description=Ski Tripper - PocketBase
After=network.target network-online.target ski-tripper-setup.service
Requires=network-online.target
Wants=ski-tripper-setup.service

[Service]
Type=simple
User=ski-tripper
Group=ski-tripper
ExecStart=/opt/ski-tripper/pocketbase/pocketbase serve --http 127.0.0.1:8090 --migrationsDir /opt/ski-tripper/output/pb_migrations --dir /opt/ski-tripper/data/pb_data
WorkingDirectory=/opt/ski-tripper
EnvironmentFile=/opt/ski-tripper/.env
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF"`

  await server`bash -c "cat > /etc/systemd/system/ski-tripper-api.service << 'EOF'
[Unit]
Description=Ski Tripper - API server
After=network.target network-online.target ski-tripper-pb.service
Requires=network-online.target
Wants=ski-tripper-pb.service

[Service]
Type=simple
User=ski-tripper
Group=ski-tripper
ExecStart=/opt/ski-tripper/output/server/serve
WorkingDirectory=/opt/ski-tripper
EnvironmentFile=/opt/ski-tripper/.env
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF"`

  await server`systemctl daemon-reload`
  success('Systemd units installed')

  const repoCheck = await server`test -d ${APP_DIR}/.git`.nothrow().text()
  if (repoCheck.trim() === '') {
    step('Cloning repository')
    await server`git clone ${REPO_URL} ${APP_DIR}`
    success('Repository cloned')
  } else {
    success('Repository already cloned')
  }

  await server`chown -R ski-tripper:ski-tripper ${APP_DIR}`

  await server`mkdir -p /etc/caddy`

  success('Configuration complete')
}

async function deploy() {
  requireEnvProduction()
  const branchOrTag = process.argv[3] || 'main'
  const ip = await getDropletIp()
  step(`Deploying to ${ip} (branch/tag: ${branchOrTag})`)

  const server = $.ssh({ host: ip, username: 'root' })

  step('Uploading .env.production')
  await $`scp ${ENV_PRODUCTION_PATH} root@${ip}:${APP_DIR}/.env`
  success('.env.production uploaded')

  step('Fetching and checking out latest code')
  await server`cd ${APP_DIR} && git fetch --all && git checkout ${branchOrTag}`
  success(`Checked out ${branchOrTag}`)

  step('Installing dependencies')
  await server`cd ${APP_DIR} && bun install --frozen-lockfile`
  success('Dependencies installed')

  step('Building application')
  await server`cd ${APP_DIR} && bun run build`
  success('Build complete')

  step('Setting ownership and permissions')
  await server`chown -R ski-tripper:ski-tripper ${APP_DIR}/output`
  await server`chown -R ski-tripper:ski-tripper ${APP_DIR}/data`
  await server`chmod -R o+rX ${APP_DIR}/output/static`
  success('Ownership set')

  step('Copying Caddyfile')
  await server`cp ${APP_DIR}/output/Caddyfile /etc/caddy/Caddyfile`
  await server`chown caddy:caddy /etc/caddy/Caddyfile`
  success('Caddyfile copied')

  step('Creating PocketBase superuser')
  const adminEmail =
    await server`bash -c "grep '^POCKETBASE_ADMIN_EMAIL=' ${APP_DIR}/.env | cut -d= -f2"`.text()
  const adminPassword =
    await server`bash -c "grep '^POCKETBASE_ADMIN_PASSWORD=' ${APP_DIR}/.env | cut -d= -f2"`.text()
  if (adminEmail.trim() && adminPassword.trim()) {
    await server`systemctl start ski-tripper-pb`
    await server`sleep 2`
    const createResult =
      await server`${APP_DIR}/pocketbase/pocketbase superuser create ${adminEmail.trim()} ${adminPassword.trim()} --dir ${APP_DIR}/data/pb_data`
        .nothrow()
        .text()
    await server`systemctl stop ski-tripper-pb`
    if (
      createResult.includes('created') ||
      createResult.includes('already exists')
    ) {
      success('PocketBase superuser ready')
    } else {
      warn(`PocketBase superuser creation returned: ${createResult.trim()}`)
    }
  } else {
    warn(
      'POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD not set in .env.production'
    )
    warn('Create the superuser manually via the PocketBase admin UI')
  }

  step('Restarting services')
  await server`systemctl restart ski-tripper-setup`
  await server`systemctl restart ski-tripper-pb`
  await server`systemctl restart ski-tripper-api`
  await server`systemctl reload caddy`
  success('Services restarted')

  step('Checking service status')
  await server`sleep 3`

  const pbStatus = (
    await server`systemctl is-active ski-tripper-pb`.text()
  ).trim()
  const apiStatus = (
    await server`systemctl is-active ski-tripper-api`.text()
  ).trim()
  const caddyStatus = (await server`systemctl is-active caddy`.text()).trim()

  if (pbStatus === 'active') success(`PocketBase: ${pbStatus}`)
  else warn(`PocketBase: ${pbStatus}`)
  if (apiStatus === 'active') success(`API Server:  ${apiStatus}`)
  else warn(`API Server:  ${apiStatus}`)
  if (caddyStatus === 'active') success(`Caddy:       ${caddyStatus}`)
  else warn(`Caddy:       ${caddyStatus}`)

  console.log(`\n  App:        https://ski-tripper.com`)
  console.log(`  PocketBase: https://pb.ski-tripper.com`)
  console.log(`  IP:         ${ip}`)
}

async function destroyDroplet() {
  await getDropletIp().catch(() => {
    fail('Droplet not found.')
  })

  step(`Destroying droplet ${DROPLET_NAME}`)
  await $`doctl compute droplet delete ${DROPLET_NAME} --force`
  success('Droplet destroyed')
}

function printHelp() {
  console.log(`Usage: bun run provision <command> [options]

Commands:
  create     Create a DigitalOcean droplet
  configure  Install dependencies and set up systemd services on an existing droplet
  deploy     Pull latest code, build, and restart services [default branch: main]
  setup      Create droplet, configure, and deploy (full setup)
  destroy    Delete the DigitalOcean droplet

Options:
  --help     Show this help message

Requirements:
  doctl           Required for create/destroy. Install: https://docs.digitalocean.com/reference/doctl/
                  Authenticate with: doctl auth init (stores DO API token)
  SSH access      Required for configure/deploy. The droplet is created with your DO SSH keys.
                  The deploy command connects as root to ski-tripper.com.
  .env.production Required for deploy. Copy .env.example to .env.production and fill in secrets.
  bun             Required to run this script.

Examples:
  bun run provision setup              Full setup from scratch
  bun run provision deploy             Deploy current main branch
  bun run provision deploy v1.2.3      Deploy a specific tag
  bun run provision destroy            Tear everything down`)
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
    case 'setup':
      await requireDoctl()
      await createDroplet()
      await configureDroplet()
      await deploy()
      break
    case 'destroy':
      await requireDoctl()
      await destroyDroplet()
      break
    default:
      console.log(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

provision().catch((err) => {
  console.error('\n✗ Provision failed:', err)
  process.exit(1)
})
