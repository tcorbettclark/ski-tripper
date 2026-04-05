# Proposal Cards Grid Redesign Implementation Plan

## Overview

Replace the existing proposals table (`ProposalsTable.tsx`) and modal viewer (`ProposalViewer.tsx`) with a responsive card grid layout. Each card displays all proposal details inline with fuzzy search and 3-state filtering.

## Current State Analysis

**Existing Components:**
- `ProposalsTable.tsx:1-122` - Renders table with `<thead>`/`<tbody>`, manages `viewingIndex` for modal
- `ProposalsRow.tsx:1-291` - Table row with permission logic and inline edit via `EditProposalForm`
- `ProposalViewer.tsx:1-327` - Modal carousel showing all proposal fields
- `Proposals.tsx:1-283` - Container managing state, passes callbacks to `ProposalsTable`

**Key Patterns to Reuse:**
- Permission logic: `isOwner` (userId === proposerUserId), `canAct` (owner + DRAFT), `canReject` (coordinator + SUBMITTED) - `ProposalsRow.tsx:51-55`
- Badge styles: `badgeDraft`, `badgeSubmitted`, `badgeRejected` - `ProposalsRow.tsx:251-286`
- Card styling: `bgCard` background, `borders.card`, border-radius 14px - `ProposalViewer.tsx:216-218`
- 2-column grid layout: `gridTemplateColumns: '1fr 1fr'` - `ProposalViewer.tsx:264`
- Modal backdrop: `rgba(4,12,24,0.85)` with centered card - `ProposalViewer.tsx:186-195`
- Tab filter pattern: Button group with active/inactive states - `Header.tsx:46-80`

**Theme Constants (from `src/theme.ts`):**
- Colors: `accent: '#3bbde8'`, `error: '#ff6b6b'`, `bgCard: '#0d1e30'`, `textPrimary/Secondary/Data`
- Borders: `card: '1px solid rgba(100,190,230,0.12)'`, `accent: '1px solid rgba(59,189,232,0.3)'`

## Desired End State

- `ProposalsGrid.tsx` - Grid container with search, filter, and sorted proposals
- `ProposalCard.tsx` - Individual card showing all proposal fields with action buttons
- `Proposals.tsx` - Updated to render `ProposalsGrid` instead of `ProposalsTable`
- `ProposalsTable.tsx`, `ProposalsRow.tsx`, `ProposalViewer.tsx` - Removed
- Fuzzy search across all fields with 300ms debounce
- 3-state filter: All / DRAFT / SUBMITTED / REJECTED
- Cards sorted alphabetically by resort name (case-insensitive)
- Delete shows confirmation modal before removing

### Verification Steps:
1. Run `bun run test src/ProposalCard.test.tsx` - all tests pass
2. Run `bun run test src/ProposalsGrid.test.tsx` - all tests pass
3. Run `bun run test src/Proposals.test.tsx` - all tests pass
4. Run `bunx tsc --noEmit` - no type errors
5. Run `bun run lint` - no lint errors
6. Proposals display as responsive card grid
7. Search filters cards in real-time (debounced 300ms)
8. Filter buttons show only selected state proposals
9. Edit/Submit buttons appear only for owner + DRAFT
10. Reject button appears only for coordinator + SUBMITTED
11. Delete shows confirmation modal before removal
12. All fields display inline (no modal viewer needed)

## What We're NOT Doing

- Pagination or infinite scroll (max ~20 proposals)
- Persistent filter/search state in URL
- Bulk actions
- Hover-dependent UI (touch-friendly)
- Comparison features beyond viewing all in grid
- Expand/collapse - all details visible on card
- Display submission date or rejection reason
- Loading state while filtering (instant for ~20 items)

## Implementation Approach

**Architecture:** Container pattern unchanged - `Proposals` fetches data and passes to `ProposalsGrid` via same callback props.

**Grid Layout:** CSS Grid with `repeat(auto-fit, minmax(280px, 1fr))` for responsive columns without media queries.

**Search:** Case-insensitive fuzzy match across resortName, country, description, proposerUserName, nearestAirport, accommodationName. Debounced 300ms using `setTimeout`/`clearTimeout`.

