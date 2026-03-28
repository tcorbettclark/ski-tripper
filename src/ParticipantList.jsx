import { useEffect, useState } from 'react'
import { listTripParticipants as _listTripParticipants } from './backend'
import { colors, fonts, borders } from './theme'

export default function ParticipantList ({
  tripId,
  listTripParticipants = _listTripParticipants
}) {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId) return
    listTripParticipants(tripId)
      .then(({ documents }) => {
        setParticipants(
          documents.map((p) => ({
            id: p.$id,
            name: p.ParticipantUserName,
            role: p.role
          }))
        )
      })
      .finally(() => setLoading(false))
  }, [tripId])

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
    margin: 0
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: borders.subtle
  },
  name: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textData
  },
  role: {
    fontFamily: fonts.body,
    fontSize: '12px',
    color: colors.textSecondary,
    textTransform: 'capitalize'
  }
}
