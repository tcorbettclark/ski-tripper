import { $ } from '@xec-sh/core'

const IMAGE_NAME = 'ski-tripper'
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

async function main() {
  await requireDocker()
  const envPath = new URL('../.env', import.meta.url).pathname
  const tag = process.argv[2] || 'latest'

  await $`docker stop ${CONTAINER_NAME} 2>/dev/null || true`
  await $`docker rm ${CONTAINER_NAME} 2>/dev/null || true`

  console.log(`Starting ${IMAGE_NAME}:${tag}...`)

  await $`docker run \
    --name ${CONTAINER_NAME} \
    --detach \
    --publish 80:80 \
    --publish 443:443 \
    --env-file ${envPath} \
    --volume ski-tripper-data:/data \
    ${IMAGE_NAME}:${tag}`

  console.log('Container started. Waiting for services...')
  await new Promise((resolve) => setTimeout(resolve, 10000))

  const logs = await $`docker logs ${CONTAINER_NAME} --tail 30 2>&1`.text()
  console.log('\nRecent logs:')
  console.log(logs)

  console.log('\nApp:       https://ski-tripper.localhost')
  console.log('PocketBase: https://pb.ski-tripper.localhost')
  console.log('\nTo view logs:')
  console.log('  docker logs -f ski-tripper')
  console.log('To stop:')
  console.log('  docker stop ski-tripper')
}

main().catch((err) => {
  console.error('Failed to start container:', err)
  process.exit(1)
})
