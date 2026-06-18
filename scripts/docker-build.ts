import { $ } from '@xec-sh/core'

const IMAGE_NAME = 'ski-tripper'

async function requireDocker() {
  const result = await $`docker info`.nothrow().text()
  if (!result.includes('Server Version')) {
    console.error(
      'Docker is not running. Please start Docker Desktop and try again.'
    )
    process.exit(1)
  }
}

async function requireBuildx() {
  const dockerResult = await $`docker buildx version`.nothrow().text()
  if (dockerResult.includes('buildx')) return

  const standaloneResult = await $`docker-buildx version`.nothrow().text()
  if (standaloneResult.includes('buildx')) {
    console.error(
      'docker-buildx is installed but not linked into Docker CLI plugins.\n' +
        'Fix by running:\n' +
        '  mkdir -p ~/.docker/cli-plugins\n' +
        '  ln -s "$(which docker-buildx)" ~/.docker/cli-plugins/docker-buildx'
    )
    process.exit(1)
  }

  console.error(
    'Docker buildx is not available. Please install it:\n' +
      '  Docker Desktop: https://docs.docker.com/get-docker/\n' +
      '  Standalone:     brew install docker-buildx'
  )
  process.exit(1)
}

async function build() {
  await requireDocker()
  await requireBuildx()
  const tag = process.argv[2] || 'latest'
  const fullTag = `${IMAGE_NAME}:${tag}`

  const gitSha = (await $`git rev-parse --short HEAD`.text()).trim()
  console.log(`Building ${fullTag} (git: ${gitSha})`)

  const success = await Bun.spawn(
    [
      'docker',
      'buildx',
      'build',
      '--progress=plain',
      '--tag',
      fullTag,
      '--tag',
      `${IMAGE_NAME}:${gitSha}`,
      '--label',
      `org.opencontainers.image.revision=${gitSha}`,
      '--load',
      '.',
    ],
    { stdout: 'inherit', stderr: 'inherit' }
  ).exited

  if (success !== 0) {
    console.error('Build failed')
    process.exit(1)
  }

  console.log(`Built ${fullTag}`)
  console.log(`Also tagged ${IMAGE_NAME}:${gitSha}`)
  console.log('\nTo test locally:')
  console.log(`  bun run scripts/docker-run.ts`)
  console.log('\nTo push to a server:')
  console.log(`  bun run scripts/provision.ts`)
}

build().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
