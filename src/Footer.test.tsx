import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { render, screen } from '@testing-library/react'

let footerVisibility: 'visible' | 'hidden' = 'visible'

mock.module('./useAutoHideFooter', () => ({
  default: () => footerVisibility,
}))

const { default: Footer } = await import('./Footer')

describe('Footer', () => {
  beforeEach(() => {
    footerVisibility = 'visible'
  })

  it('renders footer content', () => {
    render(<Footer />)
    expect(screen.getByText(/Built by/)).toBeTruthy()
  })

  it('is fully opaque when visible', () => {
    footerVisibility = 'visible'
    render(<Footer />)
    const footer = screen.getByRole('contentinfo')
    expect(footer.style.opacity).toBe('1')
    expect(footer.style.pointerEvents).toBe('')
  })

  it('is hidden (transparent + no pointer events) when scrolling', () => {
    footerVisibility = 'hidden'
    render(<Footer />)
    const footer = screen.getByRole('contentinfo')
    expect(footer.style.opacity).toBe('0')
    expect(footer.style.pointerEvents).toBe('none')
  })

  it('is fully opaque when not scrolling', () => {
    footerVisibility = 'visible'
    render(<Footer />)
    const footer = screen.getByRole('contentinfo')
    expect(footer.style.opacity).toBe('1')
  })

  it('background is opaque bgPrimary (never transparent)', () => {
    render(<Footer />)
    const footer = screen.getByRole('contentinfo')
    expect(footer.style.background).toContain('bgPrimary')
  })

  it('renders version and links', () => {
    render(<Footer />)
    expect(screen.getByText(/Pre-release software/)).toBeTruthy()
    expect(screen.getAllByLabelText('GitHub').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Report a Bug')).toBeTruthy()
  })
})
