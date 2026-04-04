/* global Bun */

import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { extname, join } from 'node:path'

// Derive a unique port number for the current git worktree/branch combination.
// This allows multiple dev servers to run simultaneously in different worktrees
// or on different branches without port conflicts.
function getPort() {
  try {
    const gitDir = execSync('git rev-parse --git-dir', {
      encoding: 'utf-8',
    }).trim()
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
    }).trim()
    const identifier = `${gitDir}:${branch}`
    // Hash the identifier and derive a port between 7000-7999
    const hash = createHash('sha256').update(identifier).digest()
    return (hash.readUInt16BE(0) % 1000) + 7000
  } catch {
    // Fall back to default port if not in a git repo
    return 5173
  }
}

const port = getPort()
const dist = join(import.meta.dir, 'dist')
const indexHtml = Bun.file(join(import.meta.dir, 'index.html'))

const mimeTypes = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.html': 'text/html',
}

Bun.serve({
  port,
  fetch: async (req) => {
    const url = new URL(req.url)
    const file = Bun.file(join(dist, url.pathname))
    if (await file.exists()) {
      const ext = extname(url.pathname)
      const contentType = mimeTypes[ext] || 'application/octet-stream'
      return new Response(file, {
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
