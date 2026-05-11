import { useEffect, useRef, useState } from 'react'
import {
  createDiscussionComment as _createDiscussionComment,
  deleteDiscussionComment as _deleteDiscussionComment,
  listDiscussion as _listDiscussion,
  updateDiscussionComment as _updateDiscussionComment,
} from './backend'
import { borders, colors, fonts, formStyles } from './theme'
import type { Discussion } from './types.d'

interface DiscussionDialogProps {
  proposalId: string
  proposalResortName: string
  userId: string
  userName: string
  onClose: () => void
  listDiscussion?: typeof _listDiscussion
  createDiscussionComment?: typeof _createDiscussionComment
  updateDiscussionComment?: typeof _updateDiscussionComment
  deleteDiscussionComment?: typeof _deleteDiscussionComment
}

export default function DiscussionDialog({
  proposalId,
  proposalResortName,
  userId,
  userName,
  onClose,
  listDiscussion = _listDiscussion,
  createDiscussionComment = _createDiscussionComment,
  updateDiscussionComment = _updateDiscussionComment,
  deleteDiscussionComment = _deleteDiscussionComment,
}: DiscussionDialogProps) {
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
      setComments((prev) =>
        prev.map((c) => (c.$id === editingId ? updated : c))
      )
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
      setComments((prev) => prev.filter((c) => c.$id !== deleteConfirmId))
      setDeleteConfirmId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Discussion for ${proposalResortName}`}
      style={styles.backdrop}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: prevents closing on dialog content click */}
      <div
        role="presentation"
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div style={styles.header}>
          <h3 style={styles.title}>Discussion — {proposalResortName}</h3>
          <button type="button" onClick={onClose} style={styles.closeButton}>
            ✕
          </button>
        </div>

        <div ref={listRef} style={styles.commentList}>
          {loading && <p style={styles.loading}>Loading…</p>}
          {error && <p style={formStyles.error}>{error}</p>}
          {!loading && !error && comments.length === 0 && (
            <p style={styles.empty}>No comments yet.</p>
          )}
          {comments.map((comment) => {
            if (comment.type === 'system') {
              return (
                <div key={comment.$id} style={styles.systemMessage}>
                  {comment.body}
                </div>
              )
            }
            const isOwner = comment.authorUserId === userId
            const isEditing = editingId === comment.$id
            return (
              <div key={comment.$id} style={styles.commentBubble}>
                <div style={styles.commentHeader}>
                  <span style={styles.commentAuthor}>
                    {comment.authorUserName || 'Unknown'}
                    {comment.authorUserName === 'AI Assistant' && (
                      <span style={styles.aiBadge}>AI</span>
                    )}
                  </span>
                  <span style={styles.commentTimestamp}>
                    {new Date(comment.$createdAt).toLocaleDateString(
                      undefined,
                      {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )}
                  </span>
                  {isOwner && !isEditing && (
                    <span style={styles.commentActions}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(comment.$id)
                          setEditBody(comment.body)
                          setEditError(null)
                        }}
                        style={styles.actionButton}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmId(comment.$id)
                          setDeleteError(null)
                        }}
                        style={styles.actionButton}
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <div style={styles.editContainer}>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      style={styles.editInput}
                      rows={2}
                    />
                    <div style={styles.editActions}>
                      <button
                        type="button"
                        onClick={handleEditSave}
                        disabled={editPosting}
                        style={styles.editSaveButton}
                      >
                        {editPosting ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        style={styles.editCancelButton}
                      >
                        Cancel
                      </button>
                    </div>
                    {editError && <p style={formStyles.error}>{editError}</p>}
                  </div>
                ) : (
                  <p style={styles.commentBody}>{comment.body}</p>
                )}
              </div>
            )
          })}
        </div>

        <div style={styles.inputArea}>
          {postError && <p style={formStyles.error}>{postError}</p>}
          <div style={styles.inputRow}>
            <input
              type="text"
              placeholder="Write a comment…"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) handlePost()
              }}
              style={styles.input}
              disabled={posting}
            />
            <button
              type="button"
              onClick={handlePost}
              disabled={posting || !newBody.trim()}
              style={
                posting || !newBody.trim()
                  ? styles.postButtonDisabled
                  : styles.postButton
              }
            >
              Post
            </button>
          </div>
        </div>
      </div>

      {deleteConfirmId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-comment-title"
          style={styles.backdrop}
          onClick={() => setDeleteConfirmId(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDeleteConfirmId(null)
          }}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: prevents closing on card click */}
          <div
            role="presentation"
            style={styles.confirmCard}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h4 id="delete-comment-title" style={styles.confirmTitle}>
              Delete Comment?
            </h4>
            <p style={styles.confirmText}>
              Are you sure you want to delete this comment? This cannot be
              undone.
            </p>
            <div style={styles.confirmActions}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
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
    </div>
  )
}

const styles = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(4,12,24,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '14px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: borders.subtle,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: '20px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  commentList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  loading: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '14px',
    textAlign: 'center' as const,
    margin: '32px 0',
  },
  empty: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '14px',
    textAlign: 'center' as const,
    fontStyle: 'italic',
    margin: '32px 0',
  },
  systemMessage: {
    textAlign: 'center' as const,
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '12px',
    fontStyle: 'italic',
    padding: '8px 0',
  },
  commentBubble: {
    background: 'rgba(59,189,232,0.06)',
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
    fontSize: '13px',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  aiBadge: {
    display: 'inline-block',
    marginLeft: '6px',
    padding: '1px 5px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: '700',
    background: 'rgba(59,189,232,0.2)',
    color: colors.accent,
    letterSpacing: '0.05em',
  },
  commentTimestamp: {
    fontFamily: fonts.body,
    fontSize: '11px',
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
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '11px',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  commentBody: {
    fontFamily: fonts.body,
    fontSize: '14px',
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
    fontSize: '14px',
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
    fontSize: '12px',
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
    fontSize: '12px',
    cursor: 'pointer',
  },
  inputArea: {
    padding: '16px 24px',
    borderTop: borders.subtle,
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
    fontSize: '14px',
    outline: 'none',
  },
  postButton: {
    padding: '10px 20px',
    borderRadius: '7px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  postButtonDisabled: {
    padding: '10px 20px',
    borderRadius: '7px',
    border: 'none',
    background: 'rgba(59,189,232,0.3)',
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'not-allowed',
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
