import { useEffect, useState } from 'react'
import { listTripParticipants as _listTripParticipants } from './backend'
import { colors, fonts, borders } from './theme'

interface Participant {
  id: string
  name: string
  role: 'coordinator' | 'participant'
}

interface ParticipantListProps {
  tripId: string
  listTripParticipants?: (tripId: string) => Promise<{
    documents: Array<{
      $id: string
      ParticipantUserName: string
      role: 'coordinator' | 'participant'
    }>
  }>
}

export default function ParticipantList({
  tripId,
  listTripParticipants = _listTripParticipants,
}: ParticipantListProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!tripId) return
    async function load() {
      try {
        const { documents } = await listTripParticipants(tripId)
        setParticipants(
          documents.map((p) => ({
            id: p.$id,
            name: p.ParticipantUserName,
            role: p.role,
          }))
        )
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tripId, listTripParticipants])

  if (error) throw error

  if (loading) return <p style={styles.loading}>Loading participants…</p>

  return (
    <ul style={styles.list}>
      {participants.map((p) => (
        <li key={p.id} style={styles.item}>
          <span style={styles.name}>{p.name}</span>
          <span style={styles.role}>{p.role}</span>
        </li>
      ))}
    </ul>
  )
}

const styles = {
  loading: {
    color: colors.textSecondary,
    fontSize: '14px',
    margin: 0,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: borders.subtle,
  },
  name: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textData,
  },
  role: {
    fontFamily: fonts.body,
    fontSize: '12px',
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
} as const
