import { useState } from 'react'
import EditTripForm from './EditTripForm'

export default function TripRow ({ trip, onUpdated, onDeleted }) {
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return (
      <tr style={styles.editingTr}>
        <td style={styles.editingTd} colSpan={4}>
          <EditTripForm
            trip={trip}
            onUpdated={(updated) => {
              onUpdated(updated)
              setIsEditing(false)
            }}
            onDeleted={() => onDeleted(trip.$id)}
            onCancel={() => setIsEditing(false)}
          />
        </td>
      </tr>
    )
  }

  return (
    <tr style={styles.tr}>
      <td style={styles.codeCell}>{trip.code || '—'}</td>
      <td style={styles.td}>{trip.name}</td>
      <td style={{ ...styles.td, color: '#6a94ae' }}>{trip.description || '—'}</td>
      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
        <button onClick={() => setIsEditing(true)} style={styles.editButton}>
          Edit
        </button>
      </td>
    </tr>
  )
}

const styles = {
  codeCell: {
    padding: '14px 16px',
    color: '#6a94ae',
    verticalAlign: 'top',
    fontFamily: 'monospace',
    fontSize: '13px',
    letterSpacing: '0.08em',
    whiteSpace: 'nowrap'
  },
  tr: {
    borderBottom: '1px solid rgba(100,190,230,0.07)'
  },
  td: {
    padding: '14px 16px',
    color: '#b0cedf',
    verticalAlign: 'top',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    lineHeight: '1.5'
  },
  editingTr: {
    borderBottom: '1px solid rgba(59,189,232,0.2)',
    borderTop: '1px solid rgba(59,189,232,0.2)',
    background: 'rgba(59,189,232,0.04)'
  },
  editingTd: {
    padding: '20px 24px',
    verticalAlign: 'top',
    borderLeft: '2px solid #3bbde8'
  },
  editButton: {
    padding: '5px 16px',
    borderRadius: '5px',
    border: '1px solid rgba(100,190,230,0.15)',
    background: 'transparent',
    color: '#6a94ae',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em'
  }
}
