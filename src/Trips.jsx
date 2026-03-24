import { useEffect, useState } from 'react'
import { listTrips, listParticipatedTrips } from './database'
import CreateTripForm from './CreateTripForm'
import JoinTripForm from './JoinTripForm'
import TripTable from './TripTable'
import { colors, fonts, borders } from './theme'

export default function Trips ({ user }) {
  const [trips, setTrips] = useState([])
  const [participatedTrips, setParticipatedTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      listTrips(user.$id),
      listParticipatedTrips(user.$id)
    ])
      .then(([ownRes, participated]) => {
        setTrips(ownRes.documents)
        setParticipatedTrips(participated)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user.$id])

  function handleCreated (trip) {
    setTrips((t) => [trip, ...t])
  }

  function handleUpdated (updated) {
    setTrips((t) =>
      t.map((trip) => (trip.$id === updated.$id ? updated : trip))
    )
  }

  function handleDeleted (id) {
    setTrips((t) => t.filter((trip) => trip.$id !== id))
  }

  function handleJoined (trip) {
    setParticipatedTrips((t) => [trip, ...t])
  }

  function handleLeft (tripId) {
    setParticipatedTrips((t) => t.filter((trip) => trip.$id !== tripId))
  }

  if (loading) return <p style={styles.message}>Loading trips…</p>
  if (error) { return <p style={{ ...styles.message, color: colors.error }}>{error}</p> }

  return (
    <div style={styles.container}>
      <CreateTripForm user={user} onCreated={handleCreated} />
      <TripTable
        trips={trips}
        userId={user.$id}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        showCoordinator={false}
      />

      <div style={styles.divider} />

      <JoinTripForm user={user} onJoined={handleJoined} />
      <TripTable
        trips={participatedTrips}
        userId={user.$id}
        onLeft={handleLeft}
        emptyMessage="You haven't joined any trips yet."
      />
    </div>
  )
}

const styles = {
  container: {
    padding: '40px 48px',
    maxWidth: '960px',
    margin: '0 auto',
    fontFamily: fonts.body
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '80px',
    textAlign: 'center',
    fontSize: '15px'
  },
  divider: {
    borderTop: borders.subtle,
    margin: '48px 0'
  }
}
