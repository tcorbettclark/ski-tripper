import { afterEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { readJsonl, simpleHash, writeJsonl } from './jsonl'
import type { SeededResort } from './types'

describe('simpleHash', () => {
  it('returns a consistent hash for the same input', () => {
    expect(simpleHash('hello')).toEqual(simpleHash('hello'))
  })

  it('returns different hashes for different inputs', () => {
    expect(simpleHash('hello')).not.toEqual(simpleHash('world'))
  })

  it('returns a base-36 string', () => {
    const hash = simpleHash('test')
    expect(hash).toMatch(/^[0-9a-z]+$/)
  })

  it('handles empty string', () => {
    const hash = simpleHash('')
    expect(hash).toBeTypeOf('string')
    expect(hash.length).toBeGreaterThan(0)
  })
})

describe('readJsonl', () => {
  const tmpDir = path.join(os.tmpdir(), `jsonl-test-${Date.now()}`)

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true })
    } catch {}
  })

  it('throws for non-existent file', () => {
    expect(() => readJsonl(path.join(tmpDir, 'nonexistent.jsonl'))).toThrow(
      /file not found/i
    )
  })

  it('returns empty array for empty file', () => {
    const filePath = path.join(tmpDir, 'empty.jsonl')
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(filePath, '', 'utf-8')
    const result = readJsonl(filePath)
    expect(result).toEqual([])
  })

  it('reads typed objects from a jsonl file', () => {
    const filePath = path.join(tmpDir, 'seeded.jsonl')
    fs.mkdirSync(tmpDir, { recursive: true })
    const items: SeededResort[] = [
      {
        id: 'chamonix-alps-france',
        resortName: 'Chamonix',
        country: 'France',
        region: 'Alps',
      },
      {
        id: 'zermatt-alps-switzerland',
        resortName: 'Zermatt',
        country: 'Switzerland',
        region: 'Alps',
      },
    ]
    writeJsonl(filePath, items)
    const result = readJsonl<SeededResort>(filePath)
    expect(result).toEqual(items)
  })

  it('handles file with trailing newline', () => {
    const filePath = path.join(tmpDir, 'trailing.jsonl')
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(filePath, '{"id":"1","name":"test"}\n', 'utf-8')
    const result = readJsonl<{ id: string; name: string }>(filePath)
    expect(result).toEqual([{ id: '1', name: 'test' }])
  })
})

describe('writeJsonl', () => {
  const tmpDir = path.join(os.tmpdir(), `jsonl-write-test-${Date.now()}`)

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true })
    } catch {}
  })

  it('writes items as newline-delimited JSON', () => {
    const filePath = path.join(tmpDir, 'sub', 'output.jsonl')
    const items = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ]
    writeJsonl(filePath, items)
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toBe('{"id":"a","value":1}\n{"id":"b","value":2}\n')
  })

  it('creates parent directories if they do not exist', () => {
    const filePath = path.join(tmpDir, 'deep', 'nested', 'file.jsonl')
    writeJsonl(filePath, [{ id: 'x' }])
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('round-trips through readJsonl', () => {
    const filePath = path.join(tmpDir, 'roundtrip.jsonl')
    const items: SeededResort[] = [
      {
        id: 'val-disere-alps-france',
        resortName: "Val d'Isère",
        country: 'France',
        region: 'Alps',
      },
    ]
    writeJsonl(filePath, items)
    const result = readJsonl<SeededResort>(filePath)
    expect(result).toEqual(items)
  })
})
