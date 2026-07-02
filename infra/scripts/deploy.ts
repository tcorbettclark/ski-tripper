import { execSync } from 'node:child_process'
import {
  dispose,
  getAppSsh,
  getDropletIp,
  getRootSsh,
  INSTALL_DIR,
  PROJECT_ROOT,
  REPO_DIR,
  scanHostKey,
  waitForSsh,
} from './lib/infra'
import { error, fail, help, step, success, warn } from './lib/log'

const BUILD_ENV_KEYS = [
  'PUBLIC_DOMAIN',
  'PUBLIC_EXTERNAL_URL',
  'PUBLIC_POCKETBASE_DOMAIN',
  'STATIC_ROOT',
  'SERVER_HOSTNAME',
  'SERVER_PORT',
  'POCKETBASE_HOSTNAME',
  'POCKETBASE_PORT',
] as const

const PROD_ENV_KEYS = [
  // .env.common
  'SERVER_HOSTNAME',
  'SERVER_PORT',
  'POCKETBASE_HOSTNAME',
  'POCKETBASE_PORT',
  'OLLAMA_MODEL_ENRICH',
  'OLLAMA_MODEL_AUDIT',
  'OLLAMA_MODEL_PREFERENCE_SEARCH',
  'OLLAMA_MODEL_ANALYSIS',
  // .env.prod
  'PUBLIC_DOMAIN',
  'PUBLIC_EXTERNAL_URL',
  'PUBLIC_POCKETBASE_DOMAIN',
  'POCKETBASE_EXTERNAL_URL',
  'STATIC_ROOT',
  'POCKETBASE_DATA_DIR',
  'POCKETBASE_ADMIN_EMAIL',
  'POCKETBASE_ADMIN_PASSWORD',
  'POCKETBASE_SMTP_HOST',
  'POCKETBASE_SMTP_PORT',
  'POCKETBASE_SMTP_USERNAME',
  'POCKETBASE_SMTP_PASSWORD',
  'POCKETBASE_SMTP_LOCAL_NAME',
  'POCKETBASE_SMTP_TLS',
  'POCKETBASE_APP_URL',
  'POCKETBASE_SENDER_ADDRESS',
  'OLLAMA_API_KEY',
] as const

function getEnvFromProcess(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const key of PROD_ENV_KEYS) {
    const value = process.env[key]
    if (value === undefined || value === '') {
      fail(
        `Missing required env var: ${key}\n  Run with: bun run env:prod bun run infra:deploy`
      )
    }
    env[key] = value
  }
  return env
}

const HELP_TEXT = `Usage: bun run env:prod bun run infra:deploy [options]

Options:
  --version <tag>            Deploy a specific tag (default: main)
  --skip-resorts-upload      Skip resort data upload
  --help                     Show this help message

Examples:
  bun run env:prod bun run infra:deploy                         Deploy current main branch
  bun run env:prod bun run infra:deploy --version v1.2.3        Deploy a specific tag
  bun run env:prod bun run infra:deploy --skip-resorts-upload   Deploy without uploading resort data`

