import { $ } from '@xec-sh/core'

const IMAGE_NAME = 'ski-tripper'
const CONTAINER_NAME = 'ski-tripper'
const DROPLET_NAME = 'ski-tripper'
const DROPLET_SIZE = 's-1vcpu-512mb-1gb-intel'
const DROPLET_REGION = 'lon1'
const DROPLET_IMAGE = 'docker-24-04'

const SWAP_SIZE_MB = 1024

async function requireDocker() {
  const result = await $`docker info`.nothrow().text()
  if (!result.includes('Server Version')) {
    console.error(
      'Docker is not running. Please start Docker Desktop and try again.'
    )
    process.exit(1)
  }
}

async function requireDoctl() {
  const result = await $`doctl version`.nothrow().text()
  if (!result.includes('doctl')) {
    console.error(
      'doctl is not installed. Please install it: https://docs.digitalocean.com/reference/doctl/'
    )
    process.exit(1)
  }
}

async function provision() {
  const command = process.argv[2] || 'setup'

  switch (command) {
    case 'create':
      await requireDoctl()
      await createDroplet()
      break
    case 'configure':
      await requireDoctl()
      await configureDroplet()
      break
    case 'deploy':
      await requireDocker()
      await requireDoctl()
      await deployImage()
      break
    case 'setup':
      await requireDocker()
      await requireDoctl()
      await createDroplet()
      await configureDroplet()
      await deployImage()
      break
    case 'update':
      await requireDocker()
      await requireDoctl()
      await deployImage()
      break
    case 'destroy':
      await requireDoctl()
      await destroyDroplet()
      break
    default:
      console.log(`Usage: bun run scripts/provision.ts <command>`)
      console.log(`Commands: create, configure, deploy, setup, update, destroy`)
      process.exit(1)
  }
}

