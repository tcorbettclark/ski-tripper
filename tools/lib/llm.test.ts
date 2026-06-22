import { describe, expect, it } from 'bun:test'
import * as z from 'zod'
import {
  buildJsonSchema,
  jsonCodec,
  LLM_RETRY_EMPTY_PROMPT,
  LLM_RETRY_PARSE_PROMPT,
  LLM_SYSTEM_PROMPT,
  LLM_USER_PROMPT,
  stringCoercedArray,
} from './llm'

describe('stringCoercedArray', () => {
  it('accepts a valid array', () => {
    const schema = z.object({
      items: stringCoercedArray(z.string()),
    })
    const result = schema.parse({ items: ['a', 'b'] })
    expect(result).toEqual({ items: ['a', 'b'] })
  })

  it('parses a JSON string into an array', () => {
    const schema = z.object({
      items: stringCoercedArray(z.string()),
    })
    const result = schema.parse({ items: '["a","b"]' })
    expect(result).toEqual({ items: ['a', 'b'] })
  })

  it('rejects a string that is not valid JSON', () => {
    const schema = z.object({
      items: stringCoercedArray(z.string()),
    })
    expect(() => schema.parse({ items: 'not json' })).toThrow()
  })

  it('rejects a JSON string that parses to a non-array', () => {
    const schema = z.object({
      items: stringCoercedArray(z.string()),
    })
    expect(() => schema.parse({ items: '"hello"' })).toThrow()
  })

  it('accepts nullable optional string arrays', () => {
    const schema = z.object({
      websites: stringCoercedArray(z.string()).nullable().optional(),
    })
    expect(schema.parse({ websites: ['https://example.com'] })).toEqual({
      websites: ['https://example.com'],
    })
    expect(schema.parse({ websites: null })).toEqual({ websites: null })
    expect(schema.parse({})).toEqual({})
  })

  it('works with complex element schemas', () => {
    const schema = z.object({
      inconsistencies: stringCoercedArray(
        z.object({
          field: z.enum(['a', 'b']),
          value: z.number().optional(),
        })
      ),
    })
    const result = schema.parse({
      inconsistencies: '[{"field":"a","value":1}]',
    })
    expect(result).toEqual({
      inconsistencies: [{ field: 'a', value: 1 }],
    })
  })
})

describe('jsonCodec', () => {
  const simpleSchema = z.object({
    name: z.string(),
    count: z.number().int(),
  })

  it('decodes valid JSON matching the schema', () => {
    const codec = jsonCodec(simpleSchema)
    const result = codec.decode('{"name":"test","count":5}', {
      reportInput: true,
    })
    expect(result).toEqual({ name: 'test', count: 5 })
  })

  it('decodes JSON wrapped in markdown code blocks', () => {
    const codec = jsonCodec(simpleSchema)
    const result = codec.decode('```json\n{"name":"test","count":5}\n```', {
      reportInput: true,
    })
    expect(result).toEqual({ name: 'test', count: 5 })
  })

  it('throws for invalid JSON', () => {
    const codec = jsonCodec(simpleSchema)
    expect(() =>
      codec.decode('not json at all', { reportInput: true })
    ).toThrow()
  })

  it('encodes objects back to JSON strings', () => {
    const codec = jsonCodec(simpleSchema)
    const encoded = codec.encode({ name: 'test', count: 5 })
    expect(JSON.parse(encoded)).toEqual({ name: 'test', count: 5 })
  })

  it('handles arrays', () => {
    const arraySchema = z.object({
      items: z.array(z.string()),
    })
    const codec = jsonCodec(arraySchema)
    const result = codec.decode('{"items":["a","b","c"]}', {
      reportInput: true,
    })
    expect(result).toEqual({ items: ['a', 'b', 'c'] })
  })

  it('handles nullable fields', () => {
    const nullableSchema = z.object({
      value: z.string().nullable(),
    })
    const codec = jsonCodec(nullableSchema)
    const result = codec.decode('{"value":null}', { reportInput: true })
    expect(result).toEqual({ value: null })
  })
})

describe('buildJsonSchema', () => {
  it('returns an object schema with expected properties', () => {
    const schema = buildJsonSchema()
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('terrainDescription')
    expect(schema.properties).toHaveProperty('offPisteDescription')
    expect(schema.properties).toHaveProperty('valueDescription')
    expect(schema.properties).toHaveProperty('familyDescription')
    expect(schema.properties).toHaveProperty('apresSkiDescription')
    expect(schema.properties).toHaveProperty('resortCharacterDescription')
    expect(schema.properties).toHaveProperty('liftSystemDescription')
    expect(schema.properties).toHaveProperty('nearestAirport')
    expect(schema.properties).toHaveProperty('transferTime')
    expect(schema.properties).toHaveProperty('snowReliability')
    expect(schema.properties).toHaveProperty('skiSeasonMonths')
    expect(schema.properties).toHaveProperty('websites')
    expect(schema.properties).toHaveProperty('linkedResortsDescription')
  })

  it('makes fields nullable via anyOf', () => {
    const schema = buildJsonSchema()
    const terrain = schema.properties!.terrainDescription as {
      anyOf: unknown[]
    }
    expect(terrain.anyOf).toBeDefined()
    expect(terrain.anyOf).toHaveLength(2)
  })
})

describe('LLM prompts', () => {
  it('LLM_SYSTEM_PROMPT contains {SCHEMA} placeholder', () => {
    expect(LLM_SYSTEM_PROMPT).toContain('{SCHEMA}')
  })

  it('LLM_SYSTEM_PROMPT contains recency rule', () => {
    expect(LLM_SYSTEM_PROMPT).toContain('more recent sources')
    expect(LLM_SYSTEM_PROMPT).toContain('publication date')
  })

  it('LLM_USER_PROMPT includes resort name and country', () => {
    const prompt = LLM_USER_PROMPT('Chamonix', 'France', 'some source text')
    expect(prompt).toContain('Chamonix')
    expect(prompt).toContain('France')
    expect(prompt).toContain('some source text')
  })

  it('LLM_USER_PROMPT includes known facts when provided', () => {
    const prompt = LLM_USER_PROMPT(
      'Chamonix',
      'France',
      'source text',
      '  pisteKm: 110'
    )
    expect(prompt).toContain('Known facts already captured')
    expect(prompt).toContain('pisteKm: 110')
  })

  it('LLM_RETRY_EMPTY_PROMPT instructs the LLM to retry', () => {
    expect(LLM_RETRY_EMPTY_PROMPT).toContain('empty')
    expect(LLM_RETRY_EMPTY_PROMPT).toContain('JSON')
  })

  it('LLM_RETRY_PARSE_PROMPT includes the invalid content', () => {
    const prompt = LLM_RETRY_PARSE_PROMPT('broken json here')
    expect(prompt).toContain('broken json here')
    expect(prompt).toContain('not valid JSON')
    expect(prompt).toContain('valid JSON')
  })
})
