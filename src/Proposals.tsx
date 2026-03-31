import { useEffect, useState, useCallback, useRef } from 'react'
import {
  listProposals as _listProposals,
  createProposal as _createProposal,
  updateProposal as _updateProposal,
  deleteProposal as _deleteProposal,
  submitProposal as _submitProposal,
  rejectProposal as _rejectProposal,
  getCoordinatorParticipant as _getCoordinatorParticipant,
} from './backend'
import type { Models } from 'appwrite'
import { randomProposal } from './randomProposal'
import CreateProposalForm from './CreateProposalForm'
import ProposalsTable from './ProposalsTable'
import { colors, fonts, borders } from './theme'

interface Proposal {
  $id: string
  tripId?: string
  resortName?: string
  country?: string
  ProposerUserId: string
  ProposerUserName?: string
  state: 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED'
}

interface ProposalsProps {
  user: Models.User
  tripId: string
  onRefresh?: () => void
  listProposals?: (
    tripId: string,
    userId: string
  ) => Promise<{ documents: Proposal[] }>
  createProposal?: (
    tripId: string,
    userId: string,
    userName: string,
    data: {
      title?: string
      description: string
      resortName?: string
      country?: string
      altitudeRange?: string
      nearestAirport?: string
      transferTime?: string
      accommodationName?: string
      accommodationUrl?: string
      approximateCost?: string
    }
  ) => Promise<unknown>
  updateProposal?: (
    proposalId: string,
    userId: string,
    data: Partial<Proposal>
  ) => Promise<unknown>
  deleteProposal?: (proposalId: string, userId: string) => Promise<void>
  submitProposal?: (proposalId: string, userId: string) => Promise<unknown>
  rejectProposal?: (proposalId: string, userId: string) => Promise<unknown>
  getCoordinatorParticipant?: (
    tripId: string
  ) => Promise<{ documents: Array<{ ParticipantUserId: string }> }>
}

export default function Proposals({
  user,
  tripId,
  onRefresh: _onRefresh,
  listProposals = _listProposals,
  createProposal = _createProposal,
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  rejectProposal = _rejectProposal,
  getCoordinatorParticipant = _getCoordinatorParticipant,
}: ProposalsProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [randomizing, setRandomizing] = useState(false)
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalsError, setProposalsError] = useState('')
  const [isCoordinator, setIsCoordinator] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!tripId) {
      setProposals([])
      setIsCoordinator(false)
      setLoading(false)
      return
    }
    setLoading(false)
    setProposalsLoading(true)
    setProposalsError('')
    Promise.all([
      listProposals(tripId, user.$id),
      getCoordinatorParticipant(tripId),
    ])
      .then(([proposalsResult, coordResult]) => {
        if (!mountedRef.current) return
        setProposals(proposalsResult.documents)
        setIsCoordinator(
          coordResult.documents.length > 0 &&
            coordResult.documents[0].ParticipantUserId === user.$id
        )
      })
      .catch((err) => {
        if (mountedRef.current)
          setProposalsError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (mountedRef.current) setProposalsLoading(false)
      })
  }, [tripId, user.$id, listProposals, getCoordinatorParticipant])

  const handleCreated = useCallback((proposal: unknown) => {
    setProposals((p) => [proposal as Proposal, ...p])
  }, [])

  const handleUpdated = useCallback((updated: unknown) => {
    const u = updated as Proposal
    setProposals((p) => p.map((prop) => (prop.$id === u.$id ? u : prop)))
  }, [])

  const handleDeleted = useCallback((id: string) => {
    setProposals((p) => p.filter((prop) => prop.$id !== id))
  }, [])

  const handleRejected = useCallback((updated: unknown) => {
    const u = updated as Proposal
    setProposals((p) => p.map((prop) => (prop.$id === u.$id ? u : prop)))
  }, [])

  async function handleRandomProposal() {
    setRandomizing(true)
    try {
      const data = randomProposal()
      const proposal = await createProposal(
        tripId,
        user.$id,
        user.name || '',
        data
      )
      handleCreated(proposal)
    } finally {
      setRandomizing(false)
    }
  }

  const handleSubmitted = useCallback((updated: unknown) => {
    const u = updated as Proposal
    setProposals((p) => p.map((prop) => (prop.$id === u.$id ? u : prop)))
  }, [])

  if (loading) return <p style={styles.message}>Loading…</p>

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Proposals</h2>
        {tripId && (
          <div style={styles.buttons}>
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              style={styles.actionButton}
            >
              {showCreateForm ? 'Cancel' : '+ New Proposal'}
            </button>
            <button
              type="button"
              onClick={handleRandomProposal}
              disabled={randomizing}
              style={styles.randomButton}
            >
              {randomizing ? 'Adding…' : '🎲 Random'}
            </button>
          </div>
        )}
      </div>

      {showCreateForm && tripId && (
        <CreateProposalForm
          tripId={tripId}
          userId={user.$id}
          onCreated={handleCreated}
          onDismiss={() => setShowCreateForm(false)}
          createProposal={createProposal}
        />
      )}

      {proposalsLoading && <p style={styles.message}>Loading proposals…</p>}
      {proposalsError && (
        <p style={{ ...styles.message, color: colors.error }}>
          {proposalsError}
        </p>
      )}

      {!proposalsLoading && !proposalsError && (
        <ProposalsTable
          proposals={proposals}
          userId={user.$id}
          isCoordinator={isCoordinator}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onSubmitted={handleSubmitted}
          onRejected={handleRejected}
          emptyMessage="No proposals yet. Create one above."
          updateProposal={updateProposal}
          deleteProposal={deleteProposal}
          submitProposal={submitProposal}
          rejectProposal={rejectProposal}
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
    fontFamily: fonts.body,
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '80px',
    textAlign: 'center',
    fontSize: '15px',
  },
  promptMessage: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '40px',
    textAlign: 'center',
    fontSize: '15px',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
    paddingBottom: '20px',
    borderBottom: borders.subtle,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: '30px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.01em',
  },
  buttons: {
    display: 'flex',
    gap: '10px',
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
    letterSpacing: '0.02em',
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
    letterSpacing: '0.02em',
  },
} as const
