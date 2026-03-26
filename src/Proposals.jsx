import { useEffect, useState, useCallback, useRef } from 'react'
import {
  listParticipatedTrips as _listParticipatedTrips,
  listProposals as _listProposals,
  createProposal as _createProposal,
  updateProposal as _updateProposal,
  deleteProposal as _deleteProposal,
  submitProposal as _submitProposal,
  getUserById as _getUserById
} from './backend'
import CreateProposalForm from './CreateProposalForm'
import { randomProposal } from './randomProposal'
import ProposalsTable from './ProposalsTable'
import { colors, fonts, borders } from './theme'

export default function Proposals ({
  user,
  refreshTrips,
  selectedTripId: initialSelectedTripId,
  listParticipatedTrips = _listParticipatedTrips,
  listProposals = _listProposals,
  createProposal = _createProposal,
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  getUserById = _getUserById
}) {
  const [trips, setTrips] = useState([])
  const [selectedTripId, setSelectedTripId] = useState(initialSelectedTripId || null)
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [randomizing, setRandomizing] = useState(false)
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalsError, setProposalsError] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (initialSelectedTripId) {
      setSelectedTripId(initialSelectedTripId)
    }
  }, [initialSelectedTripId])

  useEffect(() => {
    listParticipatedTrips(user.$id)
      .then((result) => {
        if (mountedRef.current) {
          setTrips(result.documents)
          if (result.documents.length === 1 && !selectedTripId) {
            setSelectedTripId(result.documents[0].$id)
          }
        }
      })
      .catch((err) => { if (mountedRef.current) setError(err.message) })
      .finally(() => { if (mountedRef.current) setLoading(false) })
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
        if (mountedRef.current) setProposals(result.documents)
      })
      .catch((err) => { if (mountedRef.current) setProposalsError(err.message) })
      .finally(() => { if (mountedRef.current) setProposalsLoading(false) })
  }, [selectedTripId, user.$id])

  const handleCreated = useCallback((proposal) => {
    setProposals((p) => [proposal, ...p])
  }, [])

  const handleUpdated = useCallback((updated) => {
    setProposals((p) => p.map((prop) => (prop.$id === updated.$id ? updated : prop)))
  }, [])

  const handleDeleted = useCallback((id) => {
    setProposals((p) => p.filter((prop) => prop.$id !== id))
  }, [])

  async function handleRandomProposal () {
    setRandomizing(true)
    try {
      const proposal = await createProposal(selectedTripId, user.$id, randomProposal())
      handleCreated(proposal)
    } finally {
      setRandomizing(false)
    }
  }

  const handleSubmitted = useCallback((updated) => {
    setProposals((p) => p.map((prop) => (prop.$id === updated.$id ? updated : prop)))
  }, [])

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
            <button
              onClick={handleRandomProposal}
              disabled={randomizing}
              style={styles.randomButton}
            >
              {randomizing ? 'Adding…' : '🎲 Random'}
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
          getUserById={getUserById}
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
  randomButton: {
    padding: '9px 22px',
    borderRadius: '7px',
    border: `1px solid ${colors.accent}`,
    background: 'transparent',
    color: colors.accent,
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
