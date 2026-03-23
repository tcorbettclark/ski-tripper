import { useEffect, useState } from 'react'
import { listTrips } from './database'
import CreateTripForm from './CreateTripForm'
import TripTable from './TripTable'

export default function Trips ({ user }) {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listTrips(user.$id)
      .then((res) => setTrips(res.documents))
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

  if (loading) return <p style={styles.message}>Loading trips…</p>
  if (error) { return <p style={{ ...styles.message, color: '#ff6b6b' }}>{error}</p> }

  return (
    <div style={styles.container}>
      <CreateTripForm userId={user.$id} onCreated={handleCreated} />
      <TripTable
        trips={trips}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  )
}

const styles = {
  container: {
    padding: '40px 48px',
    maxWidth: '960px',
    margin: '0 auto',
    fontFamily: "'DM Sans', sans-serif"
  },
  message: {
    color: '#7a9ab5',
    fontFamily: "'DM Sans', sans-serif",
    padding: '80px',
    textAlign: 'center',
    fontSize: '15px'
  }
}
