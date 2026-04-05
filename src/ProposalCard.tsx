import { useState } from 'react'
import {
  deleteProposal as _deleteProposal,
  rejectProposal as _rejectProposal,
  resubmitProposal as _resubmitProposal,
  submitProposal as _submitProposal,
  updateProposal as _updateProposal,
} from './backend'
import EditProposalForm from './EditProposalForm'
import { borders, colors, fonts } from './theme'
import type { Proposal } from './types.d.ts'

interface ProposalCardProps {
  proposal: Proposal
  userId: string
  isCoordinator?: boolean
  previewMode?: boolean
  onUpdated: (proposal: unknown) => void
  onDeleted: (proposalId: string) => void
  onSubmitted: (proposal: unknown) => void
  onRejected?: (proposal: unknown) => void
  onResubmitted?: (proposal: unknown) => void
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

export default function ProposalCard({
  proposal,
  userId,
  isCoordinator = false,
  previewMode = false,
  onUpdated,
  onDeleted,
  onSubmitted,
  onRejected = () => {},
  onResubmitted = () => {},
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  rejectProposal = _rejectProposal,
  resubmitProposal = _resubmitProposal,
}: ProposalCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectError, setRejectError] = useState('')
  const [resubmitting, setResubmitting] = useState(false)
  const [resubmitError, setResubmitError] = useState('')

  const isOwner = userId === proposal.proposerUserId
  const isDraft = proposal.state === 'DRAFT'
  const isRejected = proposal.state === 'REJECTED'
  const canAct = isOwner && isDraft
  const canReject = isCoordinator && proposal.state === 'SUBMITTED'
  const canResubmit = isCoordinator && isRejected

