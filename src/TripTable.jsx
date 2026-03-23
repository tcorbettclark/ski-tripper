import TripRow from './TripRow'

export default function TripTable ({ trips, onUpdated, onDeleted }) {
  if (trips.length === 0) {
    return <p style={styles.empty}>No trips yet. Add one above.</p>
  }

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Code</th>
          <th style={styles.th}>Name</th>
          <th style={styles.th}>Description</th>
          <th style={styles.th} />
        </tr>
      </thead>
      <tbody>
        {trips.map((trip) => (
          <TripRow
            key={trip.$id}
            trip={trip}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
          />
        ))}
      </tbody>
    </table>
  )
}

const styles = {
  empty: {
    color: '#6a94ae',
    fontFamily: "'DM Sans', sans-serif",
    padding: '60px 40px',
    textAlign: 'center',
    fontSize: '15px',
    fontStyle: 'italic'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px'
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    background: '#0d1e30',
    borderBottom: '1px solid rgba(100,190,230,0.1)',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    fontWeight: '500',
    color: '#6a94ae',
    letterSpacing: '0.1em',
    textTransform: 'uppercase'
  }
}
