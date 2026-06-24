import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import type { AxeResults } from 'axe-core'

export async function runAxeCheck(
  page: Page,
  selector?: string
): Promise<AxeResults> {
  let builder = new AxeBuilder({ page })
  if (selector) {
    builder = builder.include(selector)
  }
  return builder.analyze()
}

export async function assertNoContrastViolations(
  page: Page,
  selector?: string
): Promise<AxeResults> {
  const results = await runAxeCheck(page, selector)
  const contrastViolations = results.violations.filter(
    (v) => v.id === 'color-contrast'
  )
  if (contrastViolations.length > 0) {
    const details = contrastViolations
      .flatMap((v) => v.nodes.map((n) => `  ${n.html}\n  ${n.failureSummary}`))
      .join('\n')
    throw new Error(`Contrast violations found:\n${details}`)
  }
  return results
}

export async function assertNoAccessibilityViolations(
  page: Page,
  selector?: string,
  excludeRules?: string[]
): Promise<AxeResults> {
  let builder = new AxeBuilder({ page })
  if (selector) {
    builder = builder.include(selector)
  }
  if (excludeRules && excludeRules.length > 0) {
    builder = builder.disableRules(excludeRules)
  }
  const results = await builder.analyze()
  if (results.violations.length > 0) {
    const details = results.violations
      .flatMap((v) =>
        v.nodes.map(
          (n) =>
            `  [${v.id}] ${v.description}\n  ${n.html}\n  ${n.failureSummary}`
        )
      )
      .join('\n')
    throw new Error(`Accessibility violations found:\n${details}`)
  }
  return results
}
