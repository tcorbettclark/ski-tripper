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
import type { Proposal } from './types.d.ts'

type StatusFilter = 'all' | 'DRAFT' | 'SUBMITTED' | 'REJECTED'

interface ProposalsGridProps {
  proposals: Proposal[]
  userId: string
  isCoordinator?: boolean
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
}

export default function ProposalsGrid({
  proposals,
  userId,
  isCoordinator = false,
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
}: ProposalsGridProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const filteredProposals = useMemo(() => {
    let result = proposals

    result = [...result].sort((a, b) =>
      (a.resortName || '')
        .toLowerCase()
        .localeCompare((b.resortName || '').toLowerCase())
    )

    if (debouncedQuery) {
      const query = debouncedQuery.toLowerCase().trim()
      result = result.filter(
        (p) =>
          p.resortName?.toLowerCase().includes(query) ||
          p.country?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.proposerUserName?.toLowerCase().includes(query) ||
          p.nearestAirport?.toLowerCase().includes(query) ||
          p.accommodationName?.toLowerCase().includes(query)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.state === statusFilter)
    }

    return result
  }, [proposals, debouncedQuery, statusFilter])

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
        <div style={styles.filterGroup}>
          {(['all', 'DRAFT', 'SUBMITTED', 'REJECTED'] as StatusFilter[]).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                style={
                  statusFilter === status
                    ? styles.filterButtonActive
                    : styles.filterButtonInactive
                }
              >
                {status === 'all' ? 'All' : status}
              </button>
            )
          )}
        </div>
      </div>

      {filteredProposals.length === 0 ? (
        <p style={styles.emptySearch}>
          No proposals match your search. Try different criteria.
        </p>
      ) : (
        <div style={styles.grid}>
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.$id}
              proposal={proposal}
              userId={userId}
              isCoordinator={isCoordinator}
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
  filterGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  filterButtonActive: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    background: 'rgba(59,189,232,0.12)',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  filterButtonInactive: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px 24px',
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
