#!/usr/bin/env bun

import {
  BOLD,
  banner,
  error,
  info,
  RESET,
  raw,
  section,
  success,
  testFail,
  testPass,
  testSummary,
} from './lib/log'

let passed = 0
let failed = 0

async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 15000, ...rest } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...rest, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function pass(msg: string) {
  passed++
  testPass(msg)
}

function fail(msg: string, detail?: string) {
  failed++
  testFail(msg, detail)
}

async function check(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    fail(label, err instanceof Error ? err.message : String(err))
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    error(`Required env var ${name} is not set`)
    error(
      `Run with: ${BOLD}bun run env:prod bun run tools/smoke-test.ts${RESET}`
    )
    process.exit(1)
  }
  return value
}

async function askYesNo(question: string): Promise<boolean> {
  process.stdout.write(`${BOLD}${question}${RESET} [y/N] `)

  return new Promise((resolve) => {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.once('data', (data) => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      const answer = data.toString().trim().toLowerCase()
      raw('')
      resolve(answer === 'y' || answer === 'yes')
    })
  })
}

async function main() {
  const domain = requireEnv('PUBLIC_DOMAIN')
  const pbExternalUrl = requireEnv('POCKETBASE_EXTERNAL_URL')
  const appUrl = requireEnv('PUBLIC_EXTERNAL_URL')

  banner('Ski Tripper — Production Smoke Test')
  info(`App:         ${appUrl}`)
  info(`PocketBase:  ${pbExternalUrl}`)

  // ── 1. TLS / HTTPS ──

  section('1. TLS / HTTPS')

  await check('HTTPS responds on app domain', async () => {
    const res = await fetchWithTimeout(appUrl)
    if (!res.ok && res.status !== 200) {
      fail(`HTTPS responds on app domain`, `Status ${res.status}`)
      return
    }
    if (!res.url.startsWith('https://')) {
      fail(
        `HTTPS responds on app domain`,
        `Redirected to non-HTTPS: ${res.url}`
      )
      return
    }
    pass('HTTPS responds on app domain')
  })

  await check('TLS certificate is valid', async () => {
    try {
      await fetchWithTimeout(appUrl)
      pass(`TLS certificate is valid (no certificate error)`)
    } catch (err) {
      fail(
        'TLS certificate is valid',
        err instanceof Error ? err.message : String(err)
      )
    }
  })

  await check('HTTPS responds on PocketBase domain', async () => {
    try {
      const res = await fetchWithTimeout(pbExternalUrl)
      pass(`HTTPS responds on PocketBase domain (status ${res.status})`)
    } catch (err) {
      fail(
        'HTTPS responds on PocketBase domain',
        err instanceof Error ? err.message : String(err)
      )
    }
  })

  // ── 2. WWW redirect ──

  section('2. WWW redirect')

  await check('www redirects to bare domain (301)', async () => {
    const wwwUrl = appUrl.replace('://', '://www.')
    const res = await fetchWithTimeout(wwwUrl, { redirect: 'manual' })
    if (res.status !== 301) {
      fail(
        `www redirects to bare domain (301)`,
        `Expected 301, got ${res.status}`
      )
      return
    }
    const location = res.headers.get('location') || ''
    if (!location.includes(domain) || location.includes('www.')) {
      fail(
        'www redirects to bare domain (301)',
        `Redirect location is ${location}, expected ${appUrl}`
      )
      return
    }
    pass('www redirects to bare domain (301)')
  })

  // ── 3. HTML / SPA ──

  section('3. HTML / SPA')

  await check('GET / returns 200 with HTML', async () => {
    const res = await fetchWithTimeout(appUrl)
    if (res.status !== 200) {
      fail('GET / returns 200 with HTML', `Status ${res.status}`)
      return
    }
    const text = await res.text()
    if (!text.includes('<div id="root">')) {
      fail(
        'GET / returns 200 with HTML',
        'Response does not contain <div id="root">'
      )
      return
    }
    pass('GET / returns 200 with HTML')
  })

  await check('SPA route /verify returns 200 with HTML', async () => {
    const res = await fetchWithTimeout(`${appUrl}/verify`)
    if (res.status !== 200) {
      fail('SPA route /verify returns 200 with HTML', `Status ${res.status}`)
      return
    }
    const text = await res.text()
    if (!text.includes('<div id="root">')) {
      fail(
        'SPA route /verify returns 200 with HTML',
        'Response does not contain <div id="root">'
      )
      return
    }
    pass('SPA route /verify returns 200 with HTML')
  })

  await check('SPA route /reset-password returns 200 with HTML', async () => {
    const res = await fetchWithTimeout(`${appUrl}/reset-password`)
    if (res.status !== 200) {
      fail(
        'SPA route /reset-password returns 200 with HTML',
        `Status ${res.status}`
      )
      return
    }
    const text = await res.text()
    if (!text.includes('<div id="root">')) {
      fail(
        'SPA route /reset-password returns 200 with HTML',
        'Response does not contain <div id="root">'
      )
      return
    }
    pass('SPA route /reset-password returns 200 with HTML')
  })

  // ── 4. Static assets ──

  section('4. Static assets')

  await check('main.js bundle loads', async () => {
    const res = await fetchWithTimeout(`${appUrl}/main.js`)
    if (res.status !== 200) {
      fail('main.js bundle loads', `Status ${res.status}`)
      return
    }
    const contentType = res.headers.get('content-type') || ''
    if (
      !contentType.includes('javascript') &&
      !contentType.includes('octet-stream')
    ) {
      fail(
        'main.js bundle loads',
        `Content-Type is ${contentType}, expected application/javascript`
      )
      return
    }
    pass('main.js bundle loads')
  })

  await check('main.css bundle loads', async () => {
    const res = await fetchWithTimeout(`${appUrl}/main.css`)
    if (res.status !== 200) {
      fail('main.css bundle loads', `Status ${res.status}`)
      return
    }
    pass('main.css bundle loads')
  })

  await check('robots.txt loads', async () => {
    const res = await fetchWithTimeout(`${appUrl}/robots.txt`)
    if (res.status !== 200) {
      fail('robots.txt loads', `Status ${res.status}`)
      return
    }
    const text = await res.text()
    if (!text.includes('User-agent')) {
      fail('robots.txt loads', 'Content does not look like a robots.txt')
      return
    }
    pass('robots.txt loads')
  })

  await check('.well-known/security.txt loads', async () => {
    const res = await fetchWithTimeout(`${appUrl}/.well-known/security.txt`)
    if (res.status !== 200) {
      fail('.well-known/security.txt loads', `Status ${res.status}`)
      return
    }
    const text = await res.text()
    if (!text.includes('security@ski-tripper.com')) {
      fail(
        '.well-known/security.txt loads',
        'Content does not contain expected contact email'
      )
      return
    }
    pass('.well-known/security.txt loads')
  })

  await check('Flag image loads (fr.png)', async () => {
    const res = await fetchWithTimeout(`${appUrl}/flags/fr.png`)
    if (res.status !== 200) {
      fail('Flag image loads (fr.png)', `Status ${res.status}`)
      return
    }
    const contentType = res.headers.get('content-type') || ''
    if (
      !contentType.includes('image/png') &&
      !contentType.includes('octet-stream')
    ) {
      fail(
        'Flag image loads (fr.png)',
        `Content-Type is ${contentType}, expected image/png`
      )
      return
    }
    pass('Flag image loads (fr.png)')
  })

  // ── 5. Custom 404 ──

  section('5. Custom 404')

  await check('Non-existent path returns custom 404 page', async () => {
    const res = await fetchWithTimeout(
      `${appUrl}/this-page-does-not-exist-xyzzy`
    )
    if (res.status !== 404) {
      fail(
        'Non-existent path returns custom 404 page',
        `Expected 404, got ${res.status}`
      )
      return
    }
    const text = await res.text()
    if (!text.includes("doesn't exist") && !text.includes('404')) {
      fail(
        'Non-existent path returns custom 404 page',
        "Response doesn't look like custom 404 page"
      )
      return
    }
    pass('Non-existent path returns custom 404 page')
  })

  // ── 6. Security headers ──

  section('6. Security headers')

  const securityHeaders: Record<string, string> = {
    'strict-transport-security': 'max-age=',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'content-security-policy': "default-src 'self'",
    'x-xss-protection': '0',
  }

  let headersRes: Response
  try {
    headersRes = await fetchWithTimeout(appUrl)
  } catch (err) {
    fail('Fetch page for security header check', String(err))
    headersRes = null as unknown as Response
  }

  if (headersRes) {
    for (const [header, expected] of Object.entries(securityHeaders)) {
      const value = headersRes.headers.get(header)
      if (!value) {
        fail(`${header} header is present`, 'Header is missing')
      } else if (!value.toLowerCase().includes(expected.toLowerCase())) {
        fail(
          `${header} header contains expected value`,
          `Got "${value}", expected to contain "${expected}"`
        )
      } else {
        pass(`${header}: ${value.split(';')[0]}…`)
      }
    }
  }

  // ── 7. Compression ──

  section('7. Compression')

  await check('HTML responses are compressed', async () => {
    const res = await fetchWithTimeout(appUrl, {
      headers: { 'Accept-Encoding': 'gzip, zstd' },
    })
    const encoding = res.headers.get('content-encoding')
    if (!encoding) {
      fail('HTML responses are compressed', 'No Content-Encoding header')
      return
    }
    pass(`HTML responses are compressed (${encoding})`)
  })

  // ── 8. PocketBase ──

  section('8. PocketBase')

  await check('PocketBase health check passes', async () => {
    const res = await fetchWithTimeout(`${pbExternalUrl}/api/health`)
    if (res.status !== 200) {
      fail('PocketBase health check passes', `Status ${res.status}`)
      return
    }
    pass('PocketBase health check passes')
  })

  await check('PocketBase admin UI is blocked (returns 403)', async () => {
    const res = await fetchWithTimeout(`${pbExternalUrl}/_/`)
    if (res.status !== 403) {
      fail(
        'PocketBase admin UI is blocked (returns 403)',
        `Expected 403, got ${res.status}`
      )
      return
    }
    pass('PocketBase admin UI is blocked (returns 403)')
  })

  // ── 9. API server ──

  section('9. API server')

  await check('API returns 404 for unknown endpoint', async () => {
    const res = await fetchWithTimeout(`${appUrl}/api/nonexistent`)
    if (res.status !== 404) {
      fail('API returns 404 for unknown endpoint', `Status ${res.status}`)
      return
    }
    pass('API returns 404 for unknown endpoint')
  })

  await check('API requires auth for analyse-proposal', async () => {
    const res = await fetchWithTimeout(`${appUrl}/api/analyse-proposal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId: 'test', tripId: 'test' }),
    })
    if (res.status !== 401) {
      fail(
        'API requires auth for analyse-proposal',
        `Expected 401, got ${res.status}`
      )
      return
    }
    pass('API requires auth for analyse-proposal (401)')
  })

  await check('API requires auth for preference-search', async () => {
    const res = await fetchWithTimeout(`${appUrl}/api/preference-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: 'test' }),
    })
    if (res.status !== 401) {
      fail(
        'API requires auth for preference-search',
        `Expected 401, got ${res.status}`
      )
      return
    }
    pass('API requires auth for preference-search (401)')
  })

  await check('API rejects GET on POST-only endpoints', async () => {
    const res = await fetchWithTimeout(`${appUrl}/api/analyse-proposal`)
    if (res.status !== 405) {
      fail(
        'API rejects GET on POST-only endpoints',
        `Expected 405, got ${res.status}`
      )
      return
    }
    pass('API rejects GET on POST-only endpoints (405)')
  })

  // ── 10. Summary ──

  banner('Automated Test Summary')
  testSummary(passed, failed)

  if (failed > 0) {
    error('Fix the failures above before continuing with manual tests.')
    process.exit(1)
  }

  // ── 11. Manual checks ──

  banner('Manual Checks')

  const manualPassed: string[] = []
  const manualFailed: string[] = []

  async function manualCheck(
    description: string,
    instructions: string
  ): Promise<void> {
    const confirmed = await askYesNo(
      `${BOLD}${description}${RESET}\n  ${instructions}`
    )
    if (confirmed) {
      manualPassed.push(description)
      testPass(description)
    } else {
      manualFailed.push(description)
      testFail(description)
    }
  }

  await manualCheck(
    'App loads in browser',
    `Open ${appUrl} in a browser. The Ski Tripper app should render with the correct theme.`
  )

  await manualCheck(
    'Auth + SMTP works (signup, verification email, login)',
    `Sign up at ${appUrl} — a verification email should arrive (SMTP via Resend). Then verify and log in.`
  )

  await manualCheck(
    'AI analysis works (Ollama API key)',
    'Create a trip and proposal, then trigger AI analysis. The LLM should stream a response. This verifies the OLLAMA_API_KEY is valid.'
  )

  // ── 12. Final summary ──

  banner('Final Summary')
  testSummary(passed, failed, 'Automated')
  testSummary(manualPassed.length, manualFailed.length, 'Manual')

  if (failed > 0 || manualFailed.length > 0) {
    error('Some checks failed. Review the output above.')
    process.exit(1)
  }

  success('All checks passed! Production is healthy.')
}

main().catch((err) => {
  error(`Fatal error: ${err}`)
  process.exit(1)
})
