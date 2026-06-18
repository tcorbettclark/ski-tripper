import { describe, expect, it } from 'bun:test'
import {
  buildConsistencyJsonSchema,
  CONSISTENCY_FIELDS,
  CONSISTENCY_SYSTEM_PROMPT,
  CONSISTENCY_USER_PROMPT,
  consistencySchema,
  filterValidInconsistencies,
} from './consistency'

describe('CONSISTENCY_FIELDS', () => {
  it('includes all expected fields', () => {
    expect(CONSISTENCY_FIELDS).toEqual([
      'summitAltitude',
      'baseAltitude',
      'pisteKm',
      'liftCount',
      'beginnerPct',
      'intermediatePct',
      'advancedPct',
    ])
  })
})

describe('consistencySchema', () => {
  it('parses a valid response with inconsistencies', () => {
    const input = {
      inconsistencies: [
        {
          field: 'summitAltitude',
          currentValue: 3200,
          correctedValue: 3842,
          reason: 'Description says "summit at 3,842m"',
        },
        {
          field: 'pisteKm',
          currentValue: 120,
          correctedValue: 153,
          reason: 'Description mentions "153 km of pistes"',
        },
      ],
    }
    const result = consistencySchema.parse(input)
    expect(result.inconsistencies).toHaveLength(2)
    expect(result.inconsistencies[0].field).toBe('summitAltitude')
    expect(result.inconsistencies[0].correctedValue).toBe(3842)
    expect(result.inconsistencies[1].field).toBe('pisteKm')
  })

  it('parses a response with no inconsistencies', () => {
    const input = { inconsistencies: [] }
    const result = consistencySchema.parse(input)
    expect(result.inconsistencies).toHaveLength(0)
  })

  it('parses null currentValue', () => {
    const input = {
      inconsistencies: [
        {
          field: 'baseAltitude',
          currentValue: null,
          correctedValue: 1035,
          reason: 'Description says "base at 1,035m"',
        },
      ],
    }
    const result = consistencySchema.parse(input)
    expect(result.inconsistencies[0].currentValue).toBeNull()
    expect(result.inconsistencies[0].correctedValue).toBe(1035)
  })

  it('parses incomplete inconsistency entries with missing optional fields', () => {
    const input = {
      inconsistencies: [{ field: 'summitAltitude' }],
    }
    const result = consistencySchema.parse(input)
    expect(result.inconsistencies).toHaveLength(1)
    expect(result.inconsistencies[0].field).toBe('summitAltitude')
    expect(result.inconsistencies[0].correctedValue).toBeUndefined()
    expect(result.inconsistencies[0].reason).toBeUndefined()
  })

  it('rejects invalid field names', () => {
    const input = {
      inconsistencies: [
        {
          field: 'invalidField',
          currentValue: 100,
          correctedValue: 200,
          reason: 'test',
        },
      ],
    }
    expect(() => consistencySchema.parse(input)).toThrow()
  })
})

