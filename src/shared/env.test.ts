import { beforeEach, describe, expect, it } from 'bun:test'
import { server_get_pocketbase_url, server_get_server_port } from './env'

describe('server_* env functions', () => {
  beforeEach(() => {
    delete process.env.POCKETBASE_URL
    delete process.env.SERVER_PORT
  })

  it('returns values when env vars are set', () => {
    process.env.POCKETBASE_URL = 'http://localhost:8090'
    expect(server_get_pocketbase_url()).toBe('http://localhost:8090')
  })

  it('throws for missing env var', () => {
    expect(() => server_get_pocketbase_url()).toThrow(
      'Required env var not set: POCKETBASE_URL'
    )
  })

  it('server_get_server_port returns a number', () => {
    process.env.SERVER_PORT = '3000'
    expect(server_get_server_port()).toBe(3000)
  })

  it('server_get_server_port throws for non-numeric port', () => {
    process.env.SERVER_PORT = 'abc'
    expect(() => server_get_server_port()).toThrow(
      'SERVER_PORT must be a valid number'
    )
  })
})
