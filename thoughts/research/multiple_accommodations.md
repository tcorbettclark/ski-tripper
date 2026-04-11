---
date: 2026-04-07T08:56:13+01:00
git_commit: a57ed8a913602a286f6dd1f5955d0b85855c2fde
branch: alice
repository: ski-tripper.alice
topic: "Research: Multiple Accommodations per Proposal (FEATURE-001)"
tags: [research, appwrite, data-model, proposal, accommodation, 1:N-relationship]
last_updated: 2026-04-07
---

## Ticket Synopsis

FEATURE-001: Transition proposals and accommodations from 1:1 to 1:N relationship, allowing 1-5 accommodations per proposal. Key requirements: separate `Accommodations` table with `proposalId` foreign key, CRUD operations only in `DRAFT` state, minimum 1 and maximum 5 accommodations, cascade delete when proposal is deleted.

## Summary

The codebase has well-established patterns for 1:N relationships via foreign keys (e.g., `tripId` in participants/proposals) and manual cascade deletes. The accommodation feature will follow these same patterns. Current accommodation fields (`accommodationName`, `accommodationUrl`, `approximateCost`) exist directly on the Proposal document and will need to be moved to a new Accommodations table. No backend validation currently exists for submission data completeness.

## Detailed Findings

### Current Proposal Data Model

The `Proposal` interface in `src/types.d.ts:19-39` contains three accommodation fields that will be removed:
- `accommodationName: string` (line 34)
- `accommodationUrl: string` (line 35)
- `approximateCost: string` (line 38)

These fields appear in:
- `src/CreateProposalForm.tsx:28-30,44-46,86-88,143-163` - Form inputs
- `src/EditProposalForm.tsx:33-35,105-124` - Form inputs
- `src/ProposalCard.tsx:122-123,150,152-163,197-198,225,227-238` - Display
- `src/backend.ts:445-447,460-464` - createProposal function

### 1:N Relationship Pattern

The codebase uses simple string foreign keys with manual queries. Pattern from `src/backend.ts:68-84`:

```typescript
export async function listTripParticipants(tripId: string, db: TablesDB = tablesDb) {
  const participants = await fetchRows<Participant>(
    db.listRows({
      queries: [Query.equal('tripId', tripId)]
    })
  )
}
```

**New Accommodations table will need:**
- `ACCOMMODATIONS_TABLE_ID` constant in `src/backend.ts`
- `proposalId: string` foreign key field
- CRUD functions: `createAccommodation`, `listAccommodations`, `updateAccommodation`, `deleteAccommodation`

### Cascade Delete Pattern

From `src/backend.ts:230-310` (deleteTrip):

```typescript
// 1. Fetch all children in parallel
const [participants, proposals, votes, polls] = await Promise.all([...])

// 2. Delete all children in parallel
await Promise.all([
  ...participants.map(p => db.deleteRow(...)),
  ...proposals.map(p => db.deleteRow(...)),
])

// 3. Delete parent last
await db.deleteRow({ tableId: TRIPS_TABLE_ID, rowId: tripId })
```

For proposal deletion, add accommodation fetch/delete before the existing proposal delete at `src/backend.ts:544-565`.

### Form Array Pattern

From `src/Proposals.tsx:71,118-128` for managing proposal lists:

```typescript
const [proposals, setProposals] = useState<Proposal[]>([])

// Add: append to array
const handleCreated = useCallback((proposal: unknown) => {
  setProposals((p) => [proposal as Proposal, ...p])
}, [])

// Update: replace by ID
const handleUpdated = useCallback((updated: unknown) => {
  setProposals((p) => p.map((prop) => (prop.$id === u.$id ? u : prop)))
}, [])

// Delete: filter out
const handleDeleted = useCallback((id: string) => {
  setProposals((p) => p.filter((prop) => prop.$id !== id))
}, [])
```

For 1-5 accommodation array: use object `Record<string, Accommodation>` for O(1) updates by ID, following `src/PollVoting.tsx:37-48` pattern.

### DRAFT State Validation

Current `submitProposal` (`src/backend.ts:567-591`) only validates:
1. Ownership (line 579): `proposal.proposerUserId !== proposerUserId`
2. State (line 581): `proposal.state !== 'DRAFT'`

**No data completeness validation** exists. The ticket requires adding validation that minimum 1 accommodation exists before submission.

### UI Validation Pattern

From `src/PollVoting.tsx:52-54,62-66` for token constraints:

```typescript
const maxTokens = sortedProposalIds.length
const totalUsed = Object.values(allocations).reduce((a, b) => a + b, 0)
const remaining = maxTokens - totalUsed

// Disable + button when no tokens remaining
<button disabled={remaining === 0}>+</button>
```

