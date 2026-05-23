import type { Models } from 'appwrite'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createProposal as _createProposal,
  deleteProposal as _deleteProposal,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  listAccommodations as _listAccommodations,
  listProposals as _listProposals,
  listResorts as _listResorts,
  rejectProposal as _rejectProposal,
  revertProposalToDraft as _revertProposalToDraft,
  submitProposal as _submitProposal,
  updateProposal as _updateProposal,
} from './backend'
import CreateProposalForm from './CreateProposalForm'
import ProposalsGrid from './ProposalsGrid'
import { borders, colors, fonts } from './theme'
import type { Accommodation, Proposal, Resort } from './types.d.ts'

interface ProposalsProps {
  user: Models.User
  tripId: string
  onRefresh?: () => void
  onAuthError?: (err: unknown) => void
  listProposals?: (
    tripId: string,
    userId: string
  ) => Promise<{ proposals: Proposal[] }>
  createProposal?: (
    tripId: string,
    userId: string,
    userName: string,
    data: {
      description: string
      startDate: string
      endDate: string
      resortData: {
        resortName: string
        country: string
        region: string
        topAltitude: number
        bottomAltitude: number
        nearestAirport: string
        transferTime: string
        pisteKm: number
        difficulty: 'beginner' | 'intermediate' | 'advanced'
        liftCount: number
        snowReliability: 'high' | 'medium' | 'low'
        skiSeasonMonths: string
        websiteUrl: string
        latitude: string
        longitude: string
      }
    }
  ) => Promise<unknown>
  listAccommodations?: (proposalId: string) => Promise<Accommodation[]>
  updateProposal?: (
    proposalId: string,
    userId: string,
    data: Partial<Proposal>
  ) => Promise<unknown>
  deleteProposal?: (proposalId: string, userId: string) => Promise<void>
  submitProposal?: (proposalId: string, userId: string) => Promise<unknown>
  rejectProposal?: (proposalId: string, userId: string) => Promise<unknown>
  revertProposalToDraft?: (
    proposalId: string,
    userId: string
  ) => Promise<unknown>
  getCoordinatorParticipant?: (
    tripId: string
  ) => Promise<{ participants: Array<{ participantUserId: string }> }>
  listResorts?: () => Promise<{ resorts: Resort[] }>
}

const noopAuthError = () => {}

export default function Proposals({
  user,
  tripId,
  onRefresh: _onRefresh,
  onAuthError = noopAuthError,
  listProposals = _listProposals,
  createProposal = _createProposal,
  listAccommodations = _listAccommodations,
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  rejectProposal = _rejectProposal,
  revertProposalToDraft = _revertProposalToDraft,
  getCoordinatorParticipant = _getCoordinatorParticipant,
  listResorts = _listResorts,
}: ProposalsProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [accommodations, setAccommodations] = useState<
    Record<string, Accommodation[]>
  >({})
  const [resorts, setResorts] = useState<Resort[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalsError, setProposalsError] = useState('')
  const [isCoordinator, setIsCoordinator] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    listResorts()
      .then((result) => {
        if (mountedRef.current) setResorts(result.resorts)
      })
      .catch(() => {})
  }, [listResorts])

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
        if (!mountedRef.current) return null
        setProposals(proposalsResult.proposals)
        setIsCoordinator(
          coordResult.participants.length > 0 &&
            coordResult.participants[0].participantUserId === user.$id
        )
        return proposalsResult.proposals
      })
      .then((loadedProposals) => {
        if (!mountedRef.current || !loadedProposals) return
        const accommodationPromises = loadedProposals.map((p) =>
          listAccommodations(p.$id).catch((err) => {
            onAuthError(err)
            return []
          })
        )
        return Promise.all(accommodationPromises).then(
          (accommodationResults) => ({
            loadedProposals,
            accommodationResults,
          })
        )
      })
      .then((result) => {
        if (!mountedRef.current || !result) return
        const { loadedProposals, accommodationResults } = result
        const accMap: Record<string, Accommodation[]> = {}
        accommodationResults.forEach((accs, i) => {
          accMap[loadedProposals[i].$id] = accs
        })
        setAccommodations(accMap)
      })
      .catch((err) => {
        if (mountedRef.current)
          setProposalsError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (mountedRef.current) setProposalsLoading(false)
      })
  }, [
    tripId,
    user.$id,
    listProposals,
    listAccommodations,
    getCoordinatorParticipant,
    onAuthError,
  ])

  const handleCreated = useCallback((proposal: unknown) => {
    setProposals((p) => [proposal as Proposal, ...p])
  }, [])

  const handleUpdated = useCallback(
    (updated: unknown) => {
      const u = updated as Proposal
      setProposals((p) => p.map((prop) => (prop.$id === u.$id ? u : prop)))
      listAccommodations(u.$id)
        .then((accs) => {
          if (!mountedRef.current) return
          setAccommodations((prev) => ({ ...prev, [u.$id]: accs }))
        })
        .catch(onAuthError)
    },
    [listAccommodations, onAuthError]
  )

  const handleDeleted = useCallback((id: string) => {
    setProposals((p) => p.filter((prop) => prop.$id !== id))
  }, [])

  const handleRejected = useCallback((updated: unknown) => {
    const u = updated as Proposal
    setProposals((p) => p.map((prop) => (prop.$id === u.$id ? u : prop)))
  }, [])

  const handleRevertedToDraft = useCallback((updated: unknown) => {
    const u = updated as Proposal
    setProposals((p) => p.map((prop) => (prop.$id === u.$id ? u : prop)))
  }, [])

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
          resorts={resorts}
        />
      )}

      {proposalsLoading && <p style={styles.message}>Loading proposals…</p>}
      {proposalsError && (
        <p style={{ ...styles.message, color: colors.error }}>
          {proposalsError}
        </p>
      )}

      {!proposalsLoading && !proposalsError && (
        <ProposalsGrid
          proposals={proposals}
          userId={user.$id}
          userName={user.name || ''}
          isCoordinator={isCoordinator}
          accommodations={accommodations}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onSubmitted={handleSubmitted}
          onRejected={handleRejected}
          onRevertedToDraft={handleRevertedToDraft}
          emptyMessage="No proposals yet. Create one above."
          updateProposal={updateProposal}
          deleteProposal={deleteProposal}
          submitProposal={submitProposal}
          rejectProposal={rejectProposal}
          revertProposalToDraft={revertProposalToDraft}
          onAuthError={onAuthError}
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
} as const
