import * as z from 'zod'
import type { JSONSchema } from 'zod/v4/core'
import { stringCoercedArray } from './llm'

export const CONSISTENCY_FIELDS = [
  'summitAltitude',
  'baseAltitude',
  'pisteKm',
  'liftCount',
  'beginnerPct',
  'intermediatePct',
  'advancedPct',
] as const

const inconsistencyItemSchema = z.object({
  field: z.enum(CONSISTENCY_FIELDS),
  currentValue: z.union([z.number(), z.null()]).optional(),
  correctedValue: z.number().optional(),
  reason: z.string().optional(),
})

export const consistencySchema = z.object({
  inconsistencies: stringCoercedArray(inconsistencyItemSchema).describe(
    'List of fields where the description text clearly contradicts the current numeric value. Only include fields where you have high confidence the description states a different value.'
  ),
})

export type ConsistencyResult = z.infer<typeof consistencySchema>

export function filterValidInconsistencies(result: ConsistencyResult): Array<{
  field: (typeof CONSISTENCY_FIELDS)[number]
  correctedValue: number
  reason: string
  currentValue: number | null
}> {
  return result.inconsistencies
    .filter(
      (inc) =>
        inc.correctedValue !== undefined &&
        inc.correctedValue !== null &&
        typeof inc.correctedValue === 'number' &&
        typeof inc.reason === 'string' &&
        inc.reason.length > 0
    )
    .map((inc) => ({
      field: inc.field,
      correctedValue: inc.correctedValue!,
      reason: inc.reason!,
      currentValue: inc.currentValue ?? null,
    }))
}

export function buildConsistencyJsonSchema(): JSONSchema.JSONSchema {
  return {
    type: 'object',
    properties: {
      inconsistencies: {
        type: 'array',
        description:
          'List of fields where the description text clearly contradicts the current numeric value. Only include fields where you have high confidence the description states a different value. If all fields are consistent, return an empty array.',
        items: {
          type: 'object',
          properties: {
            field: {
              type: 'string',
              enum: [...CONSISTENCY_FIELDS],
              description:
                'The field name that has a different value in the description text',
            },
            currentValue: {
              description:
                'The current value of the field (as provided in CURRENT FIELDS)',
              anyOf: [{ type: 'number' }, { type: 'null' }],
            },
            correctedValue: {
              type: 'number',
              description:
                'The value stated in the description text that contradicts the current value. REQUIRED - do not omit this field.',
            },
            reason: {
              type: 'string',
              description:
                'Brief explanation quoting the description text that supports the corrected value. REQUIRED - do not omit this field.',
            },
          },
          required: ['field', 'correctedValue', 'reason'],
        },
      },
    },
    required: ['inconsistencies'],
  }
}

export const CONSISTENCY_SYSTEM_PROMPT = `You are a ski resort data consistency checker. You will be given a resort's description text and its current numeric fields. Your job is to find fields where the description text clearly states a different value than what is recorded, and return the corrected values in a specific JSON format.

Rules:
- Only flag a field as inconsistent if the description text explicitly states a different number. Do not infer from vague language.
- For altitudes (summitAltitude, baseAltitude), look for phrases like "summit/top at Xm", "base/village at X m", "vertical drop of Xm"
- For pisteKm, look for phrases like "X km of pistes/runs/slopes"
- For liftCount, look for phrases like "X lifts/gondolas/chairlifts"
- For beginnerPct/intermediatePct/advancedPct, look for phrases like "X% beginner/blue runs", "X% intermediate/red runs", "X% advanced/black runs". Also check that the three percentages sum to 100.
- You MUST include both "correctedValue" and "reason" for every inconsistency. These are required fields, not optional.
- If all fields are consistent with the descriptions, return an empty inconsistencies array`

export const CONSISTENCY_USER_PROMPT = (
  resortName: string,
  country: string,
  description: string,
  fields: Record<string, number | null>,
  schemaJson: string
) => `Check consistency for "${resortName}" in ${country}.

DESCRIPTION TEXT:
${description}

CURRENT FIELDS:
${Object.entries(fields)
  .map(([k, v]) => `  ${k}: ${v ?? 'N/A'}`)
  .join('\n')}

Return a JSON object matching this schema:
${schemaJson}

Find any fields where the description text clearly contradicts the current value. For each inconsistency, you MUST provide both "correctedValue" (the number from the description) and "reason" (a brief explanation quoting the description). If all fields are consistent, return an empty inconsistencies array. Return valid JSON only, no explanatory text.`