For accommodations: validate count before submit, disable add button when at 5.

### Search/Filter Pattern

`src/ProposalsGrid.tsx:74-86` filters by `accommodationName`. Search must load and filter accommodations separately - more complex than current single-field lookup.

### Display Logic

Poll views (`src/PollVoting.tsx:103-105`, `src/PollResults.tsx:50-52`) show:
```typescript
const name = proposal
  ? proposal.accommodationName
    ? `${proposal.resortName} (at ${proposal.accommodationName})`
    : proposal.resortName
  : proposalId
```

Will need decision: show first accommodation, show count, or show primary selection.

## Code References

### Types
- `src/types.d.ts:19-39` - Proposal interface (accommodation fields at lines 34, 35, 38)

### Backend
- `src/backend.ts:230-310` - `deleteTrip` cascade delete pattern
- `src/backend.ts:68-84` - `listTripParticipants` (1:N query pattern)
- `src/backend.ts:433-472` - `createProposal` (will need accommodation param removal)
- `src/backend.ts:510-542` - `updateProposal`
- `src/backend.ts:544-565` - `deleteProposal` (add cascade to accommodations)
- `src/backend.ts:567-591` - `submitProposal` (add accommodation count validation)
- `src/backend.ts:13-19` - Appwrite client setup
- `src/backend.ts:41-48` - Table ID constants (add ACCOMMODATIONS_TABLE_ID)

### Forms
- `src/CreateProposalForm.tsx:28-30,44-46,86-88,143-163` - Current accommodation inputs
- `src/EditProposalForm.tsx:33-35,105-124` - Current accommodation inputs

### Display
- `src/ProposalCard.tsx:122-123,150,152-163` - Accommodation display
- `src/ProposalsGrid.tsx:74-86` - Search filter (will need update)
- `src/PollVoting.tsx:103-105` - Poll display of accommodation
- `src/PollResults.tsx:50-52` - Results display of accommodation

### State Management
- `src/Proposals.tsx:71,118-128` - Array CRUD callback patterns
- `src/PollVoting.tsx:37-48` - Record-based array state pattern

## Architecture Insights

### Established Patterns Confirmed

1. **No Appwrite Relationships**: All foreign keys are manual string fields; queries use `Query.equal('foreignKey', value)`

2. **No Transactions**: Cascade deletes use parallel fetch then parallel delete; failures leave inconsistent state

3. **Container Pattern**: Parent components own state, pass callbacks (`onCreated`, `onUpdated`, `onDeleted`) to children

4. **Denormalization**: Store related data directly (e.g., `proposerUserName`) to avoid N+1 queries

5. **TablesDB API**: Uses `listRows`, `createRow`, `updateRow`, `deleteRow`, `getRow` (not legacy Collections API)

6. **Permission Model**: `[Permission.read(Role.users()), Permission.write(Role.user(userId))]`

7. **Error Handling**: Errors propagate to ErrorBoundary; no try-catch in components

### Migration Strategy Considerations

1. **Existing Proposals**: Need migration script to create Accommodation documents from embedded fields
2. **Accommodation Creation Timing**: Can either create with proposal (like `createTrip` creates participant) or separately after
3. **Edit Pattern**: Update individual accommodation via `updateAccommodation` or delete all + recreate

## Historical Context (from thoughts/)

- `thoughts/designs/typescript-migration-design.md` - Data model decisions (denormalization, foreign keys as strings)
- `thoughts/research/proposal_cards_grid_redesign.md` - Container pattern, callback prop architecture
- `thoughts/tickets/feature_proposal_cards_grid.md` - Similar card grid implementation
- `thoughts/plans/proposal-cards-grid-redesign.md` - Implementation plan structure

## Related Research

- `thoughts/research/proposal_cards_grid_redesign.md` - Container pattern details
- `thoughts/research/refactor-remove-getUserById-calls.md` - Denormalization patterns

## Open Questions

1. **Migration**: Should existing proposals have one Accommodation created from embedded fields on deploy? - No migration (I will reset the database as it is not yet in production).
2. **Cost Display**: Keep as formatted string like current "£2,400 / person" or separate number + currency fields? - Just text as is, to provide flexibility.
3. **Primary Accommodation**: How to determine which accommodation shows in poll voting titles? - Don't show any, but leave user to rely upon info button popup card.
4. **Creation Timing**: Create accommodations atomically with proposal or as separate operation? - With proposal. So CRUD operations on accommodations are always part of create/edit the proposal.
5. **Permissions**: Should accommodation permissions mirror proposal permissions (owner write, public read)? - Yes
