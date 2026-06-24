import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AboutModal from './AboutModal'

const mockReadmeContent = `# Ski Tripper

## What is it?

Ski Tripper is a collaborative ski trip planning application.

## Development

Use the bun test runner.`

const testUrl = 'https://example.com/readme.md'

describe('AboutModal', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function mockFetchResponse(body: string, status = 200) {
    globalThis.fetch = mock(
      async () => new Response(body, { status })
    ) as unknown as typeof globalThis.fetch
  }

  it('renders nothing when closed', () => {
    const { container } = render(<AboutModal open={false} onClose={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders close button and markdown content when open', async () => {
    mockFetchResponse(mockReadmeContent)
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} readmeUrl={testUrl} />)
    })
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(screen.getByText('What is it?')).toBeTruthy()
  })

  it('fetches and displays README as markdown', async () => {
    mockFetchResponse(mockReadmeContent)
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} readmeUrl={testUrl} />)
    })
    expect(screen.getByText('What is it?')).toBeTruthy()
    expect(screen.getByText(/Ski Tripper is a collaborative/)).toBeTruthy()
  })

  it('shows error when fetch fails', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('Network error')
    }) as unknown as typeof globalThis.fetch
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} readmeUrl={testUrl} />)
    })
    expect(screen.getByText('Network error')).toBeTruthy()
  })

  it('shows error for non-200 response', async () => {
    mockFetchResponse('Not Found', 404)
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} readmeUrl={testUrl} />)
    })
    expect(screen.getByText(/Failed to load README/)).toBeTruthy()
  })

  it('shows loading state while fetching', async () => {
    globalThis.fetch = mock(
      () => new Promise(() => {})
    ) as unknown as typeof globalThis.fetch
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} readmeUrl={testUrl} />)
    })
    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  it('calls onClose when close button clicked', async () => {
    mockFetchResponse(mockReadmeContent)
    let closed = false
    const handleClose = () => {
      closed = true
    }
    const user = userEvent.setup()
    await act(async () => {
      render(
        <AboutModal open={true} onClose={handleClose} readmeUrl={testUrl} />
      )
    })
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(closed).toBe(true)
  })

  it('calls onClose when overlay clicked', async () => {
    mockFetchResponse(mockReadmeContent)
    let closed = false
    const handleClose = () => {
      closed = true
    }
    const user = userEvent.setup()
    await act(async () => {
      render(
        <AboutModal open={true} onClose={handleClose} readmeUrl={testUrl} />
      )
    })
    const overlay = screen.getByRole('dialog')
    await user.click(overlay)
    expect(closed).toBe(true)
  })

  it('uses custom readmeUrl prop', async () => {
    mockFetchResponse(mockReadmeContent)
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} readmeUrl={testUrl} />)
    })
    expect(globalThis.fetch).toHaveBeenCalledWith(testUrl)
  })

  it('trims content before the first h1 heading but includes the heading', async () => {
    const badgeAndTitle = `[![CI](badge.svg)](url)\n\n# Ski Tripper\n\n## Overview\n\nSome content.`
    mockFetchResponse(badgeAndTitle)
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} readmeUrl={testUrl} />)
    })
    expect(screen.getByText('Ski Tripper')).toBeTruthy()
    expect(screen.getByText('Overview')).toBeTruthy()
    expect(screen.getByText('Some content.')).toBeTruthy()
  })

  it('renders GFM tables', async () => {
    const tableMarkdown = `| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |`
    mockFetchResponse(tableMarkdown)
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} readmeUrl={testUrl} />)
    })
    expect(screen.getByText('Header 1')).toBeTruthy()
    expect(screen.getByText('Cell 1')).toBeTruthy()
  })

  it('renders title in header', async () => {
    mockFetchResponse(mockReadmeContent)
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} readmeUrl={testUrl} />)
    })
    expect(screen.getByText('About')).toBeTruthy()
  })
})
