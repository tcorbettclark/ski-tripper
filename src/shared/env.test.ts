import { beforeEach, describe, expect, it } from 'bun:test'
import {
  browser_get_pocketbase_url,
  server_get_pocketbase_hostname,
  server_get_pocketbase_port,
  server_get_server_port,
} from './env'

describe('server_* env functions', () => {
  beforeEach(() => {
    delete process.env.POCKETBASE_HOSTNAME
    delete process.env.POCKETBASE_PORT
    delete process.env.SERVER_PORT
  })

  it('server_get_pocketbase_hostname returns value when set', () => {
    process.env.POCKETBASE_HOSTNAME = 'localhost'
    expect(server_get_pocketbase_hostname()).toBe('localhost')
  })

  it('server_get_pocketbase_hostname throws for missing env var', () => {
    expect(() => server_get_pocketbase_hostname()).toThrow(
      'Required env var not set: POCKETBASE_HOSTNAME'
    )
  })

  it('server_get_pocketbase_port returns a number', () => {
    process.env.POCKETBASE_PORT = '8090'
    expect(server_get_pocketbase_port()).toBe(8090)
  })

  it('server_get_pocketbase_port throws for missing env var', () => {
    expect(() => server_get_pocketbase_port()).toThrow(
      'Required env var not set: POCKETBASE_PORT'
    )
  })

  it('server_get_pocketbase_port throws for non-numeric port', () => {
    process.env.POCKETBASE_PORT = 'abc'
    expect(() => server_get_pocketbase_port()).toThrow(
      'POCKETBASE_PORT must be a valid number'
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

describe('browser_get_pocketbase_url', () => {
  beforeEach(() => {
    delete process.env.PUBLIC_POCKETBASE_DOMAIN
  })

  it('returns https URL from domain', () => {
    process.env.PUBLIC_POCKETBASE_DOMAIN = 'pb.example.com'
    expect(browser_get_pocketbase_url()).toBe('https://pb.example.com')
  })

  it('throws for missing env var', () => {
    expect(() => browser_get_pocketbase_url()).toThrow(
      'Missing required env var PUBLIC_POCKETBASE_DOMAIN'
    )
  })
})
