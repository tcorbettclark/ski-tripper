import { describe, expect, it } from 'bun:test'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThinkingContent from './ThinkingContent'

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
})
