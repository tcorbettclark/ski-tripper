import { describe, expect, it } from 'bun:test'

function round5(n: number) {
  return Math.round(n / 5) * 5
}

function normalisePistePercentages(b: number, i: number, a: number) {
  const total = b + i + a
  if (total === 0) return { beginnerPct: 0, intermediatePct: 0, advancedPct: 0 }

  let nb = round5((b / total) * 100)
  let ni = round5((i / total) * 100)
  let na = round5((a / total) * 100)

  const remainder = 100 - (nb + ni + na)
  if (remainder !== 0) {
    const biggest =
      nb >= ni && nb >= na ? 'beginner' : ni >= na ? 'intermediate' : 'advanced'
    if (biggest === 'beginner') nb += remainder
    else if (biggest === 'intermediate') ni += remainder
    else na += remainder
  }

  return { beginnerPct: nb, intermediatePct: ni, advancedPct: na }
}

describe('normalisePistePercentages', () => {
  it('returns zeros when all inputs are zero', () => {
    const result = normalisePistePercentages(0, 0, 0)
    expect(result).toEqual({
      beginnerPct: 0,
      intermediatePct: 0,
      advancedPct: 0,
    })
  })

  it('normalises exact percentages that already sum to 100', () => {
    const result = normalisePistePercentages(25, 50, 25)
    expect(result).toEqual({
      beginnerPct: 25,
      intermediatePct: 50,
      advancedPct: 25,
    })
  })

  it('normalises raw km values to rounded percentages', () => {
    const result = normalisePistePercentages(30, 60, 60)
    expect(
      result.beginnerPct + result.intermediatePct + result.advancedPct
    ).toBe(100)
  })

  it('handles rounding remainder by adding to largest category', () => {
    const result = normalisePistePercentages(33, 34, 33)
    expect(
      result.beginnerPct + result.intermediatePct + result.advancedPct
    ).toBe(100)
    expect(result.intermediatePct).toBeGreaterThanOrEqual(result.beginnerPct)
  })

  it('handles one category being 100%', () => {
    const result = normalisePistePercentages(100, 0, 0)
    expect(result).toEqual({
      beginnerPct: 100,
      intermediatePct: 0,
      advancedPct: 0,
    })
  })

  it('handles small values proportionally', () => {
    const result = normalisePistePercentages(10, 20, 70)
    expect(
      result.beginnerPct + result.intermediatePct + result.advancedPct
    ).toBe(100)
    expect(result.advancedPct).toBeGreaterThanOrEqual(result.intermediatePct)
  })

  it('handles percentage values that sum to 100 without change', () => {
    const result = normalisePistePercentages(15, 35, 50)
    expect(result).toEqual({
      beginnerPct: 15,
      intermediatePct: 35,
      advancedPct: 50,
    })
  })

  it('rounds non-5 values to nearest 5', () => {
    const result = normalisePistePercentages(7, 13, 80)
    expect(result.beginnerPct % 5).toBe(0)
    expect(result.intermediatePct % 5).toBe(0)
    expect(result.advancedPct % 5).toBe(0)
    expect(
      result.beginnerPct + result.intermediatePct + result.advancedPct
    ).toBe(100)
  })
})
