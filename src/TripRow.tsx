import { useState, useEffect, useRef } from 'react'
import { getCoordinatorParticipant as _getCoordinatorParticipant } from './backend'
import { colors, fonts } from './theme'

interface TripRowProps {
  trip: {
    $id: string
    description?: string
  }
  onSelectTrip: (tripId: string) => void
  getCoordinatorParticipant?: (
    tripId: string
  ) => Promise<{ documents: Array<{ ParticipantUserName: string }> }>
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
      .then(({ documents }) => {
        if (!mountedRef.current || documents.length === 0) return
        setCoordinator({ name: documents[0].ParticipantUserName })
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
} as const
