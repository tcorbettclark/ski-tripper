import { useState, useEffect } from 'react'
import EditProposalForm from './EditProposalForm'
import {
  updateProposal as _updateProposal,
  deleteProposal as _deleteProposal,
  submitProposal as _submitProposal,
  getUserById as _getUserById
} from './backend'
import { colors, fonts, borders } from './theme'

export default function ProposalsRow ({
  proposal,
  userId,
  onUpdated,
  onDeleted,
  onSubmitted,
  onView = () => {},
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  getUserById = _getUserById
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [creator, setCreator] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (proposal.userId) {
      getUserById(proposal.userId)
        .then(setCreator)
        .catch(() => {})
    }
  }, [proposal.userId])

  const isOwner = userId === proposal.userId
  const isDraft = proposal.state === 'DRAFT'
  const canAct = isOwner && isDraft

  async function handleSubmit () {
    setSubmitError('')
    setSubmitting(true)
    try {
      const result = await submitProposal(proposal.$id, userId)
      setSubmitting(false)
      onSubmitted(result)
    } catch (err) {
      setSubmitError(err.message)
      setSubmitting(false)
    }
  }

  if (isEditing) {
    return (
      <tr style={styles.editingTr}>
        <td style={styles.editingTd} colSpan={5}>
          <EditProposalForm
            proposal={proposal}
            userId={userId}
            onUpdated={(updated) => {
              onUpdated(updated)
              setIsEditing(false)
            }}
            onDeleted={() => { setIsEditing(false); onDeleted(proposal.$id) }}
            onCancel={() => setIsEditing(false)}
            updateProposal={updateProposal}
            deleteProposal={deleteProposal}
          />
        </td>
      </tr>
    )
  }

  return (
    <tr style={styles.tr}>
      <td style={styles.td}>{proposal.resortName || '—'}</td>
      <td style={{ ...styles.td, color: colors.textSecondary }}>{proposal.country || '—'}</td>
      <td style={{ ...styles.td, color: colors.textSecondary }} title={creator?.email || undefined}>
        {creator?.name || creator?.email || '—'}
      </td>
      <td style={styles.td}>
        <span style={isDraft ? styles.badgeDraft : styles.badgeSubmitted}>
          {proposal.state}
        </span>
      </td>
      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
        <div style={styles.actions}>
          <button onClick={onView} style={styles.viewButton}>
            View
          </button>
          {canAct && (
            <>
              <button onClick={() => setIsEditing(true)} style={styles.editButton}>
                Edit
              </button>
              <button onClick={handleSubmit} disabled={submitting} style={styles.submitButton}>
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
              {submitError && <p style={styles.errorText}>{submitError}</p>}
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

const styles = {
  tr: {
    borderBottom: '1px solid rgba(100,190,230,0.07)'
  },
  td: {
    padding: '14px 16px',
    color: colors.textData,
    verticalAlign: 'top',
    fontFamily: fonts.body,
    fontSize: '14px',
    lineHeight: '1.5'
  },
  editingTr: {
    borderBottom: '1px solid rgba(59,189,232,0.2)',
    borderTop: '1px solid rgba(59,189,232,0.2)',
    background: 'rgba(59,189,232,0.04)'
  },
  editingTd: {
    padding: '20px 24px',
    verticalAlign: 'top',
    borderLeft: `2px solid ${colors.accent}`
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  viewButton: {
    padding: '5px 16px',
    borderRadius: '5px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em'
  },
  editButton: {
    padding: '5px 16px',
    borderRadius: '5px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em'
  },
  submitButton: {
    padding: '5px 16px',
    borderRadius: '5px',
    border: '1px solid rgba(59,189,232,0.3)',
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em'
  },
  badgeDraft: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    color: colors.textSecondary,
    background: 'rgba(106,148,174,0.15)',
    border: '1px solid rgba(106,148,174,0.2)'
  },
  badgeSubmitted: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    color: colors.accent,
    background: 'rgba(59,189,232,0.12)',
    border: '1px solid rgba(59,189,232,0.25)'
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '11px',
    margin: '4px 0 0',
    whiteSpace: 'normal'
  }
}
