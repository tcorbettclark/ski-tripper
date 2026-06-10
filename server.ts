import { extname, join } from 'node:path'
import { handleAnalyseProposal, handlePreferenceSearch } from './src/server/api'

function getArg(flag: string): string | undefined {
  const match = Bun.argv.find((arg) => arg.startsWith(`--${flag}=`))
  return match?.split('=')[1]
}

const port = parseInt(getArg('port') ?? '5173', 10)
const serveDirName = getArg('serve') ?? 'dist'
const serveDir = join(import.meta.dir, serveDirName)
const publicDir = join(import.meta.dir, 'public')
const indexHtml = Bun.file(join(serveDir, 'index.html'))

const keyPath = join(import.meta.dir, 'localhost-key.pem')
const certPath = join(import.meta.dir, 'localhost.pem')

async function ensureCertificates() {
  const [keyExists, certExists] = await Promise.all([
    Bun.file(keyPath).exists(),
    Bun.file(certPath).exists(),
  ])
  if (keyExists && certExists) return

  const proc = Bun.spawn(
    [
      'mkcert',
      '-key-file',
      keyPath,
      '-cert-file',
      certPath,
      'localhost',
      'localhost.dev',
    ],
    {
      stderr: 'inherit',
    }
  )
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`mkcert failed with exit code ${exitCode}`)
  }
}

await ensureCertificates()

const mimeTypes: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.html': 'text/html',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

Bun.serve({
  port,
  tls: {
    key: Bun.file(keyPath),
    cert: Bun.file(certPath),
  },
  fetch: async (req) => {
    const url = new URL(req.url)

    if (url.pathname === '/api/analyse-proposal') {
      return handleAnalyseProposal(req)
    }

    if (url.pathname === '/api/preference-search') {
      return handlePreferenceSearch(req)
    }

    const distFile = Bun.file(join(serveDir, url.pathname))
    if (await distFile.exists()) {
      const ext = extname(url.pathname)
      const contentType = mimeTypes[ext] || 'application/octet-stream'
      return new Response(distFile, {
        headers: { 'Content-Type': contentType },
      })
    }
    const publicFile = Bun.file(join(publicDir, url.pathname))
    if (await publicFile.exists()) {
      const ext = extname(url.pathname)
      const contentType = mimeTypes[ext] || 'application/octet-stream'
      return new Response(publicFile, {
        headers: { 'Content-Type': contentType },
      })
    }
    const ext = extname(url.pathname)
    if (ext && ext !== '.html') {
      return new Response('Not Found', { status: 404 })
    }
    return new Response(indexHtml, {
      headers: { 'Content-Type': 'text/html' },
    })
  },
})

console.log(`Serving ${serveDirName}/ at https://localhost:${port}`)
