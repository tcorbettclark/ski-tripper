import { handleAnalyseProposal, handlePreferenceSearch } from './api'

function getArg(flag: string): string | undefined {
  const match = Bun.argv.find((arg) => arg.startsWith(`--${flag}=`))
  return match?.split('=')[1]
}

const port = parseInt(getArg('port') ?? '5173', 10)

Bun.serve({
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

console.log(`API server listening on http://localhost:${port}`)