async function createDroplet() {
  console.log('Creating DigitalOcean droplet...')

  const existing =
    await $`doctl compute droplet list --format Name,ID,Status --no-header`
      .nothrow()
      .text()
  const alreadyExists = existing
    .split('\n')
    .some((line) => line.startsWith(DROPLET_NAME))

  if (alreadyExists) {
    console.log(`Droplet '${DROPLET_NAME}' already exists, skipping creation.`)
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

  console.log('Droplet created. Waiting for cloud-init to finish...')

  const ip = await getDropletIp()
  console.log(`Droplet IP: ${ip}`)
  console.log('Waiting 60s for cloud-init to complete...')
  await new Promise((resolve) => setTimeout(resolve, 60000))
}

async function configureDroplet() {
  const ip = await getDropletIp()
  console.log(`Configuring droplet at ${ip}...`)

  const server = $.ssh({ host: ip, username: 'root' })

  const swapCheck = await server`swapon --show --noheadings`.nothrow().text()
  if (!swapCheck.includes('/swapfile')) {
    console.log('Setting up swap...')
    await server`fallocate -l ${SWAP_SIZE_MB}M /swapfile`
    await server`chmod 600 /swapfile`
    await server`mkswap /swapfile`
    await server`swapon /swapfile`
    await server`bash -c "echo '/swapfile none swap sw 0 0' >> /etc/fstab"`
    await server`bash -c "echo 'vm.swappiness=10' >> /etc/sysctl.conf"`
    await server`sysctl vm.swappiness=10`
  } else {
    console.log('Swap already configured.')
  }

  const ufwCheck = await server`ufw status`.nothrow().text()
  if (!ufwCheck.includes('Status: active')) {
    console.log('Configuring firewall...')
    await server`ufw --force reset`
    await server`ufw allow 22/tcp`
    await server`ufw allow 80/tcp`
    await server`ufw allow 443/tcp`
    await server`ufw --force enable`
  } else {
    console.log('Firewall already configured.')
  }

  const dockerCheck = await server`docker --version`.nothrow().text()
  if (!dockerCheck.includes('Docker')) {
    console.log('Installing Docker...')
    await server`curl -fsSL https://get.docker.com | sh`
  } else {
    console.log(`Docker already installed: ${dockerCheck.trim()}`)
  }

  console.log('Configuration complete.')
}

async function deployImage() {
  const tag = process.argv[3] || 'latest'
  const ip = await getDropletIp()
  console.log(`Deploying ${IMAGE_NAME}:${tag} to ${ip}...`)

  const server = $.ssh({ host: ip, username: 'root' })

  console.log('Saving Docker image to tar...')
  const saveExitCode = await Bun.spawn(
    ['docker', 'save', `${IMAGE_NAME}:${tag}`, '-o', `/tmp/${IMAGE_NAME}.tar`],
    { stdout: 'inherit', stderr: 'inherit' }
  ).exited
  if (saveExitCode !== 0) {
    console.error('Failed to save Docker image')
    process.exit(1)
  }

  const imageSize = await $`du -h /tmp/${IMAGE_NAME}.tar`.text()
  console.log(`Image size: ${imageSize.trim()}`)

  console.log('Transferring image to server...')
  const scpExitCode = await Bun.spawn(
    ['scp', `/tmp/${IMAGE_NAME}.tar`, `root@${ip}:/tmp/${IMAGE_NAME}.tar`],
    { stdout: 'inherit', stderr: 'inherit' }
  ).exited
  if (scpExitCode !== 0) {
    console.error('Failed to transfer image to server')
    process.exit(1)
  }

  console.log('Loading image on server...')
  await server`docker load -i /tmp/${IMAGE_NAME}.tar`
  await server`rm /tmp/${IMAGE_NAME}.tar`

  await $`rm /tmp/${IMAGE_NAME}.tar`

  console.log('Stopping existing container (if any)...')
  await server`docker stop ${CONTAINER_NAME} 2>/dev/null || true`
  await server`docker rm ${CONTAINER_NAME} 2>/dev/null || true`

  console.log('Creating .env from server environment...')
  await server`bash -c "test -f /opt/ski-tripper/.env && echo 'exists' || echo 'missing'"`
    .text()
    .then(async (result) => {
      if (result.trim() === 'missing') {
        console.log('No .env file found on server.')
        console.log(
          'Please create /opt/ski-tripper/.env on the server with your secrets.'
        )
        console.log('Required variables: see .env.example')
        process.exit(1)
      }
    })

  console.log('Starting container...')
  await server`docker run \
    --name ${CONTAINER_NAME} \
    --detach \
    --restart unless-stopped \
    --publish 80:80 \
    --publish 443:443 \
    --env-file /opt/ski-tripper/.env \
    --volume ski-tripper-data:/data \
    ${IMAGE_NAME}:${tag}`

  console.log('Waiting for services to start...')
  await new Promise((resolve) => setTimeout(resolve, 10000))

  const health =
    await server`docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME} 2>/dev/null || echo "unknown"`.text()
  console.log(`Container health: ${health.trim()}`)

  console.log('\nDeployment complete!')
  console.log(`App:       https://ski-tripper.com`)
  console.log(`PocketBase: https://pb.ski-tripper.com`)
  console.log(`IP:        ${ip}`)
}

async function destroyDroplet() {
  const ip = await getDropletIp().catch(() => {
    console.log('Droplet not found.')
    process.exit(1)
  })

  console.log(`Destroying droplet ${DROPLET_NAME} (${ip})...`)
  await $`doctl compute droplet delete ${DROPLET_NAME} --force`
  console.log('Droplet destroyed.')
}

async function getDropletIp(): Promise<string> {
  const result =
    await $`doctl compute droplet get ${DROPLET_NAME} --format PublicIPv4 --no-header`.text()
  const ip = result.trim()
  if (!ip) {
    console.error('Could not determine droplet IP. Is the droplet running?')
    process.exit(1)
  }
  return ip
}

provision().catch((err) => {
  console.error('Provision failed:', err)
  process.exit(1)
})
