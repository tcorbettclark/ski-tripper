# Multiple Accommodations per Proposal Implementation Plan

## Overview

Transition the relationship between proposals and accommodations from 1:1 to 1:N, allowing 1-5 accommodation options per proposal. Accommodations are editable only in `DRAFT` state and display in a table layout on proposal cards.

## Current State Analysis

**Existing Data Model:**
- `src/types.d.ts:34-35,38` - Proposal interface has embedded accommodation fields:
  - `accommodationName: string`
  - `accommodationUrl: string`
  - `approximateCost: string`

**Existing Backend Functions:**
- `src/backend.ts:433-472` - `createProposal` accepts and stores accommodation fields directly on proposal
- `src/backend.ts:544-565` - `deleteProposal` has no cascade delete for accommodations
- `src/backend.ts:567-591` - `submitProposal` has no accommodation count validation (only checks ownership and DRAFT state)

**Existing Form Inputs:**
- `src/CreateProposalForm.tsx:143-163` - Single accommodation fields (name, URL, cost)
- `src/EditProposalForm.tsx:105-124` - Single accommodation fields (name, URL, cost)

**Existing Display:**
- `src/ProposalCard.tsx:122-123,152-163,197-198,227-238` - Single accommodation display with link
- `src/ProposalsGrid.tsx:81` - Search filters by `accommodationName`
- `src/PollVoting.tsx:103-104` - Shows accommodation in poll title
- `src/PollResults.tsx:50-51` - Shows accommodation in results

## Desired End State

- New `Accommodations` table with `proposalId` foreign key
- `Accommodation` interface with: `proposalId`, `name`, `url`, `cost`, `description`
- Remove `accommodationName`, `accommodationUrl`, `approximateCost` from Proposal interface
- CRUD operations for accommodations (create, read, update, delete)
- Accommodations editable only in `DRAFT` state
- Minimum 1, maximum 5 accommodations per proposal
- Cascade delete: deleting proposal deletes all associated accommodations
- Proposal card displays accommodations in table layout
- Poll views do NOT show accommodation info in titles (Option A - rely on info button)

### Key Discoveries

- **1:N Pattern**: Uses simple string foreign key with `Query.equal('proposalId', id)` - `src/backend.ts:68-84`
- **Cascade Delete Pattern**: Parallel fetch then parallel delete before parent delete - `src/backend.ts:245-304`
- **Form Array Pattern**: Record-based state `Record<string, Accommodation>` for O(1) updates - `src/PollVoting.tsx:37-48`
- **Permissions**: `[Permission.read(Role.users()), Permission.write(Role.user(userId))]`
- **No Transactions**: Cascade deletes use parallel operations; failures leave inconsistent state
- **Test Mock Pattern**: `createMockDb()` with `mock()` from `bun:test` - `src/backend.test.ts:27-50`

## What We're NOT Doing

- Migration of existing proposals (database will be reset)
- Total cost calculation across accommodations
- Primary accommodation selection
- Accommodation display in poll voting titles (Option A)
- Currency/number separation for cost - keep as formatted text string
- Accommodation-specific search filtering

## Implementation Approach

**Architecture:**
1. Add `Accommodation` interface to `types.d.ts`
2. Add `ACCOMMODATIONS_TABLE_ID` constant and CRUD functions to `backend.ts`
3. Add cascade delete to `deleteProposal`
4. Add accommodation count validation to `submitProposal`
5. Update forms to handle accommodation arrays
6. Update proposal card to display accommodations table
7. Remove accommodation from poll title displays
8. Update tests

**Accommodation Edit Pattern:**
- When editing a proposal, load existing accommodations via `listAccommodations(proposalId)`
- Use `Record<string, Accommodation>` for O(1) updates by ID
- Add/remove/edit individual accommodations
- Changes saved to Appwrite immediately per accommodation

**UI Validation:**
- Disable "Add Accommodation" button when at 5
- Require minimum 1 accommodation to submit

## Phase 1: Types & Backend

### Overview
Add Accommodation type, table ID constant, CRUD functions, cascade delete, and validation.

### Changes Required

#### 1. Add Accommodation Interface
**File:** `src/types.d.ts`
**Changes:** Add new interface after Proposal (after line 39):

```typescript
export interface Accommodation {
  $id: string
  $createdAt: string
  $updatedAt: string
  proposalId: string
  name: string
  url: string
  cost: string
  description: string
}
```

#### 2. Remove Accommodation Fields from Proposal
**File:** `src/types.d.ts`
**Changes:** Remove lines 34-35 and 38:
- Remove `accommodationName: string` (line 34)
- Remove `accommodationUrl: string` (line 35)
- Remove `approximateCost: string` (line 38)

