import {
  server_get_server_hostname,
  server_get_server_port,
} from '../shared/env'
import { handleAnalyseProposal, handlePreferenceSearch } from './api'

const hostname = server_get_server_hostname()
const port = server_get_server_port()

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
