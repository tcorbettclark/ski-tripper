import { useEffect, useRef, useState } from 'react'
import { getCoordinatorParticipant as _getCoordinatorParticipant } from './backend'
import { colors, fontSizes, fonts, mix } from './theme'
import type { Trip } from './types.d.ts'

interface TripRowProps {
  trip: Trip
  onSelectTrip: (tripId: string) => void
  getCoordinatorParticipant?: (
    tripId: string
  ) => Promise<{ participants: Array<{ userName: string }> }>
}

export default function TripRow({
  trip,
  onSelectTrip,
  getCoordinatorParticipant = _getCoordinatorParticipant,
}: TripRowProps) {
  const [coordinator, setCoordinator] = useState<{ name: string } | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    getCoordinatorParticipant(trip.id)
      .then(({ participants }) => {
        if (!mountedRef.current || participants.length === 0) return
        setCoordinator({ name: participants[0].userName })
      })
      .catch((err) => console.error('Failed to fetch coordinator:', err))
  }, [trip.id, getCoordinatorParticipant])

  return (
    <tr style={styles.tr} onClick={() => onSelectTrip(trip.id)}>
      <td style={styles.td}>{trip.description || '—'}</td>
      <td style={styles.td}>
        <span style={styles.cellContent}>{coordinator?.name || '—'}</span>
      </td>
    </tr>
  )
}

const styles = {
  tr: {
    borderBottom: `1px solid ${mix('--color-textSecondary', 0.07)}`,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  td: {
    padding: '14px 16px',
    color: colors.textData,
    verticalAlign: 'top',
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    lineHeight: '1.5',
    transition: 'background 0.15s, color 0.15s',
  },
  cellContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
} as const
