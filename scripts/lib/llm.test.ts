import { describe, expect, it } from 'bun:test'
import * as z from 'zod'
import {
  buildJsonSchema,
  jsonCodec,
  LLM_SYSTEM_PROMPT,
  LLM_USER_PROMPT,
} from './llm'

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
    expect(schema.properties).toHaveProperty('description')
    expect(schema.properties).toHaveProperty('summitAltitude')
    expect(schema.properties).toHaveProperty('baseAltitude')
    expect(schema.properties).toHaveProperty('nearestAirport')
    expect(schema.properties).toHaveProperty('pisteKm')
    expect(schema.properties).toHaveProperty('websites')
    expect(schema.properties).toHaveProperty('linkedResortsDescription')
  })

  it('makes fields nullable via anyOf', () => {
    const schema = buildJsonSchema()
    const desc = schema.properties!.description as { anyOf: unknown[] }
    expect(desc.anyOf).toBeDefined()
    expect(desc.anyOf).toHaveLength(2)
  })
})

describe('LLM prompts', () => {
  it('LLM_SYSTEM_PROMPT contains {SCHEMA} placeholder', () => {
    expect(LLM_SYSTEM_PROMPT).toContain('{SCHEMA}')
  })

  it('LLM_USER_PROMPT includes resort name and country', () => {
    const prompt = LLM_USER_PROMPT('Chamonix', 'France', 'some source text')
    expect(prompt).toContain('Chamonix')
    expect(prompt).toContain('France')
    expect(prompt).toContain('some source text')
  })
})
