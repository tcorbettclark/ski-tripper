import { describe, it, expect, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import Field from './Field'

const noop = () => {}

function renderField(props = {}) {
  return render(
    <Field label="Name" name="name" value="" onChange={noop} {...props} />
  )
}

describe('Field', () => {
  it('renders the label text', () => {
    renderField({ label: 'Resort', name: 'resort' })
    expect(screen.getByText('Resort')).toBeInTheDocument()
  })

  it('renders an input with the correct value', () => {
    renderField({ value: 'Ski Alps' })
    expect(screen.getByRole('textbox')).toHaveValue('Ski Alps')
  })

  it('calls onChange when the input changes', () => {
    const handleChange = mock(() => {})
    renderField({ onChange: handleChange })
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Chamonix', name: 'name' },
    })
    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it('renders an input with the specified type', () => {
    renderField({ label: 'Email', name: 'email', type: 'email' })
    expect(screen.getByRole('textbox').type).toBe('email')
  })
})
