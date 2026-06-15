function serverRequire(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required env var not set: ${name}`)
  return value
}

export function browser_get_pocketbase_url(): string {
  const value = import.meta.env.PUBLIC_POCKETBASE_URL as string | undefined
  if (!value) throw new Error('Missing required env var PUBLIC_POCKETBASE_URL')
  return value
}

export function server_get_pocketbase_url(): string {
  return serverRequire('POCKETBASE_URL')
}

export function server_get_pocketbase_admin_email(): string {
  return serverRequire('POCKETBASE_ADMIN_EMAIL')
}

export function server_get_pocketbase_admin_password(): string {
  return serverRequire('POCKETBASE_ADMIN_PASSWORD')
}

export function server_get_public_pocketbase_url(): string {
  return serverRequire('PUBLIC_POCKETBASE_URL')
}

export function server_get_server_hostname(): string {
  return serverRequire('SERVER_HOSTNAME')
}

export function server_get_server_port(): number {
  const port = parseInt(serverRequire('SERVER_PORT'), 10)
  if (Number.isNaN(port)) throw new Error('SERVER_PORT must be a valid number')
  return port
}

export function server_get_ollama_model(): string {
  return serverRequire('OLLAMA_MODEL')
}

export function server_get_ollama_api_key(): string {
  return serverRequire('OLLAMA_API_KEY')
}

export function server_get_exa_api_key(): string {
  return serverRequire('EXA_API_KEY')
}
