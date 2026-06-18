import { MapPin, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getCountryFlagUrl } from '../shared/countries'
import type { Accommodation, Discussion, Proposal } from '../shared/types.d'
import AnalysisPopup from './AnalysisPopup'
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
import DetailField from './DetailField'
import DiscussionSection from './DiscussionSection'
import EditProposalForm from './EditProposalForm'
import Paragraphs from './Paragraphs'
import PisteBreakdown from './PisteBreakdown'
import {
  borders,
  colors,
  detailStyles,
  fontSizes,
  fonts,
  formStyles,
  mix,
} from './theme'
import {
  ensureUrlScheme,
  formatDate,
  formatTransferTime,
  getErrorMessage,
  isValidUrl,
  sanitizeUrl,
} from './utils'

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
  initialTab?: 'proposal' | 'accommodations' | 'discussion'
  accommodations?: Accommodation[]
  onUpdated: (proposal: unknown) => void
  onDeleted: (proposalId: string) => void
  onSubmitted: (proposal: unknown) => void
  onRejected?: (proposal: unknown) => void
  onRevertedToDraft?: (proposal: unknown) => void
  onAccommodationsChanged?: (proposalId: string) => void
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
  previewMode = false,
  initialTab,
  accommodations = [],
  onUpdated,
  onDeleted,
  onSubmitted,
  onRejected = () => {},
  onRevertedToDraft = () => {},
  onAccommodationsChanged,
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
  onAuthError = noopAuthError,
}: ProposalCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState<
    'proposal' | 'accommodations' | 'discussion'
  >(initialTab ?? 'proposal')
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [initialTab])
  const [discussionCount, setDiscussionCount] = useState(0)
  const [hoveredWebsite, setHoveredWebsite] = useState<string | null>(null)
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [revertError, setRevertError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editingAccommodationId, setEditingAccommodationId] = useState<
    string | null
  >(null)
  const [addingAccommodation, setAddingAccommodation] = useState(false)
  const [accommodationError, setAccommodationError] = useState<string | null>(
    null
  )
  const [deletingAccommodationId, setDeletingAccommodationId] = useState<
    string | null
  >(null)
  const [confirmDeleteAccommodationId, setConfirmDeleteAccommodationId] =
    useState<string | null>(null)
  const [deletingAccommodationError, setDeletingAccommodationError] = useState<
    string | null
  >(null)

  useEffect(() => {
    listDiscussion(proposal.id)
      .then((rows) => setDiscussionCount(rows.length))
      .catch(onAuthError)
  }, [proposal.id, listDiscussion, onAuthError])

  const isOwner = userId === proposal.proposer
  const isDraft = proposal.state === 'DRAFT'
  const isRejected = proposal.state === 'REJECTED'
  const canAct = isOwner && isDraft
  const isAccommodationEditing =
    addingAccommodation || editingAccommodationId !== null
  const canReject = isCoordinator && proposal.state === 'SUBMITTED'
  const canRevertToDraft = isCoordinator && isRejected

  const hasActions =
    canAct || canReject || canRevertToDraft || !!rejectError || !!revertError

  function initiateSubmit() {
    setSubmitError(null)
    if (accommodations.length === 0) {
      setShowSubmitConfirm(true)
      return
    }
    handleSubmit()
  }

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await submitProposal(proposal.id, userId)
      onSubmitted(result)
    } catch (err) {
      setSubmitError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReject() {
    setRejecting(true)
    setRejectError(null)
    try {
      const result = await rejectProposal(proposal.id, userId)
      onRejected(result)
    } catch (err) {
      setRejectError(getErrorMessage(err))
    } finally {
      setRejecting(false)
    }
  }

  async function handleRevertToDraft() {
    setReverting(true)
    setRevertError(null)
    try {
      const result = await revertProposalToDraft(proposal.id, userId)
      onRevertedToDraft(result)
    } catch (err) {
      setRevertError(getErrorMessage(err))
    } finally {
      setReverting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteProposal(proposal.id, userId)
      onDeleted(proposal.id)
    } catch (err) {
      setDeleteError(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  function handleAccommodationsChanged() {
    onAccommodationsChanged?.(proposal.id)
    listAccommodations(proposal.id).catch(onAuthError)
  }

  async function handleAddAccommodation(data: {
    name: string
    url?: string
    cost?: string
    description?: string
  }) {
    setAccommodationError(null)
    try {
      await createAccommodation(proposal.id, userId, data)
      setAddingAccommodation(false)
      handleAccommodationsChanged()
    } catch (err) {
      setAccommodationError(getErrorMessage(err))
    }
  }

  async function handleEditAccommodation(
    accommodationId: string,
    data: { name?: string; url?: string; cost?: string; description?: string }
  ) {
    setAccommodationError(null)
    try {
      await updateAccommodation(accommodationId, userId, data)
      setEditingAccommodationId(null)
      handleAccommodationsChanged()
    } catch (err) {
      setAccommodationError(getErrorMessage(err))
    }
  }

  async function handleDeleteAccommodation(accommodationId: string) {
    setDeletingAccommodationId(accommodationId)
    setDeletingAccommodationError(null)
    try {
      await deleteAccommodation(accommodationId, userId)
      setDeletingAccommodationId(null)
      setConfirmDeleteAccommodationId(null)
      handleAccommodationsChanged()
    } catch (err) {
      setDeletingAccommodationId(null)
      setDeletingAccommodationError(getErrorMessage(err))
    }
  }

  return (
    <>
      <div ref={cardRef} style={previewMode ? styles.previewCard : styles.card}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={detailStyles.title}>
              {(() => {
                const flagUrl =
                  proposal.country && getCountryFlagUrl(proposal.country)
                return flagUrl ? (
                  <img
                    src={flagUrl}
                    alt={proposal.country}
                    style={styles.flag}
                  />
                ) : null
              })()}

              {proposal.resortName || '—'}
              {proposal.country
                ? ` in ${proposal.region ? `${proposal.region}, ` : ''}${proposal.country}`
                : proposal.region
                  ? ` in ${proposal.region}`
                  : ''}
              {proposal.latitude && proposal.longitude && (
                <a
                  href={`https://www.google.com/maps?q=${proposal.latitude},${proposal.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.mapPinLink}
                  aria-label="Open in Google Maps"
                >
                  <MapPin size={16} />
                </a>
              )}
            </span>
            {proposal.proposerUserName && (
              <span style={styles.proposerLabel}>
                {proposal.state === 'DRAFT'
                  ? `Being drafted by ${proposal.proposerUserName}`
                  : `Proposed by ${proposal.proposerUserName}`}
              </span>
            )}
          </div>
          {!previewMode && (
            <button
              type="button"
              onClick={() => setShowAnalysisPopup(true)}
              style={styles.aiButton}
              aria-label="AI Analysis"
            >
              <Sparkles size={16} />
            </button>
          )}
        </div>

        {!previewMode && (
          <div style={styles.tabs}>
            <button
              type="button"
              onClick={() => setActiveTab('proposal')}
              style={
                activeTab === 'proposal' ? styles.tabActive : styles.tabInactive
              }
            >
              Proposal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('accommodations')}
              style={
                activeTab === 'accommodations'
                  ? styles.tabActive
                  : styles.tabInactive
              }
            >
              Accommodations {`(${accommodations.length})`}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('discussion')}
              style={
                activeTab === 'discussion'
                  ? styles.tabActive
                  : styles.tabInactive
              }
            >
              Discussion {discussionCount > 0 && `(${discussionCount})`}
            </button>
          </div>
        )}

        <div style={previewMode ? undefined : styles.tabContent}>
          <div style={styles.section}>
            {(previewMode || activeTab === 'proposal') && (
              <>
                <div style={styles.grid}>
                  <DetailField
                    label="Start Date"
                    value={formatDate(proposal.startDate)}
                  />
                  <DetailField
                    label="End Date"
                    value={formatDate(proposal.endDate)}
                  />
                  <DetailField
                    label="Altitude Range"
                    value={`${proposal.baseAltitude}m – ${proposal.summitAltitude}m`}
                  />
                  <DetailField label="Piste" value={`${proposal.pisteKm} km`} />
                  <DetailField label="Piste Breakdown">
                    <PisteBreakdown
                      beginnerPct={proposal.beginnerPct}
                      intermediatePct={proposal.intermediatePct}
                      advancedPct={proposal.advancedPct}
                    />
                  </DetailField>
                  <DetailField
                    label="Lifts"
                    value={String(proposal.liftCount)}
                  />
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
                    value={formatTransferTime(proposal.transferTime)}
                  />
                  {proposal.websites && proposal.websites.length > 0 && (
                    <DetailField
                      label="Websites"
                      style={{ gridColumn: 'span 2' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        {proposal.websites.map((url) => (
                          <a
                            key={url}
                            href={sanitizeUrl(ensureUrlScheme(url))}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              ...detailStyles.websiteLink,
                              textDecoration:
                                hoveredWebsite === url ? 'underline' : 'none',
                            }}
                            onMouseEnter={() => setHoveredWebsite(url)}
                            onMouseLeave={() => setHoveredWebsite(null)}
                          >
                            {ensureUrlScheme(url).replace(/^https?:\/\//, '')}
                          </a>
                        ))}
                      </div>
                    </DetailField>
                  )}
                </div>
                {proposal.linkedResortsDescription && (
                  <div style={styles.descriptionSection}>
                    <DetailField label="Linked Resorts">
                      <Paragraphs
                        text={proposal.linkedResortsDescription}
                        style={detailStyles.descriptionText}
                      />
                    </DetailField>
                  </div>
                )}
                {proposal.description && (
                  <DetailField label="Description">
                    <Paragraphs
                      text={proposal.description}
                      style={detailStyles.descriptionText}
                    />
                  </DetailField>
                )}
                {canAct && (
                  <div style={styles.editButtonRow}>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      style={styles.accommodationEditButton}
                      aria-label="Edit proposal"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {!previewMode && activeTab === 'accommodations' && (
            <div style={styles.accommodationsSection}>
              {accommodations.length === 0 && !addingAccommodation && (
                <p style={styles.noAccommodations}>No accommodations yet.</p>
              )}
              {accommodations.map((acc) =>
                editingAccommodationId === acc.id ? (
                  <AccommodationEditForm
                    key={acc.id}
                    initialData={{
                      name: acc.name,
                      url: acc.url,
                      cost: acc.cost,
                      description: acc.description,
                    }}
                    onSave={(data) => handleEditAccommodation(acc.id, data)}
                    onCancel={() => {
                      setEditingAccommodationId(null)
                      setAccommodationError(null)
                    }}
                    error={accommodationError}
                  />
                ) : (
                  <div key={acc.id}>
                    <div style={styles.accommodationItem}>
                      <div style={styles.accommodationItemContent}>
                        <div style={styles.grid}>
                          <DetailField
                            label="Name"
                            value={
                              acc.url && isValidUrl(acc.url)
                                ? undefined
                                : acc.name || '—'
                            }
                          >
                            {acc.url && isValidUrl(acc.url) && (
                              <a
                                href={sanitizeUrl(acc.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={styles.accommodationLink}
                              >
                                {acc.name || '—'}
                              </a>
                            )}
                          </DetailField>
                          <DetailField label="Cost" value={acc.cost} />
                          <div style={{ gridColumn: '1/-1', maxWidth: '75%' }}>
                            <DetailField
                              label="Description"
                              value={acc.description}
                            />
                          </div>
                        </div>
                      </div>
                      {canAct && (
                        <div style={styles.accommodationItemActions}>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteAccommodationId(acc.id)
                            }
                            style={styles.accommodationDeleteButton}
                            aria-label={`Delete accommodation ${acc.name}`}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAccommodationId(acc.id)
                              setAccommodationError(null)
                            }}
                            style={styles.accommodationEditButton}
                            aria-label={`Edit accommodation ${acc.name}`}
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                    <hr style={styles.accommodationDivider} />
                  </div>
                )
              )}
              {addingAccommodation && (
                <AccommodationEditForm
                  onSave={handleAddAccommodation}
                  onCancel={() => {
                    setAddingAccommodation(false)
                    setAccommodationError(null)
                  }}
                  error={accommodationError}
                />
              )}
              {canAct && !addingAccommodation && accommodations.length < 5 && (
                <button
                  type="button"
                  onClick={() => {
                    setAddingAccommodation(true)
                    setAccommodationError(null)
                  }}
                  style={styles.addAccommodationButton}
                >
                  + Add Accommodation
                </button>
              )}
            </div>
          )}

          {!previewMode && activeTab === 'discussion' && (
            <DiscussionSection
              proposalId={proposal.id}
              userId={userId}
              userName={userName}
              listDiscussion={listDiscussion}
              onCommentsChanged={() => {
                listDiscussion(proposal.id)
                  .then((rows) => setDiscussionCount(rows.length))
                  .catch(onAuthError)
              }}
            />
          )}
        </div>

        {!previewMode && hasActions && (
          <div style={styles.actions}>
            {canAct && (
              <>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isAccommodationEditing}
                  style={{
                    ...styles.deleteButton,
                    ...(isAccommodationEditing ? styles.buttonDisabled : {}),
                  }}
                >
                  Delete
                </button>
                <div style={styles.actionsRight}>
                  <button
                    type="button"
                    onClick={initiateSubmit}
                    disabled={submitting || isAccommodationEditing}
                    style={{
                      ...styles.submitButton,
                      ...(submitting || isAccommodationEditing
                        ? styles.buttonDisabled
                        : {}),
                    }}
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
        )}
      </div>

      {showAnalysisPopup && (
        <AnalysisPopup
          proposalId={proposal.id}
          tripId={proposal.trip}
          onClose={() => setShowAnalysisPopup(false)}
        />
      )}

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

      {showSubmitConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-confirm-title"
          style={styles.backdrop}
          onClick={() => setShowSubmitConfirm(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowSubmitConfirm(false)
          }}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: stops click propagation from modal card */}
          <div
            role="presentation"
            style={styles.confirmCard}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h4 id="submit-confirm-title" style={styles.confirmTitle}>
              No Accommodations
            </h4>
            <p style={styles.confirmText}>
              At least one accommodation is required to submit a proposal.
              Please add an accommodation before submitting.
            </p>
            <div style={styles.confirmActions}>
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                style={styles.cancelButton}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit proposal"
          style={styles.backdrop}
          onClick={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsEditing(false)
          }}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: stops click propagation from modal card */}
          <div
            role="presentation"
            style={styles.editDialog}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
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
          </div>
        </div>
      )}

      {confirmDeleteAccommodationId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-acc-confirm-title"
          style={styles.backdrop}
          onClick={() => setConfirmDeleteAccommodationId(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConfirmDeleteAccommodationId(null)
          }}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: stops click propagation from modal card */}
          <div
            role="presentation"
            style={styles.confirmCard}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h4 id="delete-acc-confirm-title" style={styles.confirmTitle}>
              Delete Accommodation?
            </h4>
            <p style={styles.confirmText}>
              Are you sure you want to delete this accommodation? This cannot be
              undone.
            </p>
            <div style={styles.confirmActions}>
              <button
                type="button"
                onClick={() => setConfirmDeleteAccommodationId(null)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDeleteAccommodation(confirmDeleteAccommodationId!)
                }
                disabled={
                  deletingAccommodationId === confirmDeleteAccommodationId
                }
                style={styles.confirmDeleteButton}
              >
                {deletingAccommodationId === confirmDeleteAccommodationId
                  ? 'Deleting…'
                  : 'Delete'}
              </button>
            </div>
            {deletingAccommodationError && (
              <p style={formStyles.error}>{deletingAccommodationError}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function AccommodationEditForm({
  initialData,
  onSave,
  onCancel,
  error,
}: {
  initialData?: { name: string; url: string; cost: string; description: string }
  onSave: (data: {
    name: string
    url?: string
    cost?: string
    description?: string
  }) => void
  onCancel: () => void
  error: string | null
}) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [url, setUrl] = useState(initialData?.url ?? '')
  const [cost, setCost] = useState(initialData?.cost ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        name,
        url: url ? ensureUrlScheme(url) : undefined,
        cost: cost || undefined,
        description: description || undefined,
      })
    } catch {
      // onSave handles its own errors
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={accFormStyles.form}>
      <div style={accFormStyles.grid}>
        <div style={accFormStyles.field}>
          <label htmlFor="acc-name" style={accFormStyles.label}>
            Name
          </label>
          <input
            id="acc-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={accFormStyles.input}
            placeholder="e.g. Hotel Mont Blanc"
          />
        </div>
        <div style={accFormStyles.field}>
          <label htmlFor="acc-url" style={accFormStyles.label}>
            URL
          </label>
          <input
            id="acc-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={accFormStyles.input}
            placeholder="e.g. example.com/hotel"
          />
        </div>
        <div style={accFormStyles.field}>
          <label htmlFor="acc-cost" style={accFormStyles.label}>
            Cost
          </label>
          <input
            id="acc-cost"
            type="text"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            style={accFormStyles.input}
            placeholder="e.g. €150/night"
          />
        </div>
        <div
          style={{
            ...accFormStyles.field,
            gridColumn: '1/-1',
            maxWidth: '75%',
          }}
        >
          <label htmlFor="acc-desc" style={accFormStyles.label}>
            Description
          </label>
          <textarea
            id="acc-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={accFormStyles.textarea}
            placeholder="Notes about the accommodation"
          />
        </div>
      </div>
      {error && <p style={formStyles.error}>{error}</p>}
      <div style={accFormStyles.actions}>
        <div style={accFormStyles.actionsRight}>
          <button
            type="submit"
            disabled={saving}
            style={accFormStyles.saveButton}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={accFormStyles.cancelButton}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}

const styles = {
  card: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '14px',
    padding: '24px',
    height: '80vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 2px 12px var(--color-shadow)',
  },
  previewCard: {
    background: colors.bgCard,
    padding: '0',
  },
  header: {
    marginBottom: '0',
    paddingBottom: '20px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
  },
  proposerLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic' as const,
  },
  aiButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: `1px solid ${mix('--color-accent', 0.3)}`,
    borderRadius: '6px',
    color: colors.accent,
    cursor: 'pointer',
    padding: '6px',
    lineHeight: 1,
    flexShrink: 0,
  },
  mapPinLink: {
    display: 'inline-flex',
    alignItems: 'center',
    color: colors.accent,
    textDecoration: 'none',
    marginLeft: '4px',
    verticalAlign: 'middle',
  },
  descriptionSection: {
    marginTop: '18px',
    marginBottom: '8px',
  },
  flag: {
    display: 'inline-block',
    width: '20px',
    height: '14px',
  },
  section: {
    borderTop: borders.subtle,
    paddingTop: '10px',
    marginBottom: '10px',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '0',
    borderBottom: borders.subtle,
    paddingBottom: '0',
    flexShrink: 0,
  },
  tabContent: {
    overflowY: 'auto' as const,
    flex: '1 1 auto',
    minHeight: 0,
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
    fontWeight: '600' as const,
    cursor: 'pointer',
  },
  tabInactive: {
    padding: '10px 20px',
    borderRadius: '8px 8px 0 0',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500' as const,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '18px',
  },
  accommodationsSection: {
    paddingTop: '10px',
    marginBottom: '10px',
  },
  noAccommodations: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    margin: '16px 0',
  },
  accommodationItem: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginTop: '18px',
  },
  editButtonRow: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '8px',
  },
  accommodationItemContent: {
    flex: 1,
    minWidth: 0,
  },
  accommodationItemActions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
    alignSelf: 'flex-end',
  },
  accommodationEditButton: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  accommodationDeleteButton: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: `1px solid ${mix('--color-error', 0.3)}`,
    background: 'transparent',
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  addAccommodationButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: `1px solid ${mix('--color-accent', 0.3)}`,
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em',
    width: '100%',
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
    padding: '10px 0',
    borderTop: borders.subtle,
    flexShrink: 0,
  },
  actionsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  submitButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  deleteButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: `1px solid ${mix('--color-error', 0.3)}`,
    background: 'transparent',
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  rejectButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: `1px solid ${mix('--color-error', 0.3)}`,
    background: 'transparent',
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  revertButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: `1px solid ${mix('--color-accent', 0.3)}`,
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500',
    cursor: 'pointer',
    letterSpacing: '0.03em',
    marginLeft: 'auto',
  },
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'var(--color-overlay)',
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
    boxShadow: '0 24px 80px var(--color-shadow)',
  },
  confirmTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    margin: '0 0 12px 0',
  },
  confirmText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
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
    fontSize: fontSizes.sm,
    cursor: 'pointer',
  },
  confirmDeleteButton: {
    padding: '8px 20px',
    borderRadius: '6px',
    border: 'none',
    background: colors.error,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    cursor: 'pointer',
  },
  editDialog: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '14px',
    padding: '24px',
    maxHeight: '85vh',
    overflowY: 'auto',
    width: '90vw',
    maxWidth: '600px',
    boxShadow: '0 24px 80px var(--color-shadow)',
  },
  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed' as const,
  },
} as const

const accFormStyles = {
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    padding: '14px',
    background: colors.bgInput,
    borderRadius: '8px',
    border: borders.card,
    marginBottom: '12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  input: {
    height: '36px',
    padding: '8px 12px',
    borderRadius: '6px',
    border: borders.card,
    background: colors.bgCard,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    outline: 'none' as const,
  },
  textarea: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: borders.card,
    background: colors.bgCard,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    outline: 'none' as const,
    resize: 'vertical' as const,
    minHeight: '60px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsRight: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  saveButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    cursor: 'pointer',
  },
  cancelButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500',
    cursor: 'pointer',
  },
} as const
