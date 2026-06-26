import { server_get_server_hostname, server_get_server_port } from './env'
import { handleAnalyseProposal } from './handlers/analyse-proposal'
import { handlePreferenceSearch } from './handlers/preference-search'
import { handleSetPassword } from './handlers/set-password'

function main() {
  const hostname = server_get_server_hostname()
  const port = server_get_server_port()

  Bun.serve({
    hostname,
    port,
    fetch: async (req) => {
      const url = new URL(req.url)
      console.log(`${req.method} ${url.pathname}`)

      if (url.pathname === '/api/analyse-proposal') {
        return handleAnalyseProposal(req)
      }

      if (url.pathname === '/api/preference-search') {
        return handlePreferenceSearch(req)
      }

      if (url.pathname === '/api/set-password') {
        return handleSetPassword(req)
      }

      return new Response('Not Found', { status: 404 })
    },
  })

  console.log(`API server listening on http://${hostname}:${port}`)
}

main()
