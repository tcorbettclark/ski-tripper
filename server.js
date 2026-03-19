import { join } from 'path'

const dist = join(import.meta.dir, 'dist')
const html = Bun.file(join(import.meta.dir, 'index.html'))

Bun.serve({
  port: 5173,
  async fetch(req) {
    const url = new URL(req.url)
    const file = Bun.file(join(dist, url.pathname))
    if (await file.exists()) {
      return new Response(file)
    }
    return new Response(html, { headers: { 'Content-Type': 'text/html' } })
  },
})

console.log('Dev server running at http://localhost:5173')
