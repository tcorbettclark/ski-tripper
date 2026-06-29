import { beforeEach, describe, expect, it } from 'bun:test'
import { browser_get_api_url, browser_get_pocketbase_url } from './env'

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

describe('browser_get_api_url', () => {
  beforeEach(() => {
    delete process.env.PUBLIC_EXTERNAL_URL
  })

  it('returns URL with endpoint', () => {
    process.env.PUBLIC_EXTERNAL_URL = 'https://example.com'
    expect(browser_get_api_url('/api/test')).toBe(
      'https://example.com/api/test'
    )
  })

  it('throws for missing env var', () => {
    expect(() => browser_get_api_url('/api/test')).toThrow(
      'Missing required env var PUBLIC_EXTERNAL_URL'
    )
  })
})
