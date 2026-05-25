/* global Bun */

import { extname, join } from 'node:path'

const port = parseInt(
  Bun.argv.find((arg) => arg.startsWith('--port='))?.split('=')[1] ?? '5173',
  10
)
const dist = join(import.meta.dir, 'dist')
const publicDir = join(import.meta.dir, 'public')
const indexHtml = Bun.file(join(import.meta.dir, 'index.html'))

const mimeTypes = {
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
  fetch: async (req) => {
    const url = new URL(req.url)
    const distFile = Bun.file(join(dist, url.pathname))
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

console.log(`Dev server running at http://localhost:${port}`)
