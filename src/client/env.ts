export function isBunCLI(): boolean {
  return typeof process !== 'undefined' && !!process.versions?.bun
}

export function browser_get_pocketbase_url(): string {
  const value: string | undefined = process.env.PUBLIC_POCKETBASE_DOMAIN
  if (!value)
    throw new Error('Missing required env var PUBLIC_POCKETBASE_DOMAIN')
  return `https://${value}`
}

export function browser_get_api_url(endpoint: string): string {
  const value: string | undefined = process.env.PUBLIC_EXTERNAL_URL
  if (!value) throw new Error('Missing required env var PUBLIC_EXTERNAL_URL')
  return `${value}${endpoint}`
}