#### 3. Add ACCOMMODATIONS_TABLE_ID Constant
**File:** `src/backend.ts`
**Changes:** Add after line 46:

```typescript
const ACCOMMODATIONS_TABLE_ID = process.env
  .PUBLIC_APPWRITE_ACCOMMODATIONS_TABLE_ID as string
```

#### 4. Add Accommodation CRUD Functions
**File:** `src/backend.ts`
**Changes:** Add after `submitProposal` (after line 591):

```typescript
export async function createAccommodation(
  proposalId: string,
  proposerUserId: string,
  data: {
    name: string
    url?: string
    cost?: string
    description?: string
  },
  db: TablesDB = tablesDb
): Promise<Accommodation> {
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  if (proposal.proposerUserId !== proposerUserId)
    throw new Error('Only the creator can add accommodations.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Accommodations can only be added to draft proposals.')
  const accommodations = await listAccommodations(proposalId, db)
  if (accommodations.length >= 5)
    throw new Error('Maximum of 5 accommodations allowed per proposal.')
  return fetchRow<Accommodation>(
    db.createRow({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      rowId: ID.unique(),
      data: {
        proposalId,
        ...data,
      } as Record<string, unknown>,
      permissions: [
        Permission.read(Role.users()),
        Permission.write(Role.user(proposerUserId)),
      ],
    })
  )
}

export async function listAccommodations(
  proposalId: string,
  db: TablesDB = tablesDb
): Promise<Accommodation[]> {
  return fetchRows<Accommodation>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      queries: [
        Query.equal('proposalId', proposalId),
        Query.orderDesc('$createdAt'),
        Query.limit(5),
      ],
    })
  )
}

export async function updateAccommodation(
  accommodationId: string,
  proposerUserId: string,
  data: {
    name?: string
    url?: string
    cost?: string
    description?: string
  },
  db: TablesDB = tablesDb
): Promise<Accommodation> {
  const accommodation = await fetchRow<Accommodation>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      rowId: accommodationId,
    })
  )
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: accommodation.proposalId,
    })
  )
  if (proposal.proposerUserId !== proposerUserId)
    throw new Error('Only the creator can edit accommodations.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Accommodations can only be edited on draft proposals.')
  return fetchRow<Accommodation>(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      rowId: accommodationId,
      data: data as Record<string, unknown>,
    })
  )
}

export async function deleteAccommodation(
  accommodationId: string,
  proposerUserId: string,
  db: TablesDB = tablesDb
): Promise<void> {
  const accommodation = await fetchRow<Accommodation>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      rowId: accommodationId,
    })
  )
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: accommodation.proposalId,
    })
  )
  if (proposal.proposerUserId !== proposerUserId)
    throw new Error('Only the creator can delete accommodations.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Accommodations can only be deleted from draft proposals.')
  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: ACCOMMODATIONS_TABLE_ID,
    rowId: accommodationId,
  })
}
```

#### 5. Update createProposal to Remove Accommodation Fields
**File:** `src/backend.ts`
**Changes:** Remove from data type (lines 445-447):
- Remove `accommodationName?: string`
- Remove `accommodationUrl?: string`
- Remove `approximateCost?: string`

#### 6. Update deleteProposal for Cascade Delete
**File:** `src/backend.ts`
**Changes:** Modify `deleteProposal` (lines 544-565) to fetch and delete accommodations before deleting proposal:

```typescript
export async function deleteProposal(
  proposalId: string,
  proposerUserId: string,
  db: TablesDB = tablesDb
): Promise<void> {
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  if (proposal.proposerUserId !== proposerUserId)
    throw new Error('Only the creator can delete this proposal.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Only draft proposals can be deleted.')
  const accommodations = await fetchRows<Accommodation>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      queries: [Query.equal('proposalId', proposalId), Query.limit(5)],
    })
  )
  await Promise.all([
    ...accommodations.map((a) =>
      db.deleteRow({
        databaseId: DATABASE_ID,
        tableId: ACCOMMODATIONS_TABLE_ID,
        rowId: a.$id,
      })
    ),
  ])
  await db.deleteRow({
    databaseId: DATABASE_ID,
    tableId: PROPOSALS_TABLE_ID,
    rowId: proposalId,
  })
}
```

#### 7. Update submitProposal for Accommodation Count Validation
**File:** `src/backend.ts`
**Changes:** Modify `submitProposal` (lines 567-591) to check minimum 1 accommodation:

