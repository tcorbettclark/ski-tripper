import { useEffect, useMemo, useState } from 'react'
import type { Accommodation, Discussion, Proposal } from '../shared/types.d'
import {
  createAccommodation as _createAccommodation,
  deleteAccommodation as _deleteAccommodation,
  deleteProposal as _deleteProposal,
  listAccommodations as _listAccommodations,
  listDiscussion as _listDiscussion,
  rejectProposal as _rejectProposal,
  revertProposalToDraft as _revertProposalToDraft,
  submitProposal as _submitProposal,
  updateAccommodation as _updateAccommodation,
  updateProposal as _updateProposal,
} from './backend'
import ProposalCard from './ProposalCard'
import { borders, colors, fontSizes, fonts, mix } from './theme'

export type StatusFilter = 'DRAFT' | 'SUBMITTED' | 'REJECTED'

interface ProposalsGridProps {
  proposals: Proposal[]
  userId: string
  userName?: string
  isCoordinator?: boolean
  accommodations?: Record<string, Accommodation[]>
  /** Controlled status filter — allows parent (e.g. App) to preselect a tab when navigating here. When provided, the internal toggle is synced to this value. */
  statusFilter?: StatusFilter
  /** Called when the user clicks a status tab — lets the parent stay in sync when statusFilter is controlled. */
  onStatusFilterChange?: (status: StatusFilter) => void
  /** When provided, the ProposalCard with this ID will open to the specified sub-tab. */
  proposalDetail?: {
    proposalId: string
    subTab: 'proposal' | 'accommodations' | 'discussion'
  }
  onUpdated: (proposal: unknown) => void
  onDeleted: (proposalId: string) => void
  onSubmitted: (proposal: unknown) => void
  onRejected?: (proposal: unknown) => void
  onRevertedToDraft?: (proposal: unknown) => void
  onAccommodationsChanged?: (proposalId: string) => void
  emptyMessage?: string
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
  listAccommodations?: (proposalId: string) => Promise<Accommodation[]>
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
  listDiscussion?: (proposalId: string) => Promise<Discussion[]>
  debounceMs?: number
  onAuthError?: (err: unknown) => void
}

