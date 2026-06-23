import { describe, expect, it } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThinkingContent from './ThinkingContent'

function mockScrollable(
  element: HTMLElement,
  scrollHeight: number,
  clientHeight: number
) {
  Object.defineProperties(element, {
    scrollHeight: { value: scrollHeight, configurable: true },
    clientHeight: { value: clientHeight, configurable: true },
    scrollTop: { value: 0, writable: true, configurable: true },
  })
}

describe('ThinkingContent', () => {
  it('renders nothing when not generating and no thinking', () => {
    const { container } = render(
      <ThinkingContent thinking="" isGenerating={false} hasContent={false} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows Thinking… label and Starting… placeholder when generating with no thinking content', () => {
    render(
      <ThinkingContent thinking="" isGenerating={true} hasContent={false} />
    )
    expect(screen.getByText('Thinking…')).toBeTruthy()
    expect(screen.getByText('Starting…')).toBeTruthy()
  })

  it('shows thinking in fixed-height box when generating with no content yet', () => {
    render(
      <ThinkingContent
        thinking="I should consider..."
        isGenerating={true}
        hasContent={false}
      />
    )
    expect(screen.getByText('I should consider...')).toBeTruthy()
    expect(screen.getByText('Thinking…')).toBeTruthy()
    expect(screen.queryByText('Thinking')).toBeNull()
  })

  it('shows collapsed thinking toggle when content arrives', () => {
    render(
      <ThinkingContent
        thinking="Some reasoning"
        isGenerating={false}
        hasContent={true}
      />
    )
    expect(screen.getByText('Thinking')).toBeTruthy()
    expect(screen.queryByText('Some reasoning')).toBeNull()
  })

  it('expands thinking on toggle click', async () => {
    const user = userEvent.setup()
    render(
      <ThinkingContent
        thinking="Internal reasoning"
        isGenerating={false}
        hasContent={true}
      />
    )

    await user.click(screen.getByText('Thinking'))
    expect(screen.getByText('Internal reasoning')).toBeTruthy()
  })

  it('collapses thinking on second toggle click', async () => {
    const user = userEvent.setup()
    render(
      <ThinkingContent
        thinking="Internal reasoning"
        isGenerating={false}
        hasContent={true}
      />
    )

    await user.click(screen.getByText('Thinking'))
    expect(screen.getByText('Internal reasoning')).toBeTruthy()

    await user.click(screen.getByText('Thinking'))
    expect(screen.queryByText('Internal reasoning')).toBeNull()
  })

  it('auto-scrolls to bottom when generating', () => {
    const { rerender } = render(
      <ThinkingContent thinking="" isGenerating={true} hasContent={false} />
    )

    const scrollContainer = screen
      .getByText('Starting…')
      .closest('.thinking-content')!
    mockScrollable(scrollContainer as HTMLElement, 500, 200)

    rerender(
      <ThinkingContent
        thinking="Some thinking content"
        isGenerating={true}
        hasContent={false}
      />
    )

    expect((scrollContainer as HTMLElement).scrollTop).toBe(500)
  })

  it('stops auto-scrolling when user scrolls up', () => {
    const { rerender } = render(
      <ThinkingContent
        thinking="Some thinking"
        isGenerating={true}
        hasContent={false}
      />
    )
    const scrollContainer = screen
      .getByText('Some thinking')
      .closest('.thinking-content')!
    mockScrollable(scrollContainer as HTMLElement, 500, 200)
    Object.defineProperty(scrollContainer, 'scrollTop', {
      value: 100,
      writable: true,
      configurable: true,
    })

    act(() => {
      scrollContainer.dispatchEvent(new Event('scroll'))
    })

    const previousScrollTop = (scrollContainer as HTMLElement).scrollTop

    rerender(
      <ThinkingContent
        thinking="Some thinking with more content"
        isGenerating={true}
        hasContent={false}
      />
    )

    expect((scrollContainer as HTMLElement).scrollTop).toBe(previousScrollTop)
  })

  it('resumes auto-scrolling when user scrolls back near bottom', () => {
    const { rerender } = render(
      <ThinkingContent
        thinking="Some thinking"
        isGenerating={true}
        hasContent={false}
      />
    )
    const scrollContainer = screen
      .getByText('Some thinking')
      .closest('.thinking-content')!
    mockScrollable(scrollContainer as HTMLElement, 500, 200)

    Object.defineProperty(scrollContainer, 'scrollTop', {
      value: 100,
      writable: true,
      configurable: true,
    })
    act(() => {
      scrollContainer.dispatchEvent(new Event('scroll'))
    })

    Object.defineProperty(scrollContainer, 'scrollTop', {
      value: 450,
      writable: true,
      configurable: true,
    })
    act(() => {
      scrollContainer.dispatchEvent(new Event('scroll'))
    })

    rerender(
      <ThinkingContent
        thinking="Some thinking with more content"
        isGenerating={true}
        hasContent={false}
      />
    )

    expect((scrollContainer as HTMLElement).scrollTop).toBe(500)
  })
})
