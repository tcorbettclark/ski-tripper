import { useEffect, useRef, useState } from 'react'
import { getCoordinatorParticipant as _getCoordinatorParticipant } from './backend'
import { colors, fonts, mix } from './theme'
import type { Trip } from './types.d.ts'

interface TripRowProps {
  trip: Trip
  onSelectTrip: (tripId: string) => void
  getCoordinatorParticipant?: (
    tripId: string
  ) => Promise<{ participants: Array<{ participantUserName: string }> }>
}

export default function TripRow({
  trip,
  onSelectTrip,
  getCoordinatorParticipant = _getCoordinatorParticipant,
}: TripRowProps) {
  const [coordinator, setCoordinator] = useState<{ name: string } | null>(null)
  const [hovered, setHovered] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    getCoordinatorParticipant(trip.$id)
      .then(({ participants }) => {
        if (!mountedRef.current || participants.length === 0) return
        setCoordinator({ name: participants[0].participantUserName })
      })
      .catch((err) => console.error('Failed to fetch coordinator:', err))
  }, [trip.$id, getCoordinatorParticipant])

  return (
    <tr
      style={{
        ...styles.tr,
        ...(hovered ? styles.trHovered : {}),
        borderLeft: hovered
          ? `3px solid ${mix('--color-accent', 0.5)}`
          : '3px solid transparent',
      }}
      onClick={() => onSelectTrip(trip.$id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={{ ...styles.td, ...(hovered ? styles.tdHovered : {}) }}>
        {trip.description || '—'}
      </td>
      <td style={{ ...styles.td, ...(hovered ? styles.tdHovered : {}) }}>
        <span style={styles.cellContent}>
          {coordinator?.name || '—'}
          <span style={styles.chevron}>{hovered ? ' ›' : ''}</span>
        </span>
      </td>
    </tr>
  )
}

const styles = {
  tr: {
    borderBottom: `1px solid ${mix('--color-textSecondary', 0.07)}`,
    cursor: 'pointer',
    transition: 'background 0.15s, border-left 0.15s',
  },
  trHovered: {
    background: mix('--color-accent', 0.08),
  },
  td: {
    padding: '14px 16px',
    color: colors.textData,
    verticalAlign: 'top',
    fontFamily: fonts.body,
    fontSize: '14px',
    lineHeight: '1.5',
    transition: 'color 0.15s',
  },
  tdHovered: {
    color: colors.textPrimary,
  },
  cellContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  chevron: {
    color: colors.accent,
    fontSize: '18px',
    fontWeight: '600',
    lineHeight: '1',
  },
} as const
