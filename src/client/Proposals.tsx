import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Accommodation,
  Discussion,
  Proposal,
  ResortWithEmbedding,
  User,
} from '../shared/types.d'
import {
  createAccommodation as _createAccommodation,
  createProposal as _createProposal,
  deleteAccommodation as _deleteAccommodation,
  deleteProposal as _deleteProposal,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  listAccommodations as _listAccommodations,
  listDiscussion as _listDiscussion,
  listProposals as _listProposals,
  rejectProposal as _rejectProposal,
  revertProposalToDraft as _revertProposalToDraft,
  submitProposal as _submitProposal,
  updateAccommodation as _updateAccommodation,
  updateProposal as _updateProposal,
} from './backend'
import CreateProposalForm from './CreateProposalForm'
import type { StatusFilter } from './ProposalsGrid'
import ProposalsGrid from './ProposalsGrid'
import { borders, colors, fontSizes, fonts } from './theme'
import useIsSmallScreen from './useIsSmallScreen'
import { getErrorMessage } from './utils'

interface ProposalsProps {
  user: User
  tripId: string
  resorts: ResortWithEmbedding[]
  /** Pre-selected status tab — allows parent to navigate directly to a proposals sub-state. */
  statusFilter?: StatusFilter
  /** Called when the user clicks a status tab — lets the parent stay in sync when statusFilter is controlled. */
  onStatusFilterChange?: (status: StatusFilter) => void
  /** When provided, the ProposalCard with this ID will open to the specified sub-tab. */
  proposalDetail?: {
    proposalId: string
    subTab: 'proposal' | 'accommodations' | 'discussion'
  }
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
        summitAltitude: number
        baseAltitude: number
        nearestAirport: string
        transferTime: number | null
        pisteKm: number
        beginnerPct: number
        intermediatePct: number
        advancedPct: number
        liftCount: number
        snowReliability: 'high' | 'medium' | 'low'
        skiSeasonMonths: string
        websites: string[]
        latitude: string
        longitude: string
        linkedResortsDescription: string
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
  createAccommodation?: (
    proposalId: string,
    userId: string,
    data: { name: string; url?: string; cost?: string; description?: string }
  ) => Promise<unknown>
  updateAccommodation?: (
    accommodationId: string,
    userId: string,
    data: { name?: string; url?: string; cost?: string; description?: string }
  ) => Promise<unknown>
  deleteAccommodation?: (
    accommodationId: string,
    userId: string
  ) => Promise<unknown>
  getCoordinatorParticipant?: (
    tripId: string
  ) => Promise<{ participants: Array<{ user: string }> }>
  listDiscussion?: (proposalId: string) => Promise<Discussion[]>
}

const noopAuthError = () => {}

export default function Proposals({
  user,
  tripId,
  resorts,
  statusFilter,
  onStatusFilterChange,
  proposalDetail,
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
  createAccommodation = _createAccommodation,
  updateAccommodation = _updateAccommodation,
  deleteAccommodation = _deleteAccommodation,
  getCoordinatorParticipant = _getCoordinatorParticipant,
  listDiscussion = _listDiscussion,
}: ProposalsProps) {
  const isSmall = useIsSmallScreen()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [accommodations, setAccommodations] = useState<
    Record<string, Accommodation[]>
  >({})
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
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
      listProposals(tripId, user.id),
      getCoordinatorParticipant(tripId),
    ])
      .then(([proposalsResult, coordResult]) => {
        if (!mountedRef.current) return null
        setProposals(proposalsResult.proposals)
        setIsCoordinator(
          coordResult.participants.length > 0 &&
            coordResult.participants[0].user === user.id
        )
        return proposalsResult.proposals
      })
      .then((loadedProposals) => {
        if (!mountedRef.current || !loadedProposals) return
        const accommodationPromises = loadedProposals.map((p) =>
          listAccommodations(p.id).catch((err) => {
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
          accMap[loadedProposals[i].id] = accs
        })
        setAccommodations(accMap)
      })
      .catch((err) => {
        if (mountedRef.current) setProposalsError(getErrorMessage(err))
      })
      .finally(() => {
        if (mountedRef.current) setProposalsLoading(false)
      })
  }, [
    tripId,
    user.id,
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
      setProposals((p) => p.map((prop) => (prop.id === u.id ? u : prop)))
      listAccommodations(u.id)
        .then((accs) => {
          if (!mountedRef.current) return
          setAccommodations((prev) => ({ ...prev, [u.id]: accs }))
        })
        .catch(onAuthError)
    },
    [listAccommodations, onAuthError]
  )

  const handleDeleted = useCallback((id: string) => {
    setProposals((p) => p.filter((prop) => prop.id !== id))
  }, [])

  const handleRejected = useCallback((updated: unknown) => {
    const u = updated as Proposal
    setProposals((p) => p.map((prop) => (prop.id === u.id ? u : prop)))
  }, [])

  const handleRevertedToDraft = useCallback((updated: unknown) => {
    const u = updated as Proposal
    setProposals((p) => p.map((prop) => (prop.id === u.id ? u : prop)))
  }, [])

  const handleSubmitted = useCallback((updated: unknown) => {
    const u = updated as Proposal
    setProposals((p) => p.map((prop) => (prop.id === u.id ? u : prop)))
  }, [])

  const handleAccommodationsChanged = useCallback(
    (proposalId: string) => {
      listAccommodations(proposalId)
        .then((accs) => {
          if (!mountedRef.current) return
          setAccommodations((prev) => ({ ...prev, [proposalId]: accs }))
        })
        .catch(onAuthError)
    },
    [listAccommodations, onAuthError]
  )

  if (loading) return <p style={styles.message}>Loading…</p>

  return (
    <div
      style={{
        ...styles.container,
        padding: isSmall ? '16px 20px' : '40px 48px',
      }}
    >
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Proposals</h2>
        {tripId && (
          <div style={styles.buttons}>
            <button
              type="button"
              data-testid="new-proposal-btn"
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
          userId={user.id}
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
          userId={user.id}
          userName={user.name || ''}
          isCoordinator={isCoordinator}
          accommodations={accommodations}
          statusFilter={statusFilter}
          onStatusFilterChange={onStatusFilterChange}
          proposalDetail={proposalDetail}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onSubmitted={handleSubmitted}
          onRejected={handleRejected}
          onRevertedToDraft={handleRevertedToDraft}
          onAccommodationsChanged={handleAccommodationsChanged}
          emptyMessage="No proposals yet. Create one above."
          updateProposal={updateProposal}
          deleteProposal={deleteProposal}
          submitProposal={submitProposal}
          rejectProposal={rejectProposal}
          revertProposalToDraft={revertProposalToDraft}
          listAccommodations={listAccommodations}
          createAccommodation={createAccommodation}
          updateAccommodation={updateAccommodation}
          deleteAccommodation={deleteAccommodation}
          listDiscussion={listDiscussion}
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
    fontSize: fontSizes.md,
  },
  promptMessage: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '40px',
    textAlign: 'center',
    fontSize: fontSizes.md,
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
    fontSize: fontSizes['2xl'],
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
    fontSize: fontSizes.sm,
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
} as const
