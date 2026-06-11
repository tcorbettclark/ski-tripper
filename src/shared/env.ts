// Server-side: reads env vars by name from process.env at runtime.
// Use in server code: const { FOO } = requireEnv('FOO')
// Do not use in client code — use require(import.meta.env.PUBLIC_FOO) instead.
export function requireEnv<T extends string>(
  ...names: [string, ...string[]]
): Record<string, T> {
  if (typeof process === 'undefined') {
    throw new Error(
      'requireEnv() cannot be used in browser code — use require(import.meta.env.PUBLIC_FOO) instead'
    )
  }
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

// Client-side: validates that a value (typically from import.meta.env) is set.
// Use in client code: const url = require(import.meta.env.PUBLIC_FOO)
// import.meta.env values are inlined at build time by Bun's --env flag.
// Do not use in server code — use requireEnv('FOO') instead.
export function require<T extends string>(value: T | undefined): T {
  if (typeof process !== 'undefined' && process.env) {
    throw new Error(
      'require() is for client-side env vars — use requireEnv() in server code instead'
    )
  }
  if (!value) throw new Error('Missing required env var')
  return value
}
