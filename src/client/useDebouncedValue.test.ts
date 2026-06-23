import { describe, expect, it, vi } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 100))
    expect(result.current).toBe('hello')
  })

  it('returns value synchronously when delayMs is 0', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 0 } }
    )
    expect(result.current).toBe('a')

    rerender({ value: 'b', delay: 0 })
    expect(result.current).toBe('b')
  })

  it('debounces value changes', () => {
    vi.useFakeTimers()

    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 100 } }
    )
    expect(result.current).toBe('a')

    rerender({ value: 'b', delay: 100 })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(result.current).toBe('b')

    vi.useRealTimers()
  })

  it('cancels previous timer on rapid changes', () => {
    vi.useFakeTimers()

    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 100 } }
    )

    rerender({ value: 'b', delay: 100 })
    rerender({ value: 'c', delay: 100 })

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('c')

    vi.useRealTimers()
  })

  it('updates immediately when delay changes to 0', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 100 } }
    )

    rerender({ value: 'b', delay: 0 })
    expect(result.current).toBe('b')
  })
})