describe('filterValidInconsistencies', () => {
  it('filters out entries without correctedValue', () => {
    const result = consistencySchema.parse({
      inconsistencies: [
        { field: 'summitAltitude', reason: 'test' },
        { field: 'pisteKm', correctedValue: 200, reason: 'desc says 200km' },
      ],
    })
    const valid = filterValidInconsistencies(result)
    expect(valid).toHaveLength(1)
    expect(valid[0].field).toBe('pisteKm')
    expect(valid[0].correctedValue).toBe(200)
  })

  it('filters out entries without reason', () => {
    const result = consistencySchema.parse({
      inconsistencies: [
        { field: 'summitAltitude', correctedValue: 3842 },
        { field: 'pisteKm', correctedValue: 200, reason: 'desc says 200km' },
      ],
    })
    const valid = filterValidInconsistencies(result)
    expect(valid).toHaveLength(1)
    expect(valid[0].field).toBe('pisteKm')
  })

  it('returns all entries when all are complete', () => {
    const result = consistencySchema.parse({
      inconsistencies: [
        {
          field: 'summitAltitude',
          currentValue: 3200,
          correctedValue: 3842,
          reason: 'Description says summit at 3842m',
        },
        {
          field: 'pisteKm',
          currentValue: 120,
          correctedValue: 153,
          reason: 'Description mentions 153km',
        },
      ],
    })
    const valid = filterValidInconsistencies(result)
    expect(valid).toHaveLength(2)
  })

  it('returns empty array for empty inconsistencies', () => {
    const result = consistencySchema.parse({ inconsistencies: [] })
    const valid = filterValidInconsistencies(result)
    expect(valid).toHaveLength(0)
  })

  it('uses null for missing currentValue', () => {
    const result = consistencySchema.parse({
      inconsistencies: [
        {
          field: 'baseAltitude',
          correctedValue: 1035,
          reason: 'Description says 1035m',
        },
      ],
    })
    const valid = filterValidInconsistencies(result)
    expect(valid).toHaveLength(1)
    expect(valid[0].currentValue).toBeNull()
  })
})

describe('CONSISTENCY_SYSTEM_PROMPT', () => {
  it('contains key instructions', () => {
    expect(CONSISTENCY_SYSTEM_PROMPT).toContain('summitAltitude')
    expect(CONSISTENCY_SYSTEM_PROMPT).toContain('baseAltitude')
    expect(CONSISTENCY_SYSTEM_PROMPT).toContain('pisteKm')
    expect(CONSISTENCY_SYSTEM_PROMPT).toContain('liftCount')
    expect(CONSISTENCY_SYSTEM_PROMPT).toContain('beginnerPct')
    expect(CONSISTENCY_SYSTEM_PROMPT).toContain('intermediatePct')
    expect(CONSISTENCY_SYSTEM_PROMPT).toContain('advancedPct')
    expect(CONSISTENCY_SYSTEM_PROMPT).toContain('JSON')
    expect(CONSISTENCY_SYSTEM_PROMPT).toContain('correctedValue')
    expect(CONSISTENCY_SYSTEM_PROMPT).toContain('reason')
  })
})

describe('buildConsistencyJsonSchema', () => {
  it('includes inconsistencies array with required fields', () => {
    const schema = buildConsistencyJsonSchema()
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('inconsistencies')
    expect(schema.required).toContain('inconsistencies')
    const items = (schema.properties as Record<string, unknown>)
      .inconsistencies as {
      items: { properties: Record<string, unknown>; required: string[] }
    }
    expect(items.items.properties).toHaveProperty('field')
    expect(items.items.properties).toHaveProperty('correctedValue')
    expect(items.items.properties).toHaveProperty('reason')
    expect(items.items.required).toContain('field')
    expect(items.items.required).toContain('correctedValue')
    expect(items.items.required).toContain('reason')
  })
})

describe('CONSISTENCY_USER_PROMPT', () => {
  const schemaJson = JSON.stringify(buildConsistencyJsonSchema(), null, 2)

  it('includes resort name, country, description, fields, and schema', () => {
    const prompt = CONSISTENCY_USER_PROMPT(
      'Chamonix',
      'France',
      'Wide cruising runs above the treeline.',
      { summitAltitude: 3200, baseAltitude: 1035, pisteKm: 153 },
      schemaJson
    )
    expect(prompt).toContain('Chamonix')
    expect(prompt).toContain('France')
    expect(prompt).toContain('Wide cruising runs above the treeline')
    expect(prompt).toContain('summitAltitude: 3200')
    expect(prompt).toContain('baseAltitude: 1035')
    expect(prompt).toContain('pisteKm: 153')
    expect(prompt).toContain('inconsistencies')
  })

  it('shows N/A for null values', () => {
    const prompt = CONSISTENCY_USER_PROMPT(
      'Test',
      'Country',
      'desc',
      {
        summitAltitude: null,
      },
      schemaJson
    )
    expect(prompt).toContain('summitAltitude: N/A')
  })
})