**Filter:** Union type `'all' | 'DRAFT' | 'SUBMITTED' | 'REJECTED'`. Applied after search filtering.

**Sort:** Case-insensitive alphabetical by `resortName.toLowerCase()`.

**Delete Confirmation:** Modal with backdrop pattern from `ProposalViewer.tsx:186-195`.

## Phase 1: Create ProposalCard Component

### Overview
Individual card displaying all proposal fields with permission-based action buttons.

### Changes Required:

#### 1. New Component: `src/ProposalCard.tsx`

**File:** `src/ProposalCard.tsx`
**Changes:** Create new file with default export

```typescript
import { useState } from 'react'
import {
  deleteProposal as _deleteProposal,
  rejectProposal as _rejectProposal,
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
  onUpdated: (proposal: unknown) => void
  onDeleted: (proposalId: string) => void
  onSubmitted: (proposal: unknown) => void
  onRejected?: (proposal: unknown) => void
  updateProposal?: (
    proposalId: string,
    userId: string,
    data: Partial<Proposal>
  ) => Promise<unknown>
  deleteProposal?: (proposalId: string, userId: string) => Promise<void>
  submitProposal?: (proposalId: string, userId: string) => Promise<unknown>
  rejectProposal?: (proposalId: string, userId: string) => Promise<unknown>
}

export default function ProposalCard({
  proposal,
  userId,
  isCoordinator = false,
  onUpdated,
  onDeleted,
  onSubmitted,
  onRejected = () => {},
  updateProposal = _updateProposal,
  deleteProposal = _deleteProposal,
  submitProposal = _submitProposal,
  rejectProposal = _rejectProposal,
}: ProposalCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectError, setRejectError] = useState('')

  const isOwner = userId === proposal.proposerUserId
  const isDraft = proposal.state === 'DRAFT'
  const isRejected = proposal.state === 'REJECTED'
  const canAct = isOwner && isDraft
  const canReject = isCoordinator && proposal.state === 'SUBMITTED'

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

  async function handleDelete() {
    try {
      await deleteProposal(proposal.$id, userId)
      onDeleted(proposal.$id)
    } catch (err) {
      // Errors propagate to ErrorBoundary
    }
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
        onDeleted={() => {
          setIsEditing(false)
          onDeleted(proposal.$id)
        }}
        onCancel={() => setIsEditing(false)}
        updateProposal={updateProposal}
        deleteProposal={deleteProposal}
      />
    )
  }

  return (
    <>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.resortName}>{proposal.resortName || '—'}</h3>
            <div style={styles.subHeader}>
              <span>{proposal.country || '—'}</span>
              <span style={getBadgeStyle(proposal.state)}>{proposal.state}</span>
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

        {!isRejected && (
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
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div style={styles.backdrop} onClick={() => setShowDeleteConfirm(false)}>
          <div style={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <h4 style={styles.confirmTitle}>Delete Proposal?</h4>
            <p style={styles.confirmText}>
              Are you sure you want to delete "{proposal.resortName}"? This cannot be undone.
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
```

### Success Criteria:

#### Automated Verification:
- [x] Unit tests pass: `bun run test src/ProposalCard.test.tsx`
- [x] Type check passes: `bunx tsc --noEmit`

#### Manual Verification:
- [x] Card displays all proposal fields inline
- [x] Edit/Submit buttons appear only for owner + DRAFT
- [x] Delete button shows confirmation modal
- [x] Reject button appears only for coordinator + SUBMITTED
- [x] Badge shows correct state styling
- [x] EditProposalForm renders inline when editing

---

## Phase 2: Create ProposalsGrid Component

### Overview
Grid container managing search, filter, sort, and rendering of ProposalCard components.

### Changes Required:

#### 1. New Component: `src/ProposalsGrid.tsx`

**File:** `src/ProposalsGrid.tsx`
**Changes:** Create new file with default export

