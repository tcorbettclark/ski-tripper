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
import { toast } from './toast'
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
  /** Incrementing this triggers a data refetch without remounting the component. */
  refreshTrigger?: number
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
    data: { name: string; url: string; cost?: string; description?: string }
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
  refreshTrigger = 0,
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
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [_proposalsLoading, setProposalsLoading] = useState(false)
  const [isCoordinator, setIsCoordinator] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const lastFetchedTripIdRef = useRef<string | null>(null)
  const lastFetchedTriggerRef = useRef(0)
  const listProposalsRef = useRef(listProposals)
  const getCoordinatorParticipantRef = useRef(getCoordinatorParticipant)
  const onAuthErrorRef = useRef(onAuthError)
  listProposalsRef.current = listProposals
  getCoordinatorParticipantRef.current = getCoordinatorParticipant
  onAuthErrorRef.current = onAuthError

  useEffect(() => {
    if (!tripId) {
      setProposals([])
      setIsCoordinator(false)
      setLoading(false)
      lastFetchedTripIdRef.current = null
      lastFetchedTriggerRef.current = 0
      return
    }
    if (
      lastFetchedTripIdRef.current === tripId &&
      lastFetchedTriggerRef.current === refreshTrigger
    )
      return
    lastFetchedTripIdRef.current = tripId
    lastFetchedTriggerRef.current = refreshTrigger
    setLoading(false)
    setProposalsLoading(true)
    Promise.all([
      listProposalsRef.current(tripId, user.id),
      getCoordinatorParticipantRef.current(tripId),
    ])
      .then(([proposalsResult, coordResult]) => {
        if (!mountedRef.current) return null
        setProposals((prev) => {
          const serverProposals = proposalsResult.proposals
          const serverIds = new Set(serverProposals.map((p: Proposal) => p.id))
          const localOnly = prev.filter((p) => !serverIds.has(p.id))
          return [...serverProposals, ...localOnly]
        })
        setIsCoordinator(
          coordResult.participants.length > 0 &&
            coordResult.participants[0].user === user.id
        )
      })
      .catch((err) => {
        if (mountedRef.current) toast(getErrorMessage(err), 'error')
      })
      .finally(() => {
        if (mountedRef.current) setProposalsLoading(false)
      })
  }, [tripId, user.id, refreshTrigger])

  const handleCreated = useCallback((proposal: unknown) => {
    setProposals((p) => [proposal as Proposal, ...p])
  }, [])

  const handleUpdated = useCallback((updated: unknown) => {
    const u = updated as Proposal
    setProposals((p) => p.map((prop) => (prop.id === u.id ? u : prop)))
  }, [])

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

  if (loading) return <p style={styles.message}>Loading…</p>

  return (
    <div
      style={{
        ...styles.container,
        padding: isSmall ? '16px 20px' : '40px 48px',
      }}
    >
      <div style={styles.toolbar}>
        <h1 style={styles.heading}>Proposals</h1>
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

      <ProposalsGrid
        proposals={proposals}
        userId={user.id}
        userName={user.name || ''}
        isCoordinator={isCoordinator}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        proposalDetail={proposalDetail}
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
        listAccommodations={listAccommodations}
        createAccommodation={createAccommodation}
        updateAccommodation={updateAccommodation}
        deleteAccommodation={deleteAccommodation}
        listDiscussion={listDiscussion}
        onAuthError={onAuthError}
      />
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