async function deploy() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    help(HELP_TEXT, 0)
  }

  const versionIdx = args.indexOf('--version')
  const skipResortsUpload = args.includes('--skip-resorts-upload')
  const unknownArgs = args.filter(
    (a) =>
      a !== '--skip-resorts-upload' &&
      a !== '--version' &&
      (versionIdx === -1 || a !== args[versionIdx + 1])
  )
  if (unknownArgs.length > 0) {
    error(`Unknown arguments: ${unknownArgs.join(', ')}`)
    help(HELP_TEXT, 1)
  }

  const branchOrTag = versionIdx !== -1 ? args[versionIdx + 1] : 'main'
  if (versionIdx !== -1 && !branchOrTag) {
    error('--version requires a value (e.g. --version v1.2.3)')
    process.exit(1)
  }

  const env = getEnvFromProcess()
  const ip = await getDropletIp()
  await scanHostKey(ip)
  await waitForSsh(ip)
  const root = getRootSsh(ip)
  const app = getAppSsh(ip)

  step(`Checking out code from GitHub`)
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

  step(`Building application`)
  const buildEnv: Record<string, string> = {}
  for (const k of BUILD_ENV_KEYS) {
    if (!env[k]) fail(`Missing required env var for build: ${k}`)
    buildEnv[k] = env[k]
  }
  await app`cd ${REPO_DIR} && /usr/local/bin/bun run build`.env(buildEnv)
  const caddyDomains =
    await app`grep -E '^[a-z]' ${REPO_DIR}/dist/Caddyfile`.text()
  if (caddyDomains.includes('localhost')) {
    fail(
      `Caddyfile contains localhost domains (build env vars not applied?):\n${caddyDomains}`
    )
  }
  success('Build complete')

  step('Stopping services')
  await root`systemctl stop ski-tripper-api`.nothrow()
  await root`bash -c 'while systemctl is-active --quiet ski-tripper-api; do sleep 0.5; done'`.nothrow()
  success('Services stopped')

  step('Installing artefacts')
  await app`mkdir -p ${INSTALL_DIR}/server`
  await app`cp ${REPO_DIR}/dist/server/serve ${INSTALL_DIR}/server/serve`
  await app`rsync -a --delete ${REPO_DIR}/dist/static/ ${INSTALL_DIR}/static/`
  await app`rsync -a --delete ${REPO_DIR}/dist/pb_migrations/ ${INSTALL_DIR}/pb_migrations/`
  success('Artefacts installed')

  step('Creating data directory')
  await root`mkdir -p /var/lib/ski-tripper`
  await root`chown ski-tripper:ski-tripper /var/lib/ski-tripper`
  await app`mkdir -p /var/lib/ski-tripper/pb_data`
  success('Data directory ready')

  step('Copying Caddyfile')
  await root`cp ${REPO_DIR}/dist/Caddyfile /etc/caddy/Caddyfile`
  await root`chown caddy:caddy /etc/caddy/Caddyfile`
  success('Caddyfile copied')

  step('Resetting Caddy PB include to prod mode')
  const disabledExists =
    (
      await root`test -f /etc/caddy/pb-includes/block-pb-admin.caddy.disabled`.nothrow()
    ).exitCode === 0
  if (disabledExists) {
    await root`mv /etc/caddy/pb-includes/block-pb-admin.caddy.disabled /etc/caddy/pb-includes/block-pb-admin.caddy`
    success('Reset from debug mode to prod mode')
  } else {
    success('Already in prod mode')
  }

  step('Creating PocketBase superuser')
  const adminEmail = env.POCKETBASE_ADMIN_EMAIL
  const adminPassword = env.POCKETBASE_ADMIN_PASSWORD
  const pbDataDir = env.POCKETBASE_DATA_DIR || '/var/lib/ski-tripper/pb_data'
  await app`/usr/local/bin/pocketbase --dir ${pbDataDir} superuser upsert ${adminEmail} ${adminPassword}`
  success('PocketBase superuser ready')

  step('Running PocketBase migrations')
  const migrationsDir = `${INSTALL_DIR}/pb_migrations`
  const migrateResult =
    await app`/usr/local/bin/pocketbase migrate up --dir ${pbDataDir} --migrationsDir ${migrationsDir}`.text()
  if (migrateResult.trim().includes('No new migrations to apply')) {
    success('No new migrations to apply')
  } else {
    success('Migrations applied')
  }

  step('Writing systemd environment override')
  const overrideDir = '/etc/systemd/system/ski-tripper-api.service.d'
  await root`mkdir -p ${overrideDir}`
  const overrideLines = ['[Service]']
  for (const [key, value] of Object.entries(env)) {
    overrideLines.push(`Environment="${key}=${value}"`)
  }
  const overrideContent = overrideLines.join('\n')
  const overrideB64 = Buffer.from(overrideContent).toString('base64')
  await root`bash -c "echo ${overrideB64} | base64 -d > ${overrideDir}/override.conf"`
  await root`systemctl daemon-reload`
  success('Systemd override written')

  step('Restarting services')
  await root`systemctl restart ski-tripper-pb`
  await root`systemctl restart ski-tripper-api`
  await root`systemctl restart caddy`.nothrow()
  success('Services restarted')

  step('Waiting for PocketBase to become healthy')
  const pbExtUrl = env.POCKETBASE_EXTERNAL_URL
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${pbExtUrl}/api/health`)
      if (res.ok) {
        success('PocketBase is healthy')
        break
      }
    } catch {
      // not ready yet
    }
    if (i === 59) fail('PocketBase did not become healthy after 60 attempts')
    await new Promise((r) => setTimeout(r, 2000))
  }

  step('Configuring PocketBase settings')
  try {
    execSync(
      'bun run env:prod bun run infra/scripts/configure-pocketbase.ts --external',
      { cwd: PROJECT_ROOT, stdio: 'pipe', timeout: 120000, encoding: 'utf-8' }
    )
    success('PocketBase settings configured')
  } catch (err: unknown) {
    const output =
      err instanceof Error && 'stdout' in err && 'stderr' in err
        ? `${(err as { stdout: string }).stdout}\n${(err as { stderr: string }).stderr}`
        : String(err)
    fail(`PocketBase settings failed:\n${output}`)
  }

  if (skipResortsUpload) {
    step('Uploading resort data')
    warn('Skipping resort data upload (--skip-resorts-upload)')
  } else {
    step('Uploading resort data')
    try {
      execSync('bun run env:prod bun run tools/resorts.ts upload', {
        cwd: PROJECT_ROOT,
        stdio: 'pipe',
        timeout: 300000,
        encoding: 'utf-8',
      })
      success('Resort data uploaded')
    } catch (err: unknown) {
      const output =
        err instanceof Error && 'stdout' in err && 'stderr' in err
          ? `${(err as { stdout: string }).stdout}\n${(err as { stderr: string }).stderr}`
          : String(err)
      fail(`Resort data upload failed:\n${output}`)
    }
  }
}

deploy()
  .catch((err) => {
    error(`Deploy failed: ${err}`)
    process.exitCode = 1
  })
  .finally(() => dispose())
