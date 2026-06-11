import { handleAnalyseProposal, handlePreferenceSearch } from './api'

const hostname = process.env.SERVER_HOSTNAME
if (!hostname) throw new Error('SERVER_HOSTNAME env var is required')

const port = parseInt(process.env.SERVER_PORT ?? '', 10)
if (!port) throw new Error('SERVER_PORT env var is required')

Bun.serve({
  hostname,
  port,
  fetch: async (req) => {
    const url = new URL(req.url)

    if (url.pathname === '/api/analyse-proposal') {
      return handleAnalyseProposal(req)
    }

    if (url.pathname === '/api/preference-search') {
      return handlePreferenceSearch(req)
    }

    return new Response('Not Found', { status: 404 })
  },
})

console.log(`API server listening on http://${hostname}:${port}`)
