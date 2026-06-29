import { beforeEach, describe, expect, it } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import ToastContainer from './ToastContainer'
import { _resetForTesting, toast } from './toast'

beforeEach(() => {
  _resetForTesting()
})

describe('ToastContainer', () => {
  it('renders nothing when there are no toasts', () => {
    const { container } = render(<ToastContainer />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a toast message', () => {
    render(<ToastContainer />)
    act(() => {
      toast('Hello world', 'info')
    })
    expect(screen.getByText('Hello world')).toBeTruthy()
  })

  it('renders multiple toasts', () => {
    render(<ToastContainer />)
    act(() => {
      toast('first', 'success')
      toast('second', 'error')
    })
    expect(screen.getByText('first')).toBeTruthy()
    expect(screen.getByText('second')).toBeTruthy()
  })

  it('renders a dismiss button for each toast', () => {
    render(<ToastContainer />)
    act(() => {
      toast('dismiss me', 'info')
    })
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy()
  })

  it('dismisses a toast when the dismiss button is clicked', () => {
    render(<ToastContainer />)
    act(() => {
      toast('dismiss me', 'info')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('dismiss me')).toBeNull()
  })

  it('sets role=alert on toasts', () => {
    render(<ToastContainer />)
    act(() => {
      toast('alert!', 'error')
    })
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