```typescript
import { useState, useEffect, useMemo } from 'react'
import {
  deleteProposal as _deleteProposal,
  rejectProposal as _rejectProposal,
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

export default function ProposalsGrid({
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

    // Sort alphabetically by resort name (case-insensitive)
    result = [...result].sort((a, b) =>
      (a.resortName || '').toLowerCase().localeCompare((b.resortName || '').toLowerCase())
    )

    // Apply search filter
    if (debouncedQuery) {
      const query = debouncedQuery.toLowerCase().trim()
      result = result.filter((p) =>
        p.resortName?.toLowerCase().includes(query) ||
        p.country?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.proposerUserName?.toLowerCase().includes(query) ||
        p.nearestAirport?.toLowerCase().includes(query) ||
        p.accommodationName?.toLowerCase().includes(query)
      )
    }

    // Apply status filter
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
          {(['all', 'DRAFT', 'SUBMITTED', 'REJECTED'] as StatusFilter[]).map((status) => (
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
          ))}
        </div>
      </div>

      {filteredProposals.length === 0 ? (
        <p style={styles.emptySearch}>No proposals match your search. Try different criteria.</p>
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
              updateProposal={updateProposal}
              deleteProposal={deleteProposal}
              submitProposal={submitProposal}
              rejectProposal={rejectProposal}
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
```

### Success Criteria:

#### Automated Verification:
- [x] Unit tests pass: `bun run test src/ProposalsGrid.test.tsx`
- [x] Type check passes: `bunx tsc --noEmit`

#### Manual Verification:
- [x] Grid adapts column count based on viewport width
- [x] Search filters cards in real-time (debounced 300ms)
- [x] Filter buttons highlight active state
- [x] Proposals sorted alphabetically by resort name
- [x] Empty state shows appropriate message when no proposals match

---

## Phase 3: Update Proposals Component

### Overview
Replace `ProposalsTable` import with `ProposalsGrid` in the container component.

### Changes Required:

#### 1. Update `src/Proposals.tsx`

**File:** `src/Proposals.tsx`
**Changes:** Modify lines 13, 199-212

Line 13 change:
```typescript
// Change:
import ProposalsTable from './ProposalsTable'
// To:
import ProposalsGrid from './ProposalsGrid'
```

Lines 199-212 change:
```typescript
// Change:
        <ProposalsTable
          proposals={proposals}
          userId={user.$id}
          isCoordinator={isCoordinator}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onSubmitted={handleSubmitted}
          onRejected={handleRejected}
          emptyMessage="No proposals yet. Create one above."
          updateProposal={updateProposal}
          deleteProposal={deleteProposal}
          submitProposal={submitProposal}
          rejectProposal={rejectProposal}
        />

// To:
        <ProposalsGrid
          proposals={proposals}
          userId={user.$id}
          isCoordinator={isCoordinator}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onSubmitted={handleSubmitted}
          onRejected={handleRejected}
          emptyMessage="No proposals yet. Create one above."
          updateProposal={updateProposal}
          deleteProposal={deleteProposal}
          submitProposal={submitProposal}
          rejectProposal={rejectProposal}
        />
```

### Success Criteria:

#### Automated Verification:
- [x] Unit tests pass: `bun run test src/Proposals.test.tsx`
- [x] Type check passes: `bunx tsc --noEmit`
- [x] Lint passes: `bun run lint`

---

## Phase 4: Write Tests

### Overview
Write unit tests for the new components.

### Changes Required:

#### 1. Create `src/ProposalCard.test.tsx`

**File:** `src/ProposalCard.test.tsx`

