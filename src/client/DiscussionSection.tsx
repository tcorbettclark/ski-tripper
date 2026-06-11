import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Discussion } from '../shared/types.d'
import {
  createDiscussionComment as _createDiscussionComment,
  deleteDiscussionComment as _deleteDiscussionComment,
  listDiscussion as _listDiscussion,
  updateDiscussionComment as _updateDiscussionComment,
} from './backend'
import { borders, colors, fontSizes, fonts, formStyles, mix } from './theme'
import { formatRelativeTime } from './utils'

interface DiscussionSectionProps {
  proposalId: string
  userId: string
  userName: string
  onCommentsChanged?: () => void
  listDiscussion?: typeof _listDiscussion
  createDiscussionComment?: typeof _createDiscussionComment
  updateDiscussionComment?: typeof _updateDiscussionComment
  deleteDiscussionComment?: typeof _deleteDiscussionComment
}

export default function DiscussionSection({
  proposalId,
  userId,
  userName,
  onCommentsChanged,
  listDiscussion = _listDiscussion,
  createDiscussionComment = _createDiscussionComment,
  updateDiscussionComment = _updateDiscussionComment,
  deleteDiscussionComment = _deleteDiscussionComment,
}: DiscussionSectionProps) {
  const [comments, setComments] = useState<Discussion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newBody, setNewBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editPosting, setEditPosting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    listDiscussion(proposalId)
      .then((result) => setComments(result))
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err))
      )
      .finally(() => setLoading(false))
  }, [proposalId, listDiscussion])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  })

  async function handlePost() {
    if (!newBody.trim()) return
    setPosting(true)
    setPostError(null)
    try {
      const comment = await createDiscussionComment(
        proposalId,
        userId,
        userName,
        newBody.trim()
      )
      setComments((prev) => [...prev, comment])
      setNewBody('')
      onCommentsChanged?.()
    } catch (err) {
      setPostError(err instanceof Error ? err.message : String(err))
    } finally {
      setPosting(false)
    }
  }

  async function handleEditSave() {
    if (!editingId || !editBody.trim()) return
    setEditPosting(true)
    setEditError(null)
    try {
      const updated = await updateDiscussionComment(
        editingId,
        userId,
        editBody.trim()
      )
      setComments((prev) => prev.map((c) => (c.id === editingId ? updated : c)))
      setEditingId(null)
      setEditBody('')
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err))
    } finally {
      setEditPosting(false)
    }
  }

  async function handleDelete() {
    if (!deleteConfirmId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteDiscussionComment(deleteConfirmId, userId)
      setComments((prev) => prev.filter((c) => c.id !== deleteConfirmId))
      setDeleteConfirmId(null)
      onCommentsChanged?.()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={sectionStyles.container}>
      <div ref={listRef} style={sectionStyles.commentList}>
        {loading && <p style={sectionStyles.loading}>Loading…</p>}
        {error && <p style={formStyles.error}>{error}</p>}
        {!loading && !error && comments.length === 0 && (
          <p style={sectionStyles.empty}>No comments yet.</p>
        )}
        {comments.map((comment) => {
          if (comment.type === 'system') {
            return (
              <div key={comment.id} style={sectionStyles.systemMessage}>
                <span style={sectionStyles.systemMessageBody}>
                  {comment.body}
                </span>
                <span style={sectionStyles.systemMessageTimestamp}>
                  {formatRelativeTime(comment.created)}
                </span>
              </div>
            )
          }
          const isOwner = comment.author === userId
          const isEditing = editingId === comment.id
          return (
            <div key={comment.id} style={sectionStyles.commentBubble}>
              <div style={sectionStyles.commentHeader}>
                <span style={sectionStyles.commentAuthor}>
                  {comment.authorUserName || 'Unknown'}
                  {comment.authorUserName === 'AI Assistant' && (
                    <span style={sectionStyles.aiBadge}>AI</span>
                  )}
                </span>
                <span style={sectionStyles.commentTimestamp}>
                  {formatRelativeTime(comment.created)}
                </span>
                {isOwner && !isEditing && (
                  <span style={sectionStyles.commentActions}>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmId(comment.id)
                        setDeleteError(null)
                      }}
                      style={sectionStyles.deleteButton}
                      aria-label="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(comment.id)
                        setEditBody(comment.body)
                        setEditError(null)
                      }}
                      style={sectionStyles.actionButton}
                      aria-label="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                  </span>
                )}
              </div>
              {isEditing ? (
                <div style={sectionStyles.editContainer}>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    style={sectionStyles.editInput}
                    rows={2}
                  />
                  <div style={sectionStyles.editActions}>
                    <button
                      type="button"
                      onClick={handleEditSave}
                      disabled={editPosting}
                      style={sectionStyles.editSaveButton}
                    >
                      {editPosting ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      style={sectionStyles.editCancelButton}
                    >
                      Cancel
                    </button>
                  </div>
                  {editError && <p style={formStyles.error}>{editError}</p>}
                </div>
              ) : (
                <p style={sectionStyles.commentBody}>{comment.body}</p>
              )}
            </div>
          )
        })}
      </div>
      <div style={sectionStyles.inputArea}>
        {postError && <p style={formStyles.error}>{postError}</p>}
        <div style={sectionStyles.inputRow}>
          <input
            type="text"
            placeholder="Write a comment…"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) handlePost()
            }}
            style={sectionStyles.input}
            disabled={posting}
          />
          <button
            type="button"
            onClick={handlePost}
            disabled={posting || !newBody.trim()}
            style={
              posting || !newBody.trim()
                ? sectionStyles.postButtonDisabled
                : sectionStyles.postButton
            }
          >
            Post
          </button>
        </div>
      </div>

      {deleteConfirmId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-comment-title"
          style={sectionStyles.backdrop}
          onClick={() => setDeleteConfirmId(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDeleteConfirmId(null)
          }}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: prevents closing on card click */}
          <div
            role="presentation"
            style={sectionStyles.confirmCard}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h4 id="delete-comment-title" style={sectionStyles.confirmTitle}>
              Delete Comment?
            </h4>
            <p style={sectionStyles.confirmText}>
              Are you sure you want to delete this comment? This cannot be
              undone.
            </p>
            <div style={sectionStyles.confirmActions}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={sectionStyles.cancelButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={sectionStyles.confirmDeleteButton}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
            {deleteError && <p style={formStyles.error}>{deleteError}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

const sectionStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
  },
  commentList: {
    flex: '1 1 auto',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    marginBottom: '12px',
  },
  loading: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    textAlign: 'center' as const,
    margin: '16px 0',
  },
  empty: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    textAlign: 'center' as const,
    fontStyle: 'italic',
    margin: '16px 0',
  },
  systemMessage: {
    textAlign: 'center' as const,
    padding: '8px 0',
  },
  systemMessageBody: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontStyle: 'italic',
  },
  systemMessageTimestamp: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginLeft: '8px',
  },
  commentBubble: {
    background: mix('--color-accent', 0.1),
    border: borders.subtle,
    borderRadius: '10px',
    padding: '12px 14px',
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  commentAuthor: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  aiBadge: {
    display: 'inline-block',
    marginLeft: '6px',
    padding: '1px 5px',
    borderRadius: '3px',
    fontSize: fontSizes.xs,
    fontWeight: '700',
    background: mix('--color-accent', 0.2),
    color: colors.accent,
    letterSpacing: '0.05em',
  },
  commentTimestamp: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  commentActions: {
    display: 'flex',
    gap: '4px',
    marginLeft: 'auto',
  },
  actionButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.textSecondary,
    padding: '0 2px',
    lineHeight: 1,
    opacity: 0.7,
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.error,
    padding: '0 2px',
    lineHeight: 1,
    opacity: 0.7,
  },
  commentBody: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textData,
    margin: 0,
    lineHeight: '1.5',
  },
  editContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  editInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    outline: 'none',
    resize: 'vertical' as const,
  },
  editActions: {
    display: 'flex',
    gap: '8px',
  },
  editSaveButton: {
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
  editCancelButton: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: borders.muted,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    cursor: 'pointer',
  },
  inputArea: {
    borderTop: borders.subtle,
    paddingTop: '14px',
    paddingBottom: '14px',
    flexShrink: 0,
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '7px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    outline: 'none',
  },
  postButton: {
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
    alignSelf: 'center',
  },
  postButtonDisabled: {
    padding: '6px 16px',
    borderRadius: '5px',
    border: `1px solid ${mix('--color-accent', 0.3)}`,
    background: 'transparent',
    color: mix('--color-accent', 0.4),
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '500',
    cursor: 'not-allowed',
    letterSpacing: '0.03em',
    alignSelf: 'center',
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
} as const
