import { describe, expect, it, mock } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import DateRangeField from './DateRangeField'

function renderField(props = {}) {
  const defaults = {
    startDate: '',
    endDate: '',
    onChange: mock((_startDate: string, _endDate: string) => {}),
  }
  const utils = render(<DateRangeField {...defaults} {...props} />)
  return { ...utils, ...defaults, ...props }
}

describe('DateRangeField', () => {
  it('renders the label', () => {
    renderField()
    expect(screen.getByText('Trip Dates')).toBeTruthy()
  })

  it('renders with custom label', () => {
    renderField({ label: 'Date Range' })
    expect(screen.getByText('Date Range')).toBeTruthy()
  })

  it('displays error message', () => {
    renderField({ error: 'End date must be after start date' })
    expect(screen.getByText('End date must be after start date')).toBeTruthy()
  })

  it('renders day picker calendar', () => {
    const { container } = renderField()
    const tables = container.querySelectorAll('table')
    expect(tables.length).toBeGreaterThanOrEqual(1)
  })

  it('allows selecting a date range via calendar clicks', async () => {
    const onChange = mock((_s: string, _e: string) => {})
    const { container } = renderField({ onChange })
    const buttons = container.querySelectorAll('button[name="day"]')
    if (buttons.length >= 2) {
      await act(async () => {
        fireEvent.click(buttons[0])
      })
      expect(onChange).toHaveBeenCalledTimes(1)
      const firstCall = onChange.mock.calls[0] as [string, string]
      expect(firstCall[0]).toBeTruthy()
      expect(firstCall[1]).toBe('')
      await act(async () => {
        fireEvent.click(buttons[7])
      })
      expect(onChange).toHaveBeenCalledTimes(2)
      const secondCall = onChange.mock.calls[1] as [string, string]
      expect(secondCall[0]).toBeTruthy()
      expect(secondCall[1]).toBeTruthy()
    }
  })
})
