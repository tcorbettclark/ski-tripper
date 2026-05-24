import { useEffect, useState } from 'react'
import {
  deleteProposal as _deleteProposal,
  listDiscussion as _listDiscussion,
  rejectProposal as _rejectProposal,
  revertProposalToDraft as _revertProposalToDraft,
  submitProposal as _submitProposal,
  updateProposal as _updateProposal,
} from './backend'
import { getCountryFlagUrl } from './countries'
import DetailField from './DetailField'
import DiscussionDialog from './DiscussionDialog'
import EditProposalForm from './EditProposalForm'
import { borders, colors, fonts, formStyles } from './theme'
import type { Accommodation, Discussion, Proposal } from './types.d.ts'
import { isValidUrl, sanitizeUrl } from './utils'

const difficultyLabels: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const snowReliabilityLabels: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

interface ProposalCardProps {
  proposal: Proposal
  userId: string
  userName?: string
  isCoordinator?: boolean
  previewMode?: boolean
  accommodations?: Accommodation[]
  onUpdated: (proposal: unknown) => void
  onDeleted: (proposalId: string) => void
  onSubmitted: (proposal: unknown) => void
  onRejected?: (proposal: unknown) => void
  onRevertedToDraft?: (proposal: unknown) => void
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
  listDiscussion?: (proposalId: string) => Promise<Discussion[]>
  onAuthError?: (err: unknown) => void
}

const noopAuthError = () => {}