```typescript
export async function submitProposal(
  proposalId: string,
  proposerUserId: string,
  db: TablesDB = tablesDb
): Promise<Proposal> {
  const proposal = await fetchRow<Proposal>(
    db.getRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
    })
  )
  if (proposal.proposerUserId !== proposerUserId)
    throw new Error('Only the creator can submit this proposal.')
  if (proposal.state !== 'DRAFT')
    throw new Error('Only draft proposals can be submitted.')
  const accommodations = await fetchRows<Accommodation>(
    db.listRows({
      databaseId: DATABASE_ID,
      tableId: ACCOMMODATIONS_TABLE_ID,
      queries: [Query.equal('proposalId', proposalId), Query.limit(5)],
    })
  )
  if (accommodations.length === 0)
    throw new Error('At least one accommodation is required to submit a proposal.')
  return fetchRow<Proposal>(
    db.updateRow({
      databaseId: DATABASE_ID,
      tableId: PROPOSALS_TABLE_ID,
      rowId: proposalId,
      data: { state: 'SUBMITTED' } as Record<string, unknown>,
    })
  )
}
```

### Success Criteria

#### Automated Verification:
- [ ] `bun run test src/backend.test.ts` - accommodation CRUD tests pass
- [ ] `bun run test src/backend.test.ts` - submitProposal validation test passes
- [ ] `bun run test src/backend.test.ts` - deleteProposal cascade test passes
- [ ] `bunx tsc --noEmit` - no type errors

---

## Phase 2: Forms - Multiple Accommodations Support

### Overview
Update CreateProposalForm and EditProposalForm to support managing 1-5 accommodations.

### Changes Required

#### 1. Update CreateProposalForm
**File:** `src/CreateProposalForm.tsx`
**Changes:**
- Remove lines 28-30 (accommodationName, accommodationUrl, approximateCost from interface)
- Remove lines 44-46 (EMPTY_FORM accommodation fields)
- Remove lines 86-88 (handleSubmit accommodation fields)
- Remove lines 143-163 (accommodation Field inputs)
- Add AccommodationInput sub-component for managing array of accommodations
- Add state: `Record<string, AccommodationInput>` where AccommodationInput has name, url, cost, description
- Add "Add Accommodation" button, disabled when at 5
- Add ability to remove accommodations (minus button)
- Add inline editing of accommodation fields

**AccommodationInput interface:**
```typescript
interface AccommodationInput {
  tempId: string
  name: string
  url: string
  cost: string
  description: string
}
```

#### 2. Update EditProposalForm
**File:** `src/EditProposalForm.tsx`
**Changes:** Similar to CreateProposalForm plus:
- Load existing accommodations via `listAccommodations(proposalId)` on mount
- Transform existing Accommodation records to AccommodationInput format
- Add `createAccommodation`, `updateAccommodation`, `deleteAccommodation` props
- Call appropriate backend function on accommodation add/edit/delete

#### 3. Update Props Interfaces
**File:** `src/CreateProposalForm.tsx` and `src/EditProposalForm.tsx`
**Changes:**
- Add `createAccommodation?` prop to CreateProposalForm
- Add `createAccommodation?`, `updateAccommodation?`, `deleteAccommodation?` props to EditProposalForm

### Success Criteria

#### Automated Verification:
- [ ] `bun run test src/CreateProposalForm.test.tsx` - updated tests pass
- [ ] `bun run test src/EditProposalForm.test.tsx` - updated tests pass
- [ ] `bunx tsc --noEmit` - no type errors

---

## Phase 3: Display - ProposalCard and Poll Views

### Overview
Update ProposalCard to display accommodations in table layout. Update poll views to not show accommodation info in titles.

### Changes Required

#### 1. Update ProposalCard to Display Accommodations Table
**File:** `src/ProposalCard.tsx`
**Changes:**
- Remove accommodation display at lines 122-123, 152-163, 197-198, 227-238
- Add `accommodations?: Accommodation[]` prop
- Display accommodations as a table when accommodations array has items:
```typescript
{accommodations && accommodations.length > 0 && (
  <div style={styles.accommodationsSection}>
    <h4 style={styles.sectionTitle}>Accommodations</h4>
    <table style={styles.accommodationsTable}>
      <thead>
        <tr>
          <th>Name</th>
          <th>Cost</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {accommodations.map((acc) => (
          <tr key={acc.$id}>
            <td>
              {acc.url ? (
                <a href={acc.url} target="_blank" rel="noopener noreferrer">
                  {acc.name} ↗
                </a>
              ) : (
                acc.name
              )}
            </td>
            <td>{acc.cost}</td>
            <td>{acc.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
```

#### 2. Update PollVoting - Remove Accommodation from Title
**File:** `src/PollVoting.tsx`
**Changes:** Modify lines 103-104 to remove accommodation name:
```typescript
const name = proposal?.resortName || proposalId
```

