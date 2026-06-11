export function requireEnv<T extends string>(
  ...names: [string, ...string[]]
): Record<string, T> {
  const env: Record<string, T> = {}
  const missing: string[] = []
  for (const name of names) {
    const value = process.env[name]
    if (!value) {
      missing.push(name)
    } else {
      env[name] = value as T
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Required env var${missing.length > 1 ? 's' : ''} not set: ${missing.join(', ')}`
    )
  }
  return env
}
