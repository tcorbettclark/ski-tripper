import { useState } from 'react'
import ProposalsRow from './ProposalsRow'
import ProposalViewer from './ProposalViewer'
import {
  updateProposal as _updateProposal,
  deleteProposal as _deleteProposal,
  submitProposal as _submitProposal,
  rejectProposal as _rejectProposal,
} from './backend'
import { colors, fonts, borders } from './theme'

interface Proposal {
  $id: string
  tripId?: string
  resortName?: string
  country?: string
  ProposerUserId: string
  ProposerUserName?: string
  state: 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED'
  title?: string
  description?: string
}

interface ProposalsTableProps {
  proposals: Proposal[]
  userId: string
  isCoordinator?: boolean
  onUpdated: (proposal: unknown) => void
  onDeleted: (proposalId: string) => void
  onSubmitted: (proposal: unknown) => void
  onRejected?: (proposal: unknown) => void
  emptyMessage?: string
  updateProposal?: (
    proposalId: string,
    userId: string,
    data: Partial<Proposal>
  ) => Promise<unknown>
  deleteProposal?: (proposalId: string, userId: string) => Promise<void>
  submitProposal?: (proposalId: string, userId: string) => Promise<unknown>
  rejectProposal?: (proposalId: string, userId: string) => Promise<unknown>
}

export default function ProposalsTable({
  proposals,
  userId,
  isCoordinator = false,
  onUpdated,
  onDeleted,
  onSubmitted,
  onRejected = () => {},
  emptyMessage = 'No proposals yet. Create one above.',
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  rejectProposal = _rejectProposal,
}: ProposalsTableProps) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null)

  if (proposals.length === 0) {
    return <p style={styles.empty}>{emptyMessage}</p>
  }

  return (
    <>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Resort Name</th>
            <th style={styles.th}>Country</th>
            <th style={styles.th}>Creator</th>
            <th style={styles.th}>Status</th>
            <th style={{ ...styles.th, minWidth: '160px' }} />
          </tr>
        </thead>
        <tbody>
          {proposals.map((proposal, index) => (
            <ProposalsRow
              key={proposal.$id}
              proposal={proposal}
              userId={userId}
              isCoordinator={isCoordinator}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
              onSubmitted={onSubmitted}
              onRejected={onRejected}
              onView={() => setViewingIndex(index)}
              updateProposal={updateProposal}
              deleteProposal={deleteProposal}
              submitProposal={submitProposal}
              rejectProposal={rejectProposal}
            />
          ))}
        </tbody>
      </table>
      {viewingIndex !== null && (
        <ProposalViewer
          proposals={proposals}
          initialIndex={viewingIndex}
          onClose={() => setViewingIndex(null)}
        />
      )}
    </>
  )
}

const styles = {
  empty: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    padding: '60px 40px',
    textAlign: 'center',
    fontSize: '15px',
    fontStyle: 'italic',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: fonts.body,
    fontSize: '14px',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    background: colors.bgCard,
    borderBottom: borders.subtle,
    fontFamily: fonts.body,
    fontSize: '11px',
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
} as const