#### 3. Update PollResults - Remove Accommodation from Label
**File:** `src/PollResults.tsx`
**Changes:** Modify lines 50-52 to remove accommodation name:
```typescript
const name = proposal?.resortName || proposalId
```

#### 4. Update ProposalsGrid - Remove Accommodation Filter
**File:** `src/ProposalsGrid.tsx`
**Changes:** Remove line 81 (accommodationName filter from search)

#### 5. Update randomProposal Test Data
**File:** `src/randomProposal.ts`
**Changes:** Remove accommodation fields from Proposal interface and add Accommodation array

### Success Criteria

#### Automated Verification:
- [ ] `bun run test src/ProposalCard.test.tsx` - updated tests pass
- [ ] `bun run test src/PollVoting.test.tsx` - updated tests pass
- [ ] `bun run test src/PollResults.test.tsx` - updated tests pass
- [ ] `bunx tsc --noEmit` - no type errors

---

## Phase 4: Update Container Components

### Overview
Update parent components to load and pass accommodations to ProposalCard.

### Changes Required

#### 1. Update Proposals.tsx Container
**File:** `src/Proposals.tsx`
**Changes:**
- Import `listAccommodations`
- When loading proposals, also load accommodations for each proposal
- Pass accommodations as prop to ProposalCard

#### 2. Update ProposalsGrid Props
**File:** `src/ProposalsGrid.tsx`
**Changes:**
- Add `accommodations: Record<string, Accommodation[]>` prop
- Pass accommodations down to ProposalCard

### Success Criteria

#### Automated Verification:
- [ ] `bun run test src/Proposals.test.tsx` - updated tests pass
- [ ] `bun run test src/ProposalsGrid.test.tsx` - updated tests pass
- [ ] `bunx tsc --noEmit` - no type errors

#### Manual Verification:
- [ ] Proposal cards display accommodations in table layout
- [ ] Poll voting titles show only resort name (no accommodation)
- [ ] Poll result labels show only resort name (no accommodation)

---

## Phase 5: Backend Tests

### Overview
Add comprehensive tests for new accommodation functionality.

### Changes Required

#### 1. Add Accommodation CRUD Tests
**File:** `src/backend.test.ts`
**Changes:** Add test cases for:
- `createAccommodation` - success, max limit (5), non-owner error, non-DRAFT error
- `listAccommodations` - returns correct accommodations for proposal
- `updateAccommodation` - success, non-owner error, non-DRAFT error
- `deleteAccommodation` - success, non-owner error, non-DRAFT error

#### 2. Update Existing Tests
**File:** `src/backend.test.ts`
**Changes:**
- Update `deleteProposal` tests to verify cascade delete of accommodations
- Update `submitProposal` tests to verify accommodation count validation

### Success Criteria

#### Automated Verification:
- [ ] `bun run test src/backend.test.ts` - all tests pass
- [ ] `bunx tsc --noEmit` - no type errors
- [ ] `bun run lint src/backend.test.ts` - no lint errors

---

## Testing Strategy

### Unit Tests

**Backend:**
- Accommodation CRUD operations
- Cascade delete when proposal deleted
- Minimum 1 accommodation validation on submit
- Maximum 5 accommodation limit on create

**Frontend Components:**
- AccommodationInput sub-component renders correctly
- Add/remove accommodation buttons enabled/disabled appropriately
- Form validation prevents submission with 0 accommodations

### Integration Tests
- Full flow: create proposal with accommodations, edit, submit
- Delete proposal cascades to accommodations

### Manual Testing Steps
1. Create a new proposal in DRAFT state
2. Add 1-5 accommodations via the form
3. Verify "Add Accommodation" button disables at 5
4. Try to submit with 0 accommodations - should fail
5. Submit with 1+ accommodations - should succeed
6. Verify accommodations display in table on proposal card
7. Verify edit is locked after submission
8. Delete proposal - verify accommodations are cascade deleted

---

## Performance Considerations

- Accommodations are limited to 5 per proposal, so no pagination needed
- Use `Query.limit(5)` on accommodation queries
- Record-based state `Record<string, Accommodation>` provides O(1) updates

---

## Migration Notes

- No migration needed - database will be reset
- Remove old accommodation fields from proposals table in Appwrite console after deploy

---

## References

- Original ticket: `thoughts/tickets/feature_multiple_accommodations.md`
- Research: `thoughts/research/multiple_accommodations.md`
- Cascade delete pattern: `src/backend.ts:230-310` (deleteTrip)
- 1:N query pattern: `src/backend.ts:68-84` (listTripParticipants)
- Form array pattern: `src/PollVoting.tsx:37-48` (Record-based state)
