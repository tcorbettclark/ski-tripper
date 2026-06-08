import { describe, expect, it, mock } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PreferencesForm from './PreferencesForm'
import type { Preferences } from './types.d'

const defaultPreferences: Preferences = {
  $id: 'pref-1',
  $createdAt: '2024-01-01T00:00:00.000Z',
  $updatedAt: '2024-01-01T00:00:00.000Z',
  userId: 'user-1',
  skiSnowboard: ['Ski'],
  difficulty: ['Red'],
  piste: ['On-Piste'],
  timeSlopes: 20,
  timeEating: 20,
  timeApres: 20,
  timeHotel: 40,
  accommodation: ['Chalet'],
  notes: 'Good snow',
}

describe('PreferencesForm', () => {
  it('renders all fields', async () => {
    await act(async () => {
      render(<PreferencesForm userId="user-1" onSaved={mock(() => {})} />)
    })
    expect(screen.getByText('Ski / Snowboard')).toBeDefined()
    expect(screen.getByText('Difficulty')).toBeDefined()
    expect(screen.getByText('Piste')).toBeDefined()
    expect(screen.getByText('Time Allocation')).toBeDefined()
    expect(screen.getByText('Accommodation')).toBeDefined()
    expect(screen.getByText('Notes')).toBeDefined()
  })

  it('toggles checkboxes', async () => {
    const ue = userEvent.setup()
    await act(async () => {
      render(<PreferencesForm userId="user-1" onSaved={mock(() => {})} />)
    })

    const skiCheckbox = screen.getByRole('checkbox', {
      name: 'Ski',
    }) as HTMLInputElement
    expect(skiCheckbox.checked).toBe(false)
    await ue.click(skiCheckbox)
    expect(skiCheckbox.checked).toBe(true)
  })

  it('validates time allocation sums to 100%', async () => {
    const ue = userEvent.setup()
    await act(async () => {
      render(<PreferencesForm userId="user-1" onSaved={mock(() => {})} />)
    })

    // Adjust sliders to make total != 100
    const slopesSlider = screen.getAllByRole('slider')[0] as HTMLInputElement
    fireEvent.change(slopesSlider, { target: { value: '0' } })

    await ue.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => {
      expect(screen.getByText('Time allocations must sum to 100%.'))
    })
  })

  it('calls createPreferences on submit for new user', async () => {
    const ue = userEvent.setup()
    const mockCreate = mock(() => Promise.resolve(defaultPreferences))
    const mockSaved = mock(() => {})

    await act(async () => {
      render(
        <PreferencesForm
          userId="user-1"
          onSaved={mockSaved}
          createPreferences={mockCreate}
        />
      )
    })

    // Check a few boxes
    await ue.click(screen.getByRole('checkbox', { name: 'Ski' }))
    await ue.click(screen.getByRole('checkbox', { name: 'Red' }))
    await ue.click(screen.getByRole('checkbox', { name: 'On-Piste' }))
    await ue.click(screen.getByRole('checkbox', { name: 'Chalet' }))

    await ue.type(
      screen.getByPlaceholderText(/tell us what matters most/i),
      'Good snow'
    )

    await ue.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(mockSaved).toHaveBeenCalledTimes(1)
    })
  })

  it('calls updatePreferences on submit for existing user', async () => {
    const ue = userEvent.setup()
    const mockUpdate = mock(() => Promise.resolve(defaultPreferences))
    const mockSaved = mock(() => {})

    await act(async () => {
      render(
        <PreferencesForm
          userId="user-1"
          initial={defaultPreferences}
          onSaved={mockSaved}
          updatePreferences={mockUpdate}
        />
      )
    })

    await ue.type(
      screen.getByPlaceholderText(/tell us what matters most/i),
      'Good snow'
    )

    await ue.click(screen.getByRole('button', { name: /update preferences/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(mockSaved).toHaveBeenCalledTimes(1)
    })
  })

  it('displays inline error when submit fails', async () => {
    const ue = userEvent.setup()
    const mockCreate = mock(() => Promise.reject(new Error('Network error')))

    await act(async () => {
      render(
        <PreferencesForm
          userId="user-1"
          onSaved={mock(() => {})}
          createPreferences={mockCreate}
        />
      )
    })

    await ue.click(screen.getByRole('checkbox', { name: 'Ski' }))
    await ue.click(screen.getByRole('checkbox', { name: 'Red' }))
    await ue.click(screen.getByRole('checkbox', { name: 'On-Piste' }))
    await ue.click(screen.getByRole('checkbox', { name: 'Chalet' }))
    await ue.type(
      screen.getByPlaceholderText(/tell us what matters most/i),
      'Good snow'
    )

    await ue.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => {
      expect(screen.getByText('Network error'))
    })
  })

  it('shows cancel button when onCancel is provided', async () => {
    await act(async () => {
      render(
        <PreferencesForm
          userId="user-1"
          onSaved={mock(() => {})}
          onCancel={mock(() => {})}
        />
      )
    })
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined()
  })

  it('renders name field when updateName is provided', async () => {
    await act(async () => {
      render(
        <PreferencesForm
          userId="user-1"
          userName="Alice"
          onSaved={mock(() => {})}
          updateName={mock(() => Promise.resolve({}))}
        />
      )
    })
    expect(screen.getByLabelText('Name')).toBeDefined()
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
      'Alice'
    )
  })

  it('does not render name field when updateName is not provided', async () => {
    await act(async () => {
      render(<PreferencesForm userId="user-1" onSaved={mock(() => {})} />)
    })
    expect(screen.queryByLabelText('Name')).toBeNull()
  })

  it('calls updateName when name is changed and form is submitted', async () => {
    const ue = userEvent.setup()
    const mockUpdateName = mock(() => Promise.resolve({}))
    const mockNameUpdated = mock(() => {})
    const mockCreate = mock(() => Promise.resolve(defaultPreferences))

    await act(async () => {
      render(
        <PreferencesForm
          userId="user-1"
          userName="Alice"
          onSaved={mock(() => {})}
          onNameUpdated={mockNameUpdated}
          updateName={mockUpdateName}
          createPreferences={mockCreate}
        />
      )
    })

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    await ue.clear(nameInput)
    await ue.type(nameInput, 'Bob')

    await ue.click(screen.getByRole('checkbox', { name: 'Ski' }))
    await ue.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => {
      expect(mockUpdateName).toHaveBeenCalledWith('Bob')
    })
    await waitFor(() => {
      expect(mockNameUpdated).toHaveBeenCalledTimes(1)
    })
  })

  it('does not call updateName when name is unchanged', async () => {
    const ue = userEvent.setup()
    const mockUpdateName = mock(() => Promise.resolve({}))
    const mockCreate = mock(() => Promise.resolve(defaultPreferences))

    await act(async () => {
      render(
        <PreferencesForm
          userId="user-1"
          userName="Alice"
          onSaved={mock(() => {})}
          updateName={mockUpdateName}
          createPreferences={mockCreate}
        />
      )
    })

    await ue.click(screen.getByRole('checkbox', { name: 'Ski' }))
    await ue.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1)
    })
    expect(mockUpdateName).not.toHaveBeenCalled()
  })

  it('displays inline error when updateName fails', async () => {
    const ue = userEvent.setup()
    const mockUpdateName = mock(() =>
      Promise.reject(new Error('Name update failed'))
    )
    const mockCreate = mock(() => Promise.resolve(defaultPreferences))

    await act(async () => {
      render(
        <PreferencesForm
          userId="user-1"
          userName="Alice"
          onSaved={mock(() => {})}
          updateName={mockUpdateName}
          createPreferences={mockCreate}
        />
      )
    })

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    await ue.clear(nameInput)
    await ue.type(nameInput, 'Bob')

    await ue.click(screen.getByRole('checkbox', { name: 'Ski' }))
    await ue.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => {
      expect(screen.getByText('Name update failed'))
    })
  })

  it('name input uses autoComplete=name', async () => {
    await act(async () => {
      render(
        <PreferencesForm
          userId="user-1"
          userName="Alice"
          onSaved={mock(() => {})}
          updateName={mock(() => Promise.resolve({}))}
        />
      )
    })
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    expect(nameInput.autocomplete).toBe('name')
  })
})
