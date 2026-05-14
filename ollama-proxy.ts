const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY
const OLLAMA_BASE_URL = 'https://ollama.com/api'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const errorResponse = (message: string, status = 400) =>
  jsonResponse({ error: message }, status)

Bun.serve({
  port: 8080,
  fetch: async (req) => {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405)
    }

    let json: { prompt?: string; model?: string }
    try {
      json = await req.json()
    } catch {
      return errorResponse('Invalid JSON')
    }

    // const { prompt, model = 'gpt-oss:20b' } = json
    const { prompt, model = 'kimi-k2.6:cloud' } = json

    if (!prompt || typeof prompt !== 'string')
      return errorResponse('prompt is required and must be a string')

    const upstream = await fetch(`${OLLAMA_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OLLAMA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'Reply as JSON',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        raw: false,
        format: 'json',
      }),
    })

    if (!upstream.ok) {
      const error = await upstream.text()
      return errorResponse(error, upstream.status)
    }

    const data = await upstream.json()
    return jsonResponse(data)
  },
})

console.log(`Ollama proxy running at http://localhost:8080`)