  async function handleSubmit() {
    setSubmitError('')
    setSubmitting(true)
    try {
      const result = await submitProposal(proposal.$id, userId)
      setSubmitting(false)
      onSubmitted(result)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  async function handleReject() {
    setRejectError('')
    setRejecting(true)
    try {
      const result = await rejectProposal(proposal.$id, userId)
      setRejecting(false)
      onRejected(result)
    } catch (err: unknown) {
      setRejectError(err instanceof Error ? err.message : String(err))
      setRejecting(false)
    }
  }

  async function handleResubmit() {
    setResubmitError('')
    setResubmitting(true)
    try {
      const result = await resubmitProposal(proposal.$id, userId)
      setResubmitting(false)
      onResubmitted(result)
    } catch (err: unknown) {
      setResubmitError(err instanceof Error ? err.message : String(err))
      setResubmitting(false)
    }
  }

  async function handleDelete() {
    try {
      await deleteProposal(proposal.$id, userId)
      onDeleted(proposal.$id)
    } catch (_err) {
      // Errors propagate to ErrorBoundary
    }
  }

  if (previewMode) {
    return (
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.resortName}>
              {proposal.resortName || '—'}
              {proposal.accommodationName &&
                ` (at ${proposal.accommodationName})`}
            </h3>
            <div style={styles.subHeader}>
              <span>{proposal.country || '—'}</span>
              <span style={getBadgeStyle(proposal.state)}>
                {proposal.state}
              </span>
            </div>
          </div>
        </div>

        <div style={styles.grid}>
          <Field label="Altitude Range" value={proposal.altitudeRange} />
          <Field label="Nearest Airport" value={proposal.nearestAirport} />
          <Field label="Transfer Time" value={proposal.transferTime} />
          <Field label="Approx. Cost" value={proposal.approximateCost} />
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Accommodation" value={proposal.accommodationName} />
            {proposal.accommodationUrl && (
              <a
                href={proposal.accommodationUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                ↗ link
              </a>
            )}
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Description" value={proposal.description} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Proposed By" value={proposal.proposerUserName} />
          </div>
        </div>
      </div>
    )
  }

  if (isEditing) {
    return (
      <EditProposalForm
        proposal={proposal}
        userId={userId}
        onUpdated={(updated) => {
          onUpdated(updated)
          setIsEditing(false)
        }}
        onCancel={() => setIsEditing(false)}
        updateProposal={updateProposal}
      />
    )
  }

  return (
    <>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.resortName}>
              {proposal.resortName || '—'}
              {proposal.accommodationName &&
                ` (at ${proposal.accommodationName})`}
            </h3>
            <div style={styles.subHeader}>
              <span>{proposal.country || '—'}</span>
              <span style={getBadgeStyle(proposal.state)}>
                {proposal.state}
              </span>
            </div>
          </div>
        </div>

        <div style={styles.grid}>
          <Field label="Altitude Range" value={proposal.altitudeRange} />
          <Field label="Nearest Airport" value={proposal.nearestAirport} />
          <Field label="Transfer Time" value={proposal.transferTime} />
          <Field label="Approx. Cost" value={proposal.approximateCost} />
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Accommodation" value={proposal.accommodationName} />
            {proposal.accommodationUrl && (
              <a
                href={proposal.accommodationUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                ↗ link
              </a>
            )}
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Description" value={proposal.description} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Proposed By" value={proposal.proposerUserName} />
          </div>
        </div>

        <div style={styles.actions}>
          {canAct && (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={styles.editButton}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                style={styles.submitButton}
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                style={styles.deleteButton}
              >
                Delete
              </button>
              {submitError && <p style={styles.errorText}>{submitError}</p>}
            </>
          )}
          {canReject && (
            <>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejecting}
                style={styles.rejectButton}
              >
                {rejecting ? 'Rejecting…' : 'Reject'}
              </button>
              {rejectError && <p style={styles.errorText}>{rejectError}</p>}
            </>
          )}
          {canResubmit && (
            <>
              <button
                type="button"
                onClick={handleResubmit}
                disabled={resubmitting}
                style={styles.resubmitButton}
              >
                {resubmitting ? 'Resubmitting…' : 'Move back to Submitted'}
              </button>
              {resubmitError && <p style={styles.errorText}>{resubmitError}</p>}
            </>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          style={styles.backdrop}
          onClick={() => setShowDeleteConfirm(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowDeleteConfirm(false)
          }}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: stops click propagation from modal card */}
          <div
            role="presentation"
            style={styles.confirmCard}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h4 id="delete-confirm-title" style={styles.confirmTitle}>
              Delete Proposal?
            </h4>
            <p style={styles.confirmText}>
              Are you sure you want to delete "{proposal.resortName}"? This
              cannot be undone.
            </p>
            <div style={styles.confirmActions}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                style={styles.confirmDeleteButton}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{value || '—'}</div>
    </div>
  )
}

function getBadgeStyle(state: Proposal['state']) {
  if (state === 'DRAFT') return styles.badgeDraft
  if (state === 'REJECTED') return styles.badgeRejected
  return styles.badgeSubmitted
}

const styles = {
  card: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '14px',
    padding: '24px',
  },
  header: {
    marginBottom: '20px',
  },
  resortName: {
    fontFamily: fonts.display,
    fontSize: '22px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: '0 0 6px 0',
  },
  subHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontFamily: fonts.body,
    fontSize: '13px',
    color: colors.textSecondary,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px 24px',
    marginBottom: '20px',
  },
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: '10px',
    color: colors.textSecondary,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  fieldValue: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textData,
    lineHeight: '1.5',
  },
  link: {
    color: colors.accent,
    fontSize: '12px',
    textDecoration: 'none',
    marginTop: '4px',
    display: 'inline-block',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
    paddingTop: '16px',
    borderTop: borders.subtle,
  },
  editButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  submitButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: '1px solid rgba(59,189,232,0.3)',
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  deleteButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: '1px solid rgba(255,107,107,0.3)',
    background: 'transparent',
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  rejectButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: '1px solid rgba(255,107,107,0.3)',
    background: 'transparent',
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  resubmitButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: '1px solid rgba(59,189,232,0.3)',
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '11px',
    margin: '4px 0 0',
    whiteSpace: 'normal' as const,
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
    border: '1px solid rgba(106,148,174,0.2)',
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
    border: '1px solid rgba(59,189,232,0.25)',
  },
  badgeRejected: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    color: colors.error,
    background: 'rgba(255,107,107,0.12)',
    border: '1px solid rgba(255,107,107,0.25)',
  },
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(4,12,24,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  confirmCard: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '14px',
    padding: '28px 32px',
    maxWidth: '400px',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  },
  confirmTitle: {
    fontFamily: fonts.display,
    fontSize: '20px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: '0 0 12px 0',
  },
  confirmText: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textSecondary,
    margin: '0 0 24px 0',
    lineHeight: '1.5',
  },
  confirmActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
    cursor: 'pointer',
  },
  confirmDeleteButton: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: 'none',
    background: colors.error,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
} as const
