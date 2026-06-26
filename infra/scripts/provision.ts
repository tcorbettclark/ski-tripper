import {
  $,
  BUN_VERSION,
  CADDY_VERSION,
  DROPLET_IMAGE,
  DROPLET_NAME,
  DROPLET_REGION,
  DROPLET_SIZE,
  dispose,
  fail,
  getAppSsh,
  getDropletId,
  getDropletIp,
  getReservedIp,
  getRootSsh,
  INSTALL_DIR,
  POCKETBASE_VERSION,
  REPO_DIR,
  REPO_URL,
  requireDoctl,
  SWAP_SIZE_MB,
  scanHostKey,
  step,
  success,
  waitForSsh,
  warn,
} from './lib/infra'

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
      await $`doctl compute reserved-ip create --region ${DROPLET_REGION} --format IP --no-header`.text()
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

async function configureDroplet() {
  const ip = await getDropletIp()
  step(`Configuring droplet at ${ip}`)

  await scanHostKey(ip)
  await waitForSsh(ip)
  const root = getRootSsh(ip)

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

  step('Configuring journald log rotation')
  await root`bash -c "cat > /etc/systemd/journald.conf << 'EOF'
[Journal]
Storage=persistent
SystemMaxUse=100M
SystemMaxFileSize=10M
MaxRetentionSec=14day
EOF"`
  await root`systemctl restart systemd-journald`
  success('Journald log rotation configured')

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

  const app = getAppSsh(ip)

  const gitDirExists =
    (await app`test -d ${REPO_DIR}/.git`.nothrow()).exitCode === 0
  if (gitDirExists) {
    const remoteUrl = (
      await app`git -C ${REPO_DIR} remote get-url origin`.nothrow().text()
    ).trim()
    if (remoteUrl === REPO_URL) {
      success('Repository already cloned')
    } else {
      fail(
        `Repository at ${REPO_DIR} has unexpected remote origin: ${remoteUrl} (expected ${REPO_URL})`
      )
    }
  } else {
    const dirExists = (await app`test -d ${REPO_DIR}`.nothrow()).exitCode === 0
    if (dirExists) {
      fail(
        `Directory ${REPO_DIR} exists but is not a git repository. Remove it manually or investigate.`
      )
    }
    step('Cloning repository')
    await app`git clone ${REPO_URL} ${REPO_DIR}`
    success('Repository cloned')
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
  await root`cp ${REPO_DIR}/infra/systemd/caddy.service /etc/systemd/system/caddy.service`
  await root`cp ${REPO_DIR}/infra/systemd/ski-tripper-pb.service /etc/systemd/system/ski-tripper-pb.service`
  await root`cp ${REPO_DIR}/infra/systemd/ski-tripper-api.service /etc/systemd/system/ski-tripper-api.service`

  await root`systemctl daemon-reload`
  await root`systemctl enable ski-tripper-pb ski-tripper-api caddy`
  success('Systemd units installed and enabled')

  await root`mkdir -p /etc/caddy`

  success('Configuration complete')
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
  destroy     Unassign IP and delete the droplet (preserves the reserved IP)

Options:
  --help                    Show this help message
  --forget-reserved-ip      Also delete the reserved IP (use with destroy)

Requirements:
  doctl           Required for create/destroy. Install: https://docs.digitalocean.com/reference/doctl/
                  Authenticate with: doctl auth init (stores DO API token)
  SSH access      Required for configure. The droplet is created with your DO SSH keys.
  bun             Required to run this script.

Examples:
  bun run infra:provision create                         Create droplet and reserved IP
  bun run infra:provision configure                      Configure an existing droplet
  bun run infra:provision destroy                        Tear down droplet (preserves reserved IP)
  bun run infra:provision destroy --forget-reserved-ip   Also delete the reserved IP`)
}

async function provision() {
  const command = process.argv[2] || '--help'

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
