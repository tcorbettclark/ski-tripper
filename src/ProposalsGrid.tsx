import { useEffect, useMemo, useState } from 'react'
import {
  deleteProposal as _deleteProposal,
  rejectProposal as _rejectProposal,
  resubmitProposal as _resubmitProposal,
  submitProposal as _submitProposal,
  updateProposal as _updateProposal,
} from './backend'
import ProposalCard from './ProposalCard'
import { borders, colors, fonts } from './theme'
import type { Accommodation, Proposal } from './types.d.ts'

type StatusFilter = 'DRAFT' | 'SUBMITTED' | 'REJECTED'

interface ProposalsGridProps {
  proposals: Proposal[]
  userId: string
  userName?: string
  isCoordinator?: boolean
  accommodations?: Record<string, Accommodation[]>
  onUpdated: (proposal: unknown) => void
  onDeleted: (proposalId: string) => void
  onSubmitted: (proposal: unknown) => void
  onRejected?: (proposal: unknown) => void
  onResubmitted?: (proposal: unknown) => void
  emptyMessage?: string
  updateProposal?: (
    proposalId: string,
    userId: string,
    data: Partial<Proposal>
  ) => Promise<unknown>
  deleteProposal?: (proposalId: string, userId: string) => Promise<void>
  submitProposal?: (proposalId: string, userId: string) => Promise<unknown>
  rejectProposal?: (proposalId: string, userId: string) => Promise<unknown>
  resubmitProposal?: (proposalId: string, userId: string) => Promise<unknown>
  debounceMs?: number
}

export default function ProposalsGrid({
  proposals,
  userId,
  userName = '',
  isCoordinator = false,
  accommodations = {},
  onUpdated,
  onDeleted,
  onSubmitted,
  onRejected = () => {},
  onResubmitted = () => {},
  emptyMessage = 'No proposals yet. Create one above.',
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  rejectProposal = _rejectProposal,
  resubmitProposal = _resubmitProposal,
  debounceMs = 300,
}: ProposalsGridProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('DRAFT')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [searchQuery, debounceMs])

  const searchFilteredProposals = useMemo(() => {
    let result = proposals

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
  }, [proposals, debouncedQuery])

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
    if (isSearching) {
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
  }, [proposals, searchFilteredProposals, isSearching])

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
      </div>

      <div style={styles.tabs}>
        {(['DRAFT', 'SUBMITTED', 'REJECTED'] as StatusFilter[]).map(
          (status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              style={
                statusFilter === status ? styles.tabActive : styles.tabInactive
              }
            >
              {status} (
              {isSearching
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
              key={proposal.$id}
              proposal={proposal}
              userId={userId}
              userName={userName}
              isCoordinator={isCoordinator}
              accommodations={accommodations[proposal.$id] || []}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
              onSubmitted={onSubmitted}
              onRejected={onRejected}
              onResubmitted={onResubmitted}
              updateProposal={updateProposal}
              deleteProposal={deleteProposal}
              submitProposal={submitProposal}
              rejectProposal={rejectProposal}
              resubmitProposal={resubmitProposal}
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
    flex: '1 1 280px',
    minWidth: '200px',
    padding: '10px 16px',
    borderRadius: '8px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
    outline: 'none',
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
    background: 'rgba(59,189,232,0.08)',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '13px',
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
    fontSize: '13px',
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
    fontSize: '15px',
    fontStyle: 'italic',
  },
  emptySearch: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '40px',
    textAlign: 'center',
    fontSize: '15px',
  },
} as const
