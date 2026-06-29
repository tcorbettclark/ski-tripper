function serverRequire(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Required env var not set: ${name}`)
  return value
}

export function server_get_pocketbase_hostname(): string {
  return serverRequire('POCKETBASE_HOSTNAME')
}

export function server_get_pocketbase_port(): number {
  const port = parseInt(serverRequire('POCKETBASE_PORT'), 10)
  if (Number.isNaN(port))
    throw new Error('POCKETBASE_PORT must be a valid number')
  return port
}

export function server_get_pocketbase_admin_email(): string {
  return serverRequire('POCKETBASE_ADMIN_EMAIL')
}

export function server_get_pocketbase_admin_password(): string {
  return serverRequire('POCKETBASE_ADMIN_PASSWORD')
}

export function server_get_pocketbase_external_url(): string {
  return serverRequire('POCKETBASE_EXTERNAL_URL')
}

export function server_get_server_hostname(): string {
  return serverRequire('SERVER_HOSTNAME')
}

export function server_get_server_port(): number {
  const port = parseInt(serverRequire('SERVER_PORT'), 10)
  if (Number.isNaN(port)) throw new Error('SERVER_PORT must be a valid number')
  return port
}

const OLLAMA_MODEL_DEFAULTS = {
  OLLAMA_MODEL_ENRICH: 'deepseek-v4-flash',
  OLLAMA_MODEL_AUDIT: 'kimi-k2.6',
  OLLAMA_MODEL_ANALYSIS: 'kimi-k2.6',
  OLLAMA_MODEL_PREFERENCE_SEARCH: 'minimax-m3',
  OLLAMA_MODEL_HEALTH_CHECK: 'deepseek-v4-flash',
} as const

function serverGetOllamaModel(
  envKey: keyof typeof OLLAMA_MODEL_DEFAULTS
): string {
  return process.env[envKey] || OLLAMA_MODEL_DEFAULTS[envKey]
}

export const server_get_ollama_model_enrich = () =>
  serverGetOllamaModel('OLLAMA_MODEL_ENRICH')
export const server_get_ollama_model_audit = () =>
  serverGetOllamaModel('OLLAMA_MODEL_AUDIT')
export const server_get_ollama_model_analysis = () =>
  serverGetOllamaModel('OLLAMA_MODEL_ANALYSIS')
export const server_get_ollama_model_preference_search = () =>
  serverGetOllamaModel('OLLAMA_MODEL_PREFERENCE_SEARCH')
export const server_get_ollama_model_health_check = () =>
  serverGetOllamaModel('OLLAMA_MODEL_HEALTH_CHECK')

export function server_get_ollama_api_key(): string {
  return serverRequire('OLLAMA_API_KEY')
}

export function server_get_exa_api_key(): string {
  return serverRequire('EXA_API_KEY')
}
