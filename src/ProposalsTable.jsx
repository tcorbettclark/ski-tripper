import { useState } from 'react'
import ProposalsRow from './ProposalsRow'
import ProposalViewer from './ProposalViewer'
import {
  updateProposal as _updateProposal,
  deleteProposal as _deleteProposal,
  submitProposal as _submitProposal,
  getUserById as _getUserById
} from './backend'
import { colors, fonts, borders } from './theme'

export default function ProposalsTable ({
  proposals,
  userId,
  onUpdated,
  onDeleted,
  onSubmitted,
  emptyMessage = 'No proposals yet. Create one above.',
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  getUserById = _getUserById
}) {
  const [viewingIndex, setViewingIndex] = useState(null)

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
              onUpdated={onUpdated}
              onDeleted={onDeleted}
              onSubmitted={onSubmitted}
              onView={() => setViewingIndex(index)}
              updateProposal={updateProposal}
              deleteProposal={deleteProposal}
              submitProposal={submitProposal}
              getUserById={getUserById}
            />
          ))}
        </tbody>
      </table>
      {viewingIndex !== null && (
        <ProposalViewer
          proposals={proposals}
          initialIndex={viewingIndex}
          onClose={() => setViewingIndex(null)}
          getUserById={getUserById}
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
    fontStyle: 'italic'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: fonts.body,
    fontSize: '14px'
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
    textTransform: 'uppercase'
  }
}
