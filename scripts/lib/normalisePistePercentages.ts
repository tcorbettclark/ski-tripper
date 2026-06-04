function round5(n: number) {
  return Math.round(n / 5) * 5
}

export function normalisePistePercentages(
  b: number,
  i: number,
  a: number
): { beginnerPct: number; intermediatePct: number; advancedPct: number } {
  const total = b + i + a
  if (total === 0) return { beginnerPct: 0, intermediatePct: 0, advancedPct: 0 }

  const ub = (b / total) * 100
  const ui = (i / total) * 100
  const ua = (a / total) * 100

  const rb = round5(ub)
  const ri = round5(ui)
  const ra = round5(ua)

  if (rb + ri + ra === 100) {
    return { beginnerPct: rb, intermediatePct: ri, advancedPct: ra }
  }

  return {
    beginnerPct: Math.round(ub),
    intermediatePct: Math.round(ui),
    advancedPct: Math.round(ua),
  }
}
