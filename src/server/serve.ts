import { requireEnv } from '../shared/env'
import { handleAnalyseProposal, handlePreferenceSearch } from './api'

const { SERVER_HOSTNAME: hostname, SERVER_PORT: portStr } = requireEnv(
  'SERVER_HOSTNAME',
  'SERVER_PORT'
)
const port = parseInt(portStr, 10)

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
