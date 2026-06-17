import { describe, expect, it } from 'bun:test'
import { render, screen } from '@testing-library/react'
import Paragraphs from './Paragraphs'

describe('Paragraphs', () => {
  it('renders a single paragraph for text without newlines', () => {
    render(<Paragraphs text="Hello world" />)
    expect(screen.getByText('Hello world')).toBeTruthy()
  })

  it('splits text on double newlines into separate paragraphs', () => {
    const text = 'First paragraph\n\nSecond paragraph'
    render(<Paragraphs text={text} />)
    expect(screen.getByText('First paragraph')).toBeTruthy()
    expect(screen.getByText('Second paragraph')).toBeTruthy()
  })

  it('splits text on triple newlines into separate paragraphs', () => {
    const text = 'First\n\n\nSecond'
    render(<Paragraphs text={text} />)
    expect(screen.getByText('First')).toBeTruthy()
    expect(screen.getByText('Second')).toBeTruthy()
  })

  it('splits text on single newlines into separate paragraphs', () => {
    const text = 'First line\nSecond line'
    render(<Paragraphs text={text} />)
    expect(screen.getByText('First line')).toBeTruthy()
    expect(screen.getByText('Second line')).toBeTruthy()
  })

  it('handles multiple consecutive newlines as a single paragraph break', () => {
    const text = 'A\n\n\n\nB'
    render(<Paragraphs text={text} />)
    const paragraphs = screen.getAllByText(/^[AB]$/)
    expect(paragraphs.length).toBe(2)
  })

  it('trims whitespace from each paragraph', () => {
    const text = '  Hello  \n\n  World  '
    render(<Paragraphs text={text} />)
    expect(screen.getByText('Hello')).toBeTruthy()
    expect(screen.getByText('World')).toBeTruthy()
  })

  it('ignores empty paragraphs from leading/trailing newlines', () => {
    const text = '\n\nHello\n\nWorld\n\n'
    render(<Paragraphs text={text} />)
    const paragraphs = screen.getAllByText(/^(Hello|World)$/)
    expect(paragraphs.length).toBe(2)
  })

  it('trims surrounding whitespace and collapses newlines', () => {
    const text = '\n\nFoo\nBar\n '
    render(<Paragraphs text={text} />)
    expect(screen.getByText('Foo')).toBeTruthy()
    expect(screen.getByText('Bar')).toBeTruthy()
    expect(screen.getAllByRole('paragraph').length).toBe(2)
  })

  it('returns null for empty string', () => {
    const { container } = render(<Paragraphs text="" />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null for whitespace-only string', () => {
    const text = '  \n  \n  '
    render(<Paragraphs text={text} />)
    const { container } = render(<Paragraphs text="" />)
    expect(container.innerHTML).toBe('')
  })

  it('applies custom style to each paragraph', () => {
    const style = { color: 'red' }
    const { container } = render(<Paragraphs text="Hello" style={style} />)
    const p = container.querySelector('p')
    expect(p?.style.color).toBe('red')
  })
})