export default function ProposalsGrid({
  proposals,
  userId,
  userName = '',
  isCoordinator = false,
  accommodations = {},
  statusFilter: controlledStatusFilter,
  onStatusFilterChange,
  proposalDetail,
  onUpdated,
  onDeleted,
  onSubmitted,
  onRejected = () => {},
  onRevertedToDraft = () => {},
  onAccommodationsChanged,
  emptyMessage = 'No proposals yet. Create one above.',
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  rejectProposal = _rejectProposal,
  revertProposalToDraft = _revertProposalToDraft,
  listAccommodations = _listAccommodations,
  createAccommodation = _createAccommodation,
  updateAccommodation = _updateAccommodation,
  deleteAccommodation = _deleteAccommodation,
  listDiscussion = _listDiscussion,
  debounceMs = 300,
  onAuthError,
}: ProposalsGridProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [myProposalsOnly, setMyProposalsOnly] = useState(false)
  const [internalStatusFilter, setInternalStatusFilter] =
    useState<StatusFilter>('DRAFT')
  // When the parent controls statusFilter (e.g. navigating to SUBMITTED from NextActions), use that;
  // otherwise fall back to the user's own tab selection.
  const statusFilter = controlledStatusFilter ?? internalStatusFilter

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [searchQuery, debounceMs])

  const searchFilteredProposals = useMemo(() => {
    let result = proposals

    if (myProposalsOnly) {
      result = result.filter((p) => p.proposer === userId)
    }

    if (debouncedQuery) {
      const query = debouncedQuery.toLowerCase().trim()
      result = result.filter(
        (p) =>
          p.resortName?.toLowerCase().includes(query) ||
          p.country?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.proposerUserName?.toLowerCase().includes(query) ||
          p.nearestAirport?.toLowerCase().includes(query)
      )
    }

    return result
  }, [proposals, debouncedQuery, myProposalsOnly, userId])

  const filteredProposals = useMemo(() => {
    const result = searchFilteredProposals
      .filter((p) => p.state === statusFilter)
      .sort((a, b) =>
        (a.resortName || '')
          .toLowerCase()
          .localeCompare((b.resortName || '').toLowerCase())
      )
    return result
  }, [searchFilteredProposals, statusFilter])

  const isSearching = debouncedQuery.length > 0

  const isFiltered = isSearching || myProposalsOnly

  const tabCounts = useMemo(() => {
    const filtered = {
      DRAFT: searchFilteredProposals.filter((p) => p.state === 'DRAFT').length,
      SUBMITTED: searchFilteredProposals.filter((p) => p.state === 'SUBMITTED')
        .length,
      REJECTED: searchFilteredProposals.filter((p) => p.state === 'REJECTED')
        .length,
    }
    const total = {
      DRAFT: proposals.filter((p) => p.state === 'DRAFT').length,
      SUBMITTED: proposals.filter((p) => p.state === 'SUBMITTED').length,
      REJECTED: proposals.filter((p) => p.state === 'REJECTED').length,
    }
    if (isFiltered) {
      return {
        DRAFT: { filtered: filtered.DRAFT, total: total.DRAFT },
        SUBMITTED: { filtered: filtered.SUBMITTED, total: total.SUBMITTED },
        REJECTED: { filtered: filtered.REJECTED, total: total.REJECTED },
      }
    }
    return {
      DRAFT: { filtered: total.DRAFT, total: total.DRAFT },
      SUBMITTED: { filtered: total.SUBMITTED, total: total.SUBMITTED },
      REJECTED: { filtered: total.REJECTED, total: total.REJECTED },
    }
  }, [proposals, searchFilteredProposals, isFiltered])

  if (proposals.length === 0) {
    return <p style={styles.empty}>{emptyMessage}</p>
  }

  return (
    <div>
      <div style={styles.controls}>
        <input
          type="text"
          placeholder="Search proposals…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
        <label style={styles.myProposalsLabel}>
          <span style={styles.myProposalsLabelText}>My proposals</span>
          <button
            type="button"
            role="switch"
            aria-checked={myProposalsOnly}
            onClick={() => setMyProposalsOnly((v) => !v)}
            style={
              myProposalsOnly
                ? styles.myProposalsTrackActive
                : styles.myProposalsTrack
            }
          >
            <span
              style={
                myProposalsOnly
                  ? styles.myProposalsThumbActive
                  : styles.myProposalsThumb
              }
            />
          </button>
        </label>
      </div>

      <div style={styles.tabs}>
        {(['DRAFT', 'SUBMITTED', 'REJECTED'] as StatusFilter[]).map(
          (status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setInternalStatusFilter(status)
                onStatusFilterChange?.(status)
              }}
              style={
                statusFilter === status ? styles.tabActive : styles.tabInactive
              }
            >
              {status} (
              {isFiltered
                ? `${tabCounts[status].filtered}/${tabCounts[status].total}`
                : tabCounts[status].total}
              )
            </button>
          )
        )}
      </div>

      {filteredProposals.length === 0 ? (
        <p style={styles.emptySearch}>
          No proposals match your search. Try different criteria.
        </p>
      ) : (
        <div style={styles.fullWidthList}>
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              userId={userId}
              userName={userName}
              isCoordinator={isCoordinator}
              accommodations={accommodations[proposal.id] || []}
              initialTab={
                proposalDetail?.proposalId === proposal.id
                  ? proposalDetail.subTab
                  : undefined
              }
              onUpdated={onUpdated}
              onDeleted={onDeleted}
              onSubmitted={onSubmitted}
              onRejected={onRejected}
              onRevertedToDraft={onRevertedToDraft}
              onAccommodationsChanged={onAccommodationsChanged}
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
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap' as const,
  },
  searchInput: {
    flex: '1 1 200px',
    minWidth: '160px',
    padding: '10px 16px',
    borderRadius: '8px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    outline: 'none',
  },
  myProposalsLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap' as const,
  },
  myProposalsLabelText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  myProposalsTrack: {
    position: 'relative' as const,
    display: 'inline-block',
    width: '36px',
    height: '20px',
    borderRadius: '10px',
    border: 'none',
    background: colors.textSecondary,
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.2s',
  },
  myProposalsTrackActive: {
    position: 'relative' as const,
    display: 'inline-block',
    width: '36px',
    height: '20px',
    borderRadius: '10px',
    border: 'none',
    background: colors.accent,
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.2s',
  },
  myProposalsThumb: {
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: colors.bgPrimary,
    transition: 'left 0.2s',
  },
  myProposalsThumbActive: {
    position: 'absolute' as const,
    top: '2px',
    left: '18px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: 'var(--color-bgPrimary)',
    transition: 'left 0.2s',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    borderBottom: borders.subtle,
    paddingBottom: '0',
  },
  tabActive: {
    padding: '10px 20px',
    borderRadius: '8px 8px 0 0',
    border: 'none',
    borderBottom: `2px solid ${colors.accent}`,
    background: mix('--color-accent', 0.15),
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    cursor: 'pointer',
  },
  tabInactive: {
    padding: '10px 20px',
    borderRadius: '8px 8px 0 0',
    border: 'none',
    borderBottom: `2px solid transparent`,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500',
    cursor: 'pointer',
  },
  fullWidthList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  empty: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '60px 40px',
    textAlign: 'center',
    fontSize: fontSizes.md,
    fontStyle: 'italic',
  },
  emptySearch: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '40px',
    textAlign: 'center',
    fontSize: fontSizes.md,
  },
} as const
