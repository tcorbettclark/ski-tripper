import { describe, expect, it, vi } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InfoBanner from './InfoBanner'

const testSlides = [
  'First slide',
  'Second slide',
  'Third slide\nWith a newline',
  'Fourth slide',
]

describe('InfoBanner', () => {
  it('renders the first slide text', () => {
    render(<InfoBanner intervalMs={60000} slides={testSlides} />)
    expect(screen.getByText('First slide'))
  })

  it('renders a dot button for each slide', () => {
    render(<InfoBanner intervalMs={60000} slides={testSlides} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(testSlides.length)
  })

  it('renders newlines in slide text', () => {
    const newlineSlides = ['Hello\nWorld']
    render(<InfoBanner intervalMs={60000} slides={newlineSlides} />)
    const paragraph = screen.getByText((_content, element) => {
      return element?.tagName === 'P' && element.textContent === 'Hello\nWorld'
    })
    expect(paragraph.style.whiteSpace).toBe('pre-line')
  })

  it('advances to the next slide after the interval', () => {
    vi.useFakeTimers()
    render(<InfoBanner intervalMs={4000} slides={testSlides} />)

    expect(screen.getByText('First slide'))

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.getByText('Second slide'))

    vi.useRealTimers()
  })

  it('cycles back to the first slide after the last', () => {
    vi.useFakeTimers()
    render(<InfoBanner intervalMs={4000} slides={testSlides} />)

    for (let i = 0; i < testSlides.length; i++) {
      act(() => {
        vi.advanceTimersByTime(4000)
      })
    }

    expect(screen.getByText('First slide'))

    vi.useRealTimers()
  })

  it('switches to a specific slide when a dot is clicked', async () => {
    const user = userEvent.setup()
    render(<InfoBanner intervalMs={60000} slides={testSlides} />)

    expect(screen.getByText('First slide'))

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[2])

    expect(screen.getByText(/With a newline/i))
  })

  it('pauses auto-advance on mouse enter and resumes on mouse leave', () => {
    vi.useFakeTimers()
    const { container } = render(
      <InfoBanner intervalMs={4000} slides={testSlides} />
    )
    const section = container.querySelector('section')!

    expect(screen.getByText('First slide'))

    fireEvent.mouseEnter(section)

    act(() => {
      vi.advanceTimersByTime(8000)
    })

    expect(screen.getByText('First slide'))

    fireEvent.mouseLeave(section)

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.getByText('Second slide'))

    vi.useRealTimers()
  })

  it('shows a pause icon when hovered and hides it on mouse leave', () => {
    const { container } = render(
      <InfoBanner intervalMs={60000} slides={testSlides} />
    )
    const section = container.querySelector('section')!

    expect(container.textContent).not.toContain('\u25AE\u25AE')

    fireEvent.mouseEnter(section)
    expect(container.textContent).toContain('\u25AE\u25AE')

    fireEvent.mouseLeave(section)
    expect(container.textContent).not.toContain('\u25AE\u25AE')
  })
})
