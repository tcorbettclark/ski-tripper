import { describe, expect, it, mock } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PreferencesModal from './PreferencesModal'
import type { Preferences } from './types.d'

const defaultPreferences: Preferences = {
  $id: 'pref-1',
  $createdAt: '2024-01-01T00:00:00.000Z',
  $updatedAt: '2024-01-01T00:00:00.000Z',
  userId: 'user-1',
  skiSnowboard: JSON.stringify(['Ski']),
  difficulty: JSON.stringify(['Red']),
  piste: JSON.stringify(['On-Piste']),
  timeSlopes: 20,
  timeEating: 20,
  timeApres: 20,
  timeHotel: 40,
  accommodation: JSON.stringify(['Chalet']),
  mostImportantAspect: 'Good snow',
}

describe('PreferencesModal', () => {
  it('does not render when closed', async () => {
    await act(async () => {
      render(
        <PreferencesModal
          userId="user-1"
          initial={defaultPreferences}
          open={false}
          onClose={mock(() => {})}
          onSaved={mock(() => {})}
        />
      )
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders edit form directly when open with existing preferences', async () => {
    await act(async () => {
      render(
        <PreferencesModal
          userId="user-1"
          initial={defaultPreferences}
          open
          onClose={mock(() => {})}
          onSaved={mock(() => {})}
        />
      )
    })
    expect(screen.queryByRole('dialog')).not.toBeNull()
    expect(screen.queryByText('Update Preferences')).not.toBeNull()
    expect(screen.getByDisplayValue('Good snow')).toBeDefined()
  })

  it('closes when close button is clicked', async () => {
    const ue = userEvent.setup()
    const mockClose = mock(() => {})
    await act(async () => {
      render(
        <PreferencesModal
          userId="user-1"
          initial={defaultPreferences}
          open
          onClose={mockClose}
          onSaved={mock(() => {})}
        />
      )
    })
    await ue.click(screen.getByRole('button', { name: /close/i }))
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('calls onSaved after updating preferences', async () => {
    const ue = userEvent.setup()
    const mockSaved = mock(() => {})
    const mockUpdate = mock(() =>
      Promise.resolve({
        ...defaultPreferences,
        mostImportantAspect: 'Updated value',
      })
    )

    await act(async () => {
      render(
        <PreferencesModal
          userId="user-1"
          initial={defaultPreferences}
          open
          onClose={mock(() => {})}
          onSaved={mockSaved}
          updatePreferences={mockUpdate}
        />
      )
    })

    const input = screen.getByPlaceholderText(/great après-ski scene/i)
    await ue.clear(input)
    await ue.type(input, 'Updated value')

    await ue.click(screen.getByRole('button', { name: /update preferences/i }))

    await waitFor(() => {
      expect(mockSaved).toHaveBeenCalledTimes(1)
    })
  })
})
