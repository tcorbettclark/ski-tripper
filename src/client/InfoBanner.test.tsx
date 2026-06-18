import { describe, expect, it, vi } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Compass, Snowflake } from 'lucide-react'
import InfoBanner, { FADE_DURATION_MS } from './InfoBanner'

const testSlides = [
  { icon: Snowflake, text: 'First slide' },
  { icon: Compass, text: 'Second slide' },
  { icon: Snowflake, text: 'Third slide\nWith a newline' },
  { icon: Compass, text: 'Fourth slide' },
]

describe('InfoBanner', () => {
  it('renders the first slide text', () => {
    render(<InfoBanner intervalMs={60000} slides={testSlides} />)
    expect(screen.getByText('First slide'))
  })

  it('renders a dot button for each slide', () => {
    const { container } = render(
      <InfoBanner intervalMs={60000} slides={testSlides} />
    )
    const dots = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Go to slide"]'
    )
    expect(dots.length).toBe(testSlides.length)
  })

  it('renders newlines in slide text as separate paragraphs', () => {
    const text = 'Hello\nWorld'
    const newlineSlides = [{ icon: Snowflake, text }]
    render(<InfoBanner intervalMs={60000} slides={newlineSlides} />)
    expect(screen.getByText('Hello')).toBeTruthy()
    expect(screen.getByText('World')).toBeTruthy()
  })

  it('advances to the next slide after the interval and fade', () => {
    vi.useFakeTimers()
    render(<InfoBanner intervalMs={4000} slides={testSlides} />)

    expect(screen.getByText('First slide'))

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    act(() => {
      vi.advanceTimersByTime(FADE_DURATION_MS)
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
      act(() => {
        vi.advanceTimersByTime(FADE_DURATION_MS)
      })
    }

    expect(screen.getByText('First slide'))

    vi.useRealTimers()
  })

  it('fades out before advancing and fades in after', () => {
    vi.useFakeTimers()
    render(<InfoBanner intervalMs={4000} slides={testSlides} />)

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    const p = screen.getByText('First slide')
    const wrapper = p.parentElement!.parentElement! as HTMLElement
    expect(wrapper.style.opacity).toBe('0')

    act(() => {
      vi.advanceTimersByTime(FADE_DURATION_MS)
    })

    expect(wrapper.style.opacity).toBe('1')
    expect(screen.getByText('Second slide'))

    vi.useRealTimers()
  })

  it('pauses auto-advance on mouse enter and resumes on mouse leave', () => {
    vi.useFakeTimers()
    const { container } = render(
      <InfoBanner intervalMs={4000} slides={testSlides} />
    )
    const section = container.querySelector('section')!

    expect(screen.getByText('First slide'))

    act(() => {
      fireEvent.mouseEnter(section)
    })

    act(() => {
      vi.advanceTimersByTime(8000)
    })

    expect(screen.getByText('First slide'))

    fireEvent.mouseLeave(section)

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    act(() => {
      vi.advanceTimersByTime(FADE_DURATION_MS)
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

    act(() => {
      fireEvent.mouseEnter(section)
    })
    expect(container.textContent).toContain('\u25AE\u25AE')

    act(() => {
      fireEvent.mouseLeave(section)
    })
    expect(container.textContent).not.toContain('\u25AE\u25AE')
  })

  it('switches slide instantly when clicking a dot (touch)', () => {
    const { container } = render(
      <InfoBanner
        intervalMs={60000}
        slides={testSlides}
        useIsSmallScreenHook={() => true}
      />
    )
    expect(screen.getByText('First slide'))

    const dots = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Go to slide"]'
    )
    act(() => {
      fireEvent.click(dots[2])
    })

    expect(screen.getByText('Third slide')).toBeTruthy()
  })

  it('switches slide instantly on dot hover (desktop)', () => {
    const { container } = render(
      <InfoBanner
        intervalMs={60000}
        slides={testSlides}
        useIsSmallScreenHook={() => false}
      />
    )
    expect(screen.getByText('First slide'))

    const dots = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Go to slide"]'
    )
    act(() => {
      fireEvent.mouseEnter(dots[1])
    })

    expect(screen.getByText('Second slide'))
  })

  it('skips CSS transition when switching via dot', () => {
    const { container } = render(
      <InfoBanner
        intervalMs={60000}
        slides={testSlides}
        useIsSmallScreenHook={() => false}
      />
    )
    const dots = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Go to slide"]'
    )

    act(() => {
      fireEvent.mouseEnter(dots[1])
    })

    const p = screen.getByText('Second slide')
    const wrapper = p.parentElement!.parentElement! as HTMLElement
    expect(wrapper.style.transition).toBe('none')
  })

  it('cancels pending fade when switching via dot mid-transition', () => {
    vi.useFakeTimers()
    const { container } = render(
      <InfoBanner intervalMs={4000} slides={testSlides} />
    )

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    const dots = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Go to slide"]'
    )
    act(() => {
      fireEvent.click(dots[2])
    })

    expect(screen.getByText('Third slide')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(FADE_DURATION_MS)
    })

    expect(screen.getByText('Third slide')).toBeTruthy()

    vi.useRealTimers()
  })

  it('does not switch on hover when isSmallScreen is true', () => {
    const { container } = render(
      <InfoBanner
        intervalMs={60000}
        slides={testSlides}
        useIsSmallScreenHook={() => true}
      />
    )
    expect(screen.getByText('First slide'))

    const dots = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Go to slide"]'
    )
    act(() => {
      fireEvent.mouseEnter(dots[1])
    })

    expect(screen.getByText('First slide'))
  })
})