```typescript
import { describe, it, expect, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, mock } from 'bun:test'
import userEvent from '@testing-library/user-event'
import ProposalCard from './ProposalCard'
import type { Proposal } from './types.d.ts'

// Mock functions
const mockUpdateProposal = mock(async () => ({}))
const mockDeleteProposal = mock(async () => {})
const mockSubmitProposal = mock(async () => ({}))

const mockRejectProposal = mock(async () => ({}))

const baseProposal: Proposal = {
  $id: 'proposal-1',
  $createdAt: '2024-01-01T00:00:00Z',
  $updatedAt: '2024-01-01T00:00:00Z',
  proposerUserId: 'user-1',
  proposerUserName: 'John Doe',
  tripId: 'trip-1',
  state: 'DRAFT',
  title: 'Test Proposal',
  description: 'A test proposal description',
  resortName: 'Test Resort',
  startDate: '2024-01-01',
  endDate: '2024-01-07',
  nearestAirport: 'TEST',
  transferTime: '1 hour',
  accommodationName: 'Test Hotel',
  accommodationUrl: 'https://example.com',
  altitudeRange: '1000-2000m',
  country: 'Test Country',
  approximateCost: '$1000',
}

describe('ProposalCard', () => {
  it('renders all proposal fields', () => {
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    expect(screen.getByText('Test Resort')).toBeDefined()
    expect(screen.getByText('Test Country')).toBeDefined()
    expect(screen.getByText('DRAFT')).toBeDefined()
    expect(screen.getByText('John Doe')).toBeDefined()
  })

  it('shows edit and submit buttons for owner + DRAFT', () => {
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDefined()
  })

  it('hides edit/submit for non-owner', () => {
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-2"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull()
  })

  it('shows reject button for coordinator + SUBMITTED', () => {
    const submittedProposal = { ...baseProposal, state: 'SUBMITTED' as const }
    render(
      <ProposalCard
        proposal={submittedProposal}
        userId="user-2"
        isCoordinator={true}
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        onRejected={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    expect(screen.getByRole('button', { name: 'Reject' })).toBeDefined()
  })

  it('shows delete confirmation dialog', async () => {
    const user = userEvent.setup()
    render(
      <ProposalCard
        proposal={baseProposal}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete Proposal?')).toBeDefined()
  })
})
```

#### 2. Create `src/ProposalsGrid.test.tsx`

**File:** `src/ProposalsGrid.test.tsx`

```typescript
import { describe, it, expect, mock } from 'bun:test'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProposalsGrid from './ProposalsGrid'
import type { Proposal } from './types.d.ts'

const mockUpdateProposal = mock(async () => ({}))
const mockDeleteProposal = mock(async () => {})
const mockSubmitProposal = mock(async () => ({}))
const mockRejectProposal = mock(async () => ({}))

const proposals: Proposal[] = [
  {
    $id: 'proposal-1',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    proposerUserId: 'user-1',
    proposerUserName: 'Alice',
    tripId: 'trip-1',
    state: 'DRAFT',
    title: 'Z Resort',
    description: 'Z description',
    resortName: 'Z Resort',
    startDate: '2024-01-01',
    endDate: '2024-01-07',
    nearestAirport: 'ZAI',
    transferTime: '1 hour',
    accommodationName: 'Z Hotel',
    accommodationUrl: '',
    altitudeRange: '1000m',
    country: 'Z Country',
    approximateCost: '$500',
  },
  {
    $id: 'proposal-2',
    $createdAt: '2024-01-02T00:00:00Z',
    $updatedAt: '2024-01-02T00:00:00Z',
    proposerUserId: 'user-2',
    proposerUserName: 'Bob',
    tripId: 'trip-1',
    state: 'SUBMITTED',
    title: 'A Resort',
    description: 'A description',
    resortName: 'A Resort',
    startDate: '2024-02-01',
    endDate: '2024-02-07',
    nearestAirport: 'AIA',
    transferTime: '2 hours',
    accommodationName: 'A Hotel',
    accommodationUrl: '',
    altitudeRange: '2000m',
    country: 'A Country',
    approximateCost: '$1000',
  },
]

describe('ProposalsGrid', () => {
  it('renders all proposals', () => {
    render(
      <ProposalsGrid
        proposals={proposals}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    expect(screen.getByText('A Resort')).toBeDefined()
    expect(screen.getByText('Z Resort')).toBeDefined()
  })

  it('sorts proposals alphabetically by resort name', () => {
    render(
      <ProposalsGrid
        proposals={proposals}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    const cards = screen.getAllByRole('article').length
    expect(cards).toBe(2)
  })

  it('filters by DRAFT status', async () => {
    const user = userEvent.setup()
    render(
      <ProposalsGrid
        proposals={proposals}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    await user.click(screen.getByRole('button', { name: 'DRAFT' }))
    expect(screen.getByText('Z Resort')).toBeDefined()
    expect(screen.queryByText('A Resort')).toBeNull()
  })

  it('filters by SUBMITTED status', async () => {
    const user = userEvent.setup()
    render(
      <ProposalsGrid
        proposals={proposals}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    await user.click(screen.getByRole('button', { name: 'SUBMITTED' }))
    expect(screen.getByText('A Resort')).toBeDefined()
    expect(screen.queryByText('Z Resort')).toBeNull()
  })

  it('shows empty message when no proposals', () => {
    render(
      <ProposalsGrid
        proposals={[]}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
        emptyMessage="No proposals yet."
      />
    )

    expect(screen.getByText('No proposals yet.')).toBeDefined()
  })

  it('shows search results empty state', async () => {
    const user = userEvent.setup()
    render(
      <ProposalsGrid
        proposals={proposals}
        userId="user-1"
        onUpdated={() => {}}
        onDeleted={() => {}}
        onSubmitted={() => {}}
        updateProposal={mockUpdateProposal}
        deleteProposal={mockDeleteProposal}
        submitProposal={mockSubmitProposal}
        rejectProposal={mockRejectProposal}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search proposals…')
    await user.type(searchInput, 'nonexistent')
    
    expect(screen.getByText('No proposals match your search. Try different criteria.')).toBeDefined()
  })
})
```

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `bun run test src/ProposalCard.test.tsx src/ProposalsGrid.test.tsx`

