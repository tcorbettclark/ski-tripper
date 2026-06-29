import { beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  _resetForTesting,
  dismissToast,
  getToasts,
  subscribe,
  toast,
} from './toast'

beforeEach(() => {
  _resetForTesting()
})

describe('toast', () => {
  it('adds a toast and returns it via getToasts', () => {
    toast('hello', 'info')
    const t = getToasts()
    expect(t.length).toBe(1)
    expect(t[0].message).toBe('hello')
    expect(t[0].type).toBe('info')
  })

  it('defaults type to info', () => {
    toast('hello')
    expect(getToasts()[0].type).toBe('info')
  })

  it('adds multiple toasts in order', () => {
    toast('first', 'success')
    toast('second', 'error')
    const t = getToasts()
    expect(t.length).toBe(2)
    expect(t[0].message).toBe('first')
    expect(t[1].message).toBe('second')
  })

  it('notifies listeners on add', () => {
    const listener = mock(() => {})
    subscribe(listener)
    toast('notify', 'info')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('notifies listeners on dismiss', () => {
    const listener = mock(() => {})
    subscribe(listener)
    toast('hello', 'info')
    listener.mockClear()
    dismissToast(getToasts()[0].id)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('returns unsubscribe function', () => {
    const listener = mock(() => {})
    const unsubscribe = subscribe(listener)
    toast('one', 'info')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    toast('two', 'info')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not notify on dismiss of non-existent id', () => {
    const listener = mock(() => {})
    subscribe(listener)
    dismissToast('nonexistent')
    expect(listener).not.toHaveBeenCalled()
  })

  it('dismissToast removes a toast by id', () => {
    toast('keep', 'info')
    toast('remove', 'error')
    const id = getToasts()[1].id
    dismissToast(id)
    const t = getToasts()
    expect(t.length).toBe(1)
    expect(t[0].message).toBe('keep')
  })
})