export default function ProposalCard({
  proposal,
  userId,
  userName = '',
  isCoordinator = false,
  accommodations = [],
  onUpdated,
  onDeleted,
  onSubmitted,
  onRejected = () => {},
  onRevertedToDraft = () => {},
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  rejectProposal = _rejectProposal,
  revertProposalToDraft = _revertProposalToDraft,
  listAccommodations,
  createAccommodation,
  updateAccommodation,
  deleteAccommodation,
  listDiscussion = _listDiscussion,
  onAuthError = noopAuthError,
}: ProposalCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDiscussion, setShowDiscussion] = useState(false)
  const [discussionCount, setDiscussionCount] = useState(0)
  const [latLngHovered, setLatLngHovered] = useState(false)
  const [websiteHovered, setWebsiteHovered] = useState(false)
  const [proposalCollapsed, setProposalCollapsed] = useState(false)
  const [resortCollapsed, setResortCollapsed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [revertError, setRevertError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    listDiscussion(proposal.$id)
      .then((rows) => setDiscussionCount(rows.length))
      .catch(onAuthError)
  }, [proposal.$id, listDiscussion, onAuthError])

  const isOwner = userId === proposal.proposerUserId
  const isDraft = proposal.state === 'DRAFT'
  const isRejected = proposal.state === 'REJECTED'
  const canAct = isOwner && isDraft
  const canReject = isCoordinator && proposal.state === 'SUBMITTED'
  const canRevertToDraft = isCoordinator && isRejected

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await submitProposal(proposal.$id, userId)
      onSubmitted(result)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReject() {
    setRejecting(true)
    setRejectError(null)
    try {
      const result = await rejectProposal(proposal.$id, userId)
      onRejected(result)
    } catch (err) {
      setRejectError(err instanceof Error ? err.message : String(err))
    } finally {
      setRejecting(false)
    }
  }

  async function handleRevertToDraft() {
    setReverting(true)
    setRevertError(null)
    try {
      const result = await revertProposalToDraft(proposal.$id, userId)
      onRevertedToDraft(result)
    } catch (err) {
      setRevertError(err instanceof Error ? err.message : String(err))
    } finally {
      setReverting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteProposal(proposal.$id, userId)
      onDeleted(proposal.$id)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  if (isEditing) {
    return (
      <div style={styles.card}>
        <EditProposalForm
          proposal={proposal}
          userId={userId}
          onUpdated={(updated) => {
            onUpdated(updated)
            setIsEditing(false)
          }}
          onCancel={() => setIsEditing(false)}
          updateProposal={updateProposal}
          listAccommodations={listAccommodations}
          createAccommodation={createAccommodation}
          updateAccommodation={updateAccommodation}
          deleteAccommodation={deleteAccommodation}
        />
      </div>
    )
  }

  return (
    <>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.resortName}>{proposal.resortName || '—'}</h3>
            <div style={styles.subHeader}>
              <span>
                {proposal.country &&
                  getCountryFlagUrl(proposal.country) !== undefined && (
                    <img
                      src={getCountryFlagUrl(proposal.country)}
                      alt={proposal.country}
                      style={styles.flag}
                    />
                  )}
                {proposal.country || '—'}
              </span>
              {proposal.region && (
                <span style={styles.regionLabel}>{proposal.region}</span>
              )}
              <span style={getBadgeStyle(proposal.state)}>
                {proposal.state}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDiscussion(true)}
            style={styles.discussionButton}
            aria-label={`Discussion (${discussionCount} comments)`}
          >
            💬
            {discussionCount > 0 && (
              <span style={styles.discussionBadge}>{discussionCount}</span>
            )}
          </button>
        </div>

        <div style={styles.section}>
          <button
            type="button"
            onClick={() => setProposalCollapsed((c) => !c)}
            style={styles.sectionHeader}
          >
            <span style={styles.sectionTitle}>Proposal</span>
            <span style={styles.collapseIcon}>
              {proposalCollapsed ? '+' : '−'}
            </span>
          </button>
          {!proposalCollapsed && (
            <div style={styles.grid}>
              <DetailField label="Start Date" value={proposal.startDate} />
              <DetailField label="End Date" value={proposal.endDate} />
              <DetailField
                label="Proposed By"
                value={proposal.proposerUserName}
              />
            </div>
          )}
        </div>

        <div style={styles.section}>
          <button
            type="button"
            onClick={() => setResortCollapsed((c) => !c)}
            style={styles.sectionHeader}
          >
            <span style={styles.sectionTitle}>Resort</span>
            <span style={styles.collapseIcon}>
              {resortCollapsed ? '+' : '−'}
            </span>
          </button>
          {!resortCollapsed && (
            <>
              <div style={styles.grid}>
                <DetailField
                  label="Altitude Range"
                  value={`${proposal.bottomAltitude}m – ${proposal.topAltitude}m`}
                />
                <DetailField label="Piste" value={`${proposal.pisteKm} km`} />
                <DetailField
                  label="Difficulty"
                  value={
                    difficultyLabels[proposal.difficulty] ?? proposal.difficulty
                  }
                />
                <DetailField label="Lifts" value={String(proposal.liftCount)} />
                <DetailField
                  label="Snow Reliability"
                  value={
                    snowReliabilityLabels[proposal.snowReliability] ??
                    proposal.snowReliability
                  }
                />
                <DetailField
                  label="Ski Season"
                  value={proposal.skiSeasonMonths}
                />
                <DetailField
                  label="Nearest Airport"
                  value={proposal.nearestAirport}
                />
                <DetailField
                  label="Transfer Time"
                  value={proposal.transferTime}
                />
                <DetailField label="Latitude/longitude">
                  {proposal.latitude || proposal.longitude ? (
                    <a
                      href={`https://www.google.com/maps?q=${proposal.latitude},${proposal.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        ...styles.detailFieldValue,
                        color: colors.accent,
                        textDecoration: latLngHovered ? 'underline' : 'none',
                      }}
                      onMouseEnter={() => setLatLngHovered(true)}
                      onMouseLeave={() => setLatLngHovered(false)}
                    >
                      {proposal.latitude}, {proposal.longitude}
                    </a>
                  ) : (
                    '—'
                  )}
                </DetailField>
                {proposal.websiteUrl && isValidUrl(proposal.websiteUrl) && (
                  <DetailField label="Website">
                    <a
                      href={sanitizeUrl(proposal.websiteUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        ...styles.websiteLinkInline,
                        textDecoration: websiteHovered ? 'underline' : 'none',
                      }}
                      aria-label="Visit website"
                      onMouseEnter={() => setWebsiteHovered(true)}
                      onMouseLeave={() => setWebsiteHovered(false)}
                    >
                      {proposal.websiteUrl.replace(/^https?:\/\//, '')}
                    </a>
                  </DetailField>
                )}
              </div>
              {proposal.description && (
                <div style={styles.descriptionSection}>
                  <DetailField
                    label="Description"
                    value={proposal.description}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {accommodations.length > 0 && (
          <div style={styles.accommodationsSection}>
            <h4 style={styles.accommodationsTitle}>Accommodations</h4>
            {accommodations.map((acc, i) => (
              <div key={acc.$id}>
                {i > 0 && <hr style={styles.accommodationDivider} />}
                <div style={styles.grid}>
                  <DetailField
                    label="Name"
                    value={acc.url ? undefined : acc.name || '—'}
                  >
                    {acc.url && isValidUrl(acc.url) && (
                      <a
                        href={sanitizeUrl(acc.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.accommodationLink}
                      >
                        {acc.name || '—'} ↗
                      </a>
                    )}
                  </DetailField>
                  <DetailField label="Cost" value={acc.cost} />
                  <div style={{ gridColumn: '1/-1' }}>
                    <DetailField label="Description" value={acc.description} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={styles.actions}>
          {canAct && (
            <>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                style={styles.deleteButton}
              >
                Delete
              </button>
              <div style={styles.actionsRight}>
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
                {submitError && <p style={formStyles.error}>{submitError}</p>}
              </div>
            </>
          )}
          {canReject && (
            <button
              type="button"
              onClick={handleReject}
              disabled={rejecting}
              style={styles.rejectButton}
            >
              {rejecting ? 'Rejecting…' : 'Reject'}
            </button>
          )}
          {rejectError && <p style={formStyles.error}>{rejectError}</p>}
          {canRevertToDraft && (
            <button
              type="button"
              onClick={handleRevertToDraft}
              disabled={reverting}
              style={styles.revertButton}
            >
              {reverting ? 'Moving to Draft…' : 'Move back to Draft'}
            </button>
          )}
          {revertError && <p style={formStyles.error}>{revertError}</p>}
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
              Are you sure you want to delete &quot;{proposal.resortName}&quot;?
              This cannot be undone.
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
                disabled={deleting}
                style={styles.confirmDeleteButton}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
            {deleteError && <p style={formStyles.error}>{deleteError}</p>}
          </div>
        </div>
      )}

      {showDiscussion && (
        <DiscussionDialog
          proposalId={proposal.$id}
          proposalResortName={proposal.resortName || '—'}
          userId={userId}
          userName={userName}
          onClose={() => setShowDiscussion(false)}
          listDiscussion={listDiscussion}
        />
      )}
    </>
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
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
  regionLabel: {
    color: colors.textSecondary,
  },
  websiteLinkInline: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.accent,
  },
  detailFieldValue: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textPrimary,
  },
  flag: {
    display: 'inline-block',
    width: '20px',
    height: '14px',
    verticalAlign: 'middle',
    marginRight: '6px',
  },
  section: {
    marginBottom: '20px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '6px',
    width: '100%',
    background: 'none',
    border: 'none',
    borderBottom: borders.subtle,
    paddingBottom: '8px',
    marginBottom: '12px',
    cursor: 'pointer',
    padding: '0 0 8px 0',
  },
  sectionTitle: {
    fontFamily: fonts.body,
    fontSize: '11px',
    fontWeight: '500' as const,
    color: colors.textSecondary,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  collapseIcon: {
    fontFamily: fonts.body,
    fontSize: '13px',
    color: colors.textSecondary,
    lineHeight: 1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  descriptionSection: {
    marginTop: '12px',
  },
  accommodationsSection: {
    marginBottom: '20px',
  },
  accommodationsTitle: {
    fontFamily: fonts.body,
    fontSize: '12px',
    fontWeight: '600' as const,
    color: colors.textSecondary,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginBottom: '12px',
  },
  accommodationLink: {
    color: colors.accent,
    textDecoration: 'none',
  },
  accommodationDivider: {
    border: 'none',
    borderTop: borders.subtle,
    margin: '16px 0',
  },
  actions: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
    flexWrap: 'wrap' as const,
    paddingTop: '16px',
    borderTop: borders.subtle,
  },
  actionsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
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
  revertButton: {
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
  discussionButton: {
    position: 'relative' as const,
    background: 'none',
    border: borders.muted,
    borderRadius: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    color: colors.textSecondary,
  },
  discussionBadge: {
    position: 'absolute' as const,
    top: '-4px',
    right: '-4px',
    background: colors.accent,
    color: colors.bgPrimary,
    fontSize: '10px',
    fontWeight: '700',
    minWidth: '16px',
    height: '16px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
} as const
