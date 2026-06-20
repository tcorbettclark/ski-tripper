import { describe, expect, it } from 'bun:test'
import { cleanUrls } from './clean-urls'

describe('cleanUrls', () => {
  it('deduplicates www vs non-www, preferring non-www hostname', () => {
    const result = cleanUrls([
      'https://www.example.com/skiing',
      'https://example.com/skiing',
    ])
    expect(result).toEqual(['example.com/skiing'])
  })

  it('strips www. prefix from hostnames', () => {
    const result = cleanUrls(['www.kitzski.at/'])
    expect(result).toEqual(['kitzski.at'])
  })

  it('removes more specific paths under the same hostname, keeping the root', () => {
    const result = cleanUrls([
      'https://kitzski.at/',
      'https://kitzski.at/winter',
    ])
    expect(result).toEqual(['kitzski.at'])
  })

  it('handles the example from the spec', () => {
    const result = cleanUrls([
      'kitzski.at/',
      'kitzbuehel.com/',
      'www.skiresort.info/ski-resort/kitzski-kitzbuehel-kirchberg/slope-offering/',
      'www.skiresort.info/ski-resort/kitzski-kitzbuehel-kirchberg/trail-map/',
      'map.kitzski.at/en/winter/',
      'www.kitzbuehel.com/en/winter-holiday/',
      'www.kitzbuehel.com/en/activities/ski-resort/lift-status/',
      'www.kitzbuehel.com/en/',
    ])
    expect(result).toEqual([
      'kitzbuehel.com',
      'kitzski.at',
      'map.kitzski.at/en/winter',
      'skiresort.info/ski-resort/kitzski-kitzbuehel-kirchberg',
    ])
  })

  it('keeps URLs with different hostnames even if one path is a prefix of another', () => {
    const result = cleanUrls(['kitzski.at/', 'map.kitzski.at/en/winter/'])
    expect(result).toEqual(['kitzski.at', 'map.kitzski.at/en/winter'])
  })

  it('keeps URLs with same hostname but unrelated paths', () => {
    const result = cleanUrls(['example.com/skiing', 'example.com/dining'])
    expect(result).toEqual(['example.com/dining', 'example.com/skiing'])
  })

  it('strips trailing slashes', () => {
    const result = cleanUrls(['example.com/skiing/'])
    expect(result).toEqual(['example.com/skiing'])
  })

  it('handles bare domain with trailing slash', () => {
    const result = cleanUrls(['example.com/'])
    expect(result).toEqual(['example.com'])
  })

  it('removes duplicates after normalisation', () => {
    const result = cleanUrls([
      'example.com/skiing',
      'https://www.example.com/skiing/',
    ])
    expect(result).toEqual(['example.com/skiing'])
  })

  it('returns empty array for empty input', () => {
    expect(cleanUrls([])).toEqual([])
  })

  it('does not remove root path when no more specific paths exist', () => {
    const result = cleanUrls(['example.com/'])
    expect(result).toEqual(['example.com'])
  })

  it('removes deeply nested paths in favour of shallower ones', () => {
    const result = cleanUrls([
      'example.com/a/b/c',
      'example.com/a/b',
      'example.com/a',
    ])
    expect(result).toEqual(['example.com/a'])
  })

  it('keeps sibling paths at the same depth', () => {
    const result = cleanUrls([
      'example.com/skiing/beginner',
      'example.com/skiing/advanced',
      'example.com/skiing',
    ])
    expect(result).toEqual(['example.com/skiing'])
  })

  it('strips query strings and fragments, keeping only hostname+pathname', () => {
    const result = cleanUrls(['example.com/page?query=1'])
    expect(result).toEqual(['example.com/page'])
  })

  it('returns results sorted alphabetically', () => {
    const result = cleanUrls([
      'z.example.com/',
      'a.example.com/',
      'm.example.com/',
    ])
    expect(result).toEqual(['a.example.com', 'm.example.com', 'z.example.com'])
  })
})
