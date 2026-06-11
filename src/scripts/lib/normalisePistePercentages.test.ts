import { describe, expect, it } from 'bun:test'
import { normalisePistePercentages } from './normalisePistePercentages'

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

  it('handles rounding that sums to 100 by rounding to nearest 5', () => {
    const result = normalisePistePercentages(33, 34, 33)
    expect(
      result.beginnerPct + result.intermediatePct + result.advancedPct
    ).toBe(100)
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

  it('rounds non-5 values to nearest 5 when they sum to 100', () => {
    const result = normalisePistePercentages(7, 13, 80)
    expect(result.beginnerPct % 5).toBe(0)
    expect(result.intermediatePct % 5).toBe(0)
    expect(result.advancedPct % 5).toBe(0)
    expect(
      result.beginnerPct + result.intermediatePct + result.advancedPct
    ).toBe(100)
  })

  it('falls back to unrounded values when rounding to 5 does not sum to 100', () => {
    const result = normalisePistePercentages(12, 33, 55)
    const total =
      result.beginnerPct + result.intermediatePct + result.advancedPct
    expect(total).toBe(100)
  })

  it('always produces values that sum to exactly 100', () => {
    const cases = [
      [1, 2, 97],
      [13, 37, 50],
      [33, 34, 33],
      [6, 19, 75],
      [10, 30, 60],
      [5, 45, 50],
    ] as const
    for (const [b, i, a] of cases) {
      const result = normalisePistePercentages(b, i, a)
      expect(
        result.beginnerPct + result.intermediatePct + result.advancedPct,
        `For input ${b}/${i}/${a}`
      ).toBe(100)
    }
  })
})