---

## Phase 5: Remove Old Files

### Overview
Delete components that are no longer needed.

### Changes Required:

#### 1. Delete deprecated files

**Files to delete:**
- `src/ProposalsTable.tsx`
- `src/ProposalsRow.tsx`
- `src/ProposalViewer.tsx`

**Command:**
```bash
rm src/ProposalsTable.tsx src/ProposalsRow.tsx src/ProposalViewer.tsx
```

### Success Criteria:

#### Manual Verification:
- [x] Project still builds and runs correctly
- [x] No broken imports referencing deleted files

---

## Testing Strategy

### Unit Tests:
- **ProposalCard**: Renders fields, permission-based buttons (Edit/Submit/Reject/Delete), delete confirmation modal
- **ProposalsGrid**: Renders grid, alphabetical sorting, search filtering, status filtering, empty states

### Integration Tests:
- **Proposals.test.tsx**: Existing tests should pass with new grid component
- Verify search + filter work together
- Verify all callback handlers work (onUpdated, onDeleted, onSubmitted, onRejected)

### Manual Testing Steps:
1. Open proposals view - should see card grid
2. Resize viewport - grid should adapt columns (1 on mobile, 2-3 on desktop)
3. Type in search - cards should filter (debounced 300ms)
4. Click filter buttons - only matching state cards shown
5. Create/edit/delete proposals - grid should update
6. Check permission-based buttons - Edit only for owner+DRAFT, Reject only for coordinator+SUBMITTED
7. Delete proposal - confirmation modal should appear

---

## Performance Considerations

- **Debounced search**: 300ms delay prevents excessive re-renders while maintaining responsiveness
- **useMemo for filtering**: Prevents unnecessary filtering when unrelated state changes
- **Max ~20 proposals**: No pagination needed, all cards render in DOM
- **CSS Grid auto-fit**: Intrinsic responsive layout without JavaScript calculations

---

## Migration Notes

- No data migration needed (UI-only change)
- Backend operations unchanged
- Component props interface maintained for backwards compatibility
- Existing `Proposals.test.tsx` tests should pass unchanged

---

## References

- Original ticket: `thoughts/tickets/feature_proposal_cards_grid.md`
- Research: `thoughts/research/2026-04-04_proposal_cards_grid_redesign.md`
- Permission logic: `src/ProposalsRow.tsx:51-55`
- Badge styles: `src/ProposalsRow.tsx:251-286`
- Card styling: `src/ProposalViewer.tsx:216-218`
- Filter pattern: `src/Header.tsx:46-80`
- Delete modal: `src/ProposalViewer.tsx:186-195`
- Theme: `src/theme.ts`
- Types: `src/types.d.ts:19-39`
