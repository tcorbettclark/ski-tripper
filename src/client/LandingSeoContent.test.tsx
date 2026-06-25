import { describe, expect, it } from 'bun:test'
import { render, screen } from '@testing-library/react'
import LandingSeoContent from './LandingSeoContent'

describe('LandingSeoContent', () => {
  it('renders the about content', () => {
    render(<LandingSeoContent />)
    expect(screen.getByText('What is this?')).toBeTruthy()
  })

  it('renders an h1 from about content', () => {
    render(<LandingSeoContent />)
    const h1 = document.querySelector('h1')
    expect(h1).toBeTruthy()
    expect(h1?.textContent).toBe('Ski Tripper')
  })

  it('has sr-only styling to hide from visual users', () => {
    render(<LandingSeoContent />)
    const section = screen.getByRole('region', { name: 'About Ski Tripper' })
    expect(section.style.position).toBe('absolute')
    expect(section.style.width).toBe('1px')
    expect(section.style.height).toBe('1px')
    expect(section.style.overflow).toBe('hidden')
  })

  it('renders links from about content', () => {
    render(<LandingSeoContent />)
    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
  })
})
