import { useEffect, useRef, useState } from 'react'
import { getCoordinatorParticipant as _getCoordinatorParticipant } from './backend'
import { colors, fonts } from './theme'
import type { Trip } from './types.d.ts'

interface TripRowProps {
  trip: Trip
  onSelectTrip: (tripId: string) => void
  onShowTripInfo: (tripId: string) => void
  getCoordinatorParticipant?: (
    tripId: string
  ) => Promise<{ participants: Array<{ participantUserName: string }> }>
}

export default function TripRow({
  trip,
  onSelectTrip,
  onShowTripInfo,
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
      style={{ ...styles.tr, ...(hovered ? styles.trHovered : {}) }}
      onClick={() => onSelectTrip(trip.$id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={{ ...styles.td, color: colors.textSecondary }}>
        {trip.description || '—'}
      </td>
      <td style={{ ...styles.td, color: colors.textSecondary }}>
        {coordinator?.name || '—'}
      </td>
      <td style={styles.actionsCell}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onShowTripInfo(trip.$id)
          }}
          style={styles.infoButton}
          aria-label="Trip info"
        >
          ⚙
        </button>
      </td>
    </tr>
  )
}

const styles = {
  tr: {
    borderBottom: '1px solid rgba(100,190,230,0.07)',
    cursor: 'pointer',
  },
  trHovered: {
    background: 'rgba(59,189,232,0.06)',
  },
  td: {
    padding: '14px 16px',
    color: colors.textData,
    verticalAlign: 'top',
    fontFamily: fonts.body,
    fontSize: '14px',
    lineHeight: '1.5',
  },
  actionsCell: {
    padding: '14px 16px',
    textAlign: 'right',
    verticalAlign: 'middle',
  },
  infoButton: {
    background: 'none',
    border: '1px solid rgba(100,190,230,0.2)',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textSecondary,
    fontSize: '14px',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
} as const
