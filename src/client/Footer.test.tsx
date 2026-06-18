import { describe, expect, it } from 'bun:test'
import { render, screen } from '@testing-library/react'
import Footer from './Footer'

describe('Footer', () => {
  it('renders footer content', () => {
    render(<Footer useAutoHideFooterHook={() => 'visible'} />)
    expect(screen.getByText(/Built by/)).toBeTruthy()
  })

  it('is fully opaque when visible', () => {
    render(<Footer useAutoHideFooterHook={() => 'visible'} />)
    const footer = screen.getByRole('contentinfo')
    expect(footer.style.opacity).toBe('1')
    expect(footer.style.pointerEvents).toBe('')
  })

  it('is hidden (transparent + no pointer events) when scrolling', () => {
    render(<Footer useAutoHideFooterHook={() => 'hidden'} />)
    const footer = screen.getByRole('contentinfo')
    expect(footer.style.opacity).toBe('0')
    expect(footer.style.pointerEvents).toBe('none')
  })
})
