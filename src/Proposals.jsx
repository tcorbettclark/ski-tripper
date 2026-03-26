import { useEffect, useState } from 'react'
import {
  listParticipatedTrips as _listParticipatedTrips,
  listProposals as _listProposals,
  createProposal as _createProposal,
  updateProposal as _updateProposal,
  deleteProposal as _deleteProposal,
  submitProposal as _submitProposal
} from './backend'
import CreateProposalForm from './CreateProposalForm'
import ProposalsTable from './ProposalsTable'
import { colors, fonts, borders } from './theme'

export default function Proposals ({
  user,
  listParticipatedTrips = _listParticipatedTrips,
  listProposals = _listProposals,
  createProposal = _createProposal,
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal
}) {
  const [trips, setTrips] = useState([])
  const [selectedTripId, setSelectedTripId] = useState(null)
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalsError, setProposalsError] = useState('')

  useEffect(() => {
    listParticipatedTrips(user.$id)
      .then((result) => {
        setTrips(result)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user.$id])

  useEffect(() => {
    if (!selectedTripId) {
      setProposals([])
      return
    }
    setProposalsLoading(true)
    setProposalsError('')
    listProposals(selectedTripId, user.$id)
      .then((result) => {
        setProposals(result.documents)
      })
      .catch((err) => setProposalsError(err.message))
      .finally(() => setProposalsLoading(false))
  }, [selectedTripId])

  function handleCreated (proposal) {
    setProposals((p) => [proposal, ...p])
  }

  function handleUpdated (updated) {
    setProposals((p) => p.map((prop) => (prop.$id === updated.$id ? updated : prop)))
  }

  function handleDeleted (id) {
    setProposals((p) => p.filter((prop) => prop.$id !== id))
  }

  function handleSubmitted (updated) {
    setProposals((p) => p.map((prop) => (prop.$id === updated.$id ? updated : prop)))
  }

  if (loading) return <p style={styles.message}>Loading…</p>
  if (error) return <p style={{ ...styles.message, color: colors.error }}>{error}</p>

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Proposals</h2>
        {selectedTripId && (
          <div style={styles.buttons}>
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              style={styles.actionButton}
            >
              {showCreateForm ? 'Cancel' : '+ New Proposal'}
            </button>
          </div>
        )}
      </div>

      {trips.length === 0
        ? <p style={styles.message}>Join a trip first to create proposals.</p>
        : (
          <select
            value={selectedTripId || ''}
            onChange={(e) => {
              setSelectedTripId(e.target.value || null)
              setShowCreateForm(false)
            }}
            style={styles.select}
          >
            <option value=''>— Select a trip —</option>
            {trips.map((trip) => (
              <option key={trip.$id} value={trip.$id}>{trip.description || trip.code || trip.$id}</option>
            ))}
          </select>
          )}

      {showCreateForm && selectedTripId && (
        <CreateProposalForm
          tripId={selectedTripId}
          userId={user.$id}
          onCreated={handleCreated}
          onDismiss={() => setShowCreateForm(false)}
          createProposal={createProposal}
        />
      )}

      {proposalsLoading && <p style={styles.message}>Loading proposals…</p>}
      {proposalsError && <p style={{ ...styles.message, color: colors.error }}>{proposalsError}</p>}

      {!proposalsLoading && !proposalsError && (
        <ProposalsTable
          proposals={proposals}
          userId={user.$id}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onSubmitted={handleSubmitted}
          emptyMessage='No proposals yet. Create one above.'
          updateProposal={updateProposal}
          deleteProposal={deleteProposal}
          submitProposal={submitProposal}
        />
      )}
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
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
    paddingBottom: '20px',
    borderBottom: borders.subtle
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: '30px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.01em'
  },
  buttons: {
    display: 'flex',
    gap: '10px'
  },
  actionButton: {
    padding: '9px 22px',
    borderRadius: '7px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em'
  },
  select: {
    padding: '10px 14px',
    borderRadius: '7px',
    border: borders.muted,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
    outline: 'none',
    marginBottom: '24px',
    width: '100%'
  }
}
