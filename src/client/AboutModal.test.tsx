import { describe, expect, it } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AboutModal from './AboutModal'

describe('AboutModal', () => {
  it('hides the dialog when closed', () => {
    const { container } = render(<AboutModal open={false} onClose={() => {}} />)
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).toBeTruthy()
    expect(dialog.style.display).toBe('none')
  })

  it('shows the dialog when open', async () => {
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} />)
    })
    const dialog = screen.getByRole('dialog')
    expect(dialog.style.display).toBe('flex')
  })

  it('renders about content as markdown', async () => {
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} />)
    })
    expect(screen.getByRole('dialog').textContent!.length).toBeGreaterThan(10)
  })

  it('renders close button', async () => {
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} />)
    })
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('calls onClose when close button clicked', async () => {
    let closed = false
    const handleClose = () => {
      closed = true
    }
    const user = userEvent.setup()
    await act(async () => {
      render(<AboutModal open={true} onClose={handleClose} />)
    })
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(closed).toBe(true)
  })

  it('calls onClose when overlay clicked', async () => {
    let closed = false
    const handleClose = () => {
      closed = true
    }
    const user = userEvent.setup()
    await act(async () => {
      render(<AboutModal open={true} onClose={handleClose} />)
    })
    const overlay = screen.getByRole('dialog')
    await user.click(overlay)
    expect(closed).toBe(true)
  })

  it('renders title in header', async () => {
    await act(async () => {
      render(<AboutModal open={true} onClose={() => {}} />)
    })
    expect(screen.getByText('About')).toBeTruthy()
  })
})
