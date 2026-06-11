import { beforeEach, describe, expect, it } from 'bun:test'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeToggle from './ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'dark'
  })

  it('toggles from dark to light on click', async () => {
    render(<ThemeToggle />)
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-label')).toBe('Switch to light mode')
    await userEvent.click(button)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('toggles from light to dark on click', async () => {
    document.documentElement.dataset.theme = 'light'
    render(<ThemeToggle />)
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-label')).toBe('Switch to dark mode')
    await userEvent.click(button)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('creates color-scheme meta tag when it does not exist', async () => {
    document.querySelector('meta[name=color-scheme]')?.remove()
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button'))
    const meta = document.querySelector(
      'meta[name=color-scheme]'
    ) as HTMLMetaElement
    expect(meta).not.toBeNull()
    expect(meta.content).toBe('light')
  })

  it('updates existing color-scheme meta tag', async () => {
    let meta = document.querySelector(
      'meta[name=color-scheme]'
    ) as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'color-scheme'
      meta.content = 'dark'
      document.head.appendChild(meta)
    }
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button'))
    expect(meta.content).toBe('light')
  })

  it('persists theme to localStorage', async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button'))
    expect(localStorage.getItem('theme')).toBe('light')
  })
})
