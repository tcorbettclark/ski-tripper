import { $ } from '@xec-sh/core'

const CONTAINER_NAME = 'ski-tripper'

async function requireDocker() {
  const result = await $`docker info`.nothrow().text()
  if (!result.includes('Server Version')) {
    console.error(
      'Docker is not running. Please start Docker Desktop and try again.'
    )
    process.exit(1)
  }
}

async function requireContainer() {
  const result =
    await $`docker inspect --format='{{.State.Running}}' ${CONTAINER_NAME} 2>/dev/null`
      .nothrow()
      .text()
  if (!result.includes('true')) {
    console.error(
      `Container '${CONTAINER_NAME}' is not running. Start it with: bun run docker:run`
    )
    process.exit(1)
  }
}

async function trust() {
  await requireDocker()
  await requireContainer()

  const tmpDir = `/tmp/ski-tripper-caddy-ca`
  await $`rm -rf ${tmpDir}`.nothrow()
  await $`mkdir -p ${tmpDir}`

  console.log('Extracting Caddy root CA from container...')
  await $`docker cp ${CONTAINER_NAME}:/root/.local/share/caddy/pki/authorities/local/root.crt ${tmpDir}/root.crt`

  console.log('Installing Caddy root CA in macOS system trust store...')
  console.log('(You will be prompted for your password)')
  await $`sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${tmpDir}/root.crt`

  await $`rm -rf ${tmpDir}`

  console.log('\nDone! You can now access the app at:')
  console.log('  https://ski-tripper.localhost')
  console.log('  https://pb.ski-tripper.localhost')
}

async function untrust() {
  console.log('Removing Caddy root CA from macOS system trust store...')
  console.log('(You will be prompted for your password)')
  const result =
    await $`sudo security delete-certificate -c "Caddy Local Authority" /Library/Keychains/System.keychain`
      .nothrow()
      .text()
  if (result.includes('The specified item could not be found')) {
    console.log('Root CA not found or already removed.')
  } else {
    console.log('Root CA removed.')
  }
}

const command = process.argv[2] || 'trust'
if (command === 'trust') {
  trust().catch((err) => {
    console.error('Failed:', err)
    process.exit(1)
  })
} else if (command === 'untrust') {
  untrust().catch((err) => {
    console.error('Failed:', err)
    process.exit(1)
  })
} else {
  console.log('Usage: bun run docker:trust-ca [trust|untrust]')
  console.log('  trust   - Install Caddy root CA (default)')
  console.log('  untrust - Remove Caddy root CA')
}
