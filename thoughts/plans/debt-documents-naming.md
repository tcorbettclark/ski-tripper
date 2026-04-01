# DEBT-001: Rename Generic "documents" Property to Specific Type Names

## Overview

Replace generic `documents` property in function return types across backend and frontend with specific names matching the data type (e.g., `documents: TripRow[]` → `trips: TripRow[]`).

## Current State Analysis

The `documents` property is used as a generic wrapper for all array returns from Appwrite queries. The `fetchRows<T>` helper at `src/backend.ts:81-86` returns `{ documents: T[] }` and all 8 public API functions that return arrays use this pattern. Frontend components and tests also reference `documents` in their prop types and mock returns.

**Key files:**
- `src/backend.ts` - Core implementation (818 lines)
- `src/App.tsx`, `src/Trips.tsx`, `src/TripOverview.tsx`, etc. - Frontend components
- `src/App.test.tsx`, etc. - Component tests
- `src/backend.test.ts` - Backend tests

## Desired End State

All function return types and local variables use specific property names:

| Return type | Property name | Local variable |
|-------------|---------------|----------------|
| `TripRow[]` | `trips` | `trips` |
| `ProposalRow[]` | `proposals` | `proposals` |
| `PollRow[]` | `polls` | `polls` |
| `VoteRow[]` | `votes` | `votes` |
| `ParticipantRow[]` | `participants` | `participants` |

### Key Discoveries

- `src/backend.ts:81-86` - `fetchRows<T>` returns `{ documents: T[] }` internally. Callers use destructuring rename (e.g., `const { documents: trips }`) to get specific names.
- `src/backend.ts:172` - Already uses `const { documents: trips }` pattern
- `src/backend.ts:213, 271, 303, 330, 368, 405, 429` - Internal functions use unnamed `const { documents }` which will become `const { documents: participants }` or similar
- `src/App.tsx:22-53` - Prop types define `documents` properties mirroring backend return types

## What We're NOT Doing

- Renaming `fetchRows<T>` helper - it remains internal
- Renaming frontend types (`Trip[]`, `Proposal[]`) to `TripRow[]`, `ProposalRow[]` - per research notes, backend types will be renamed in future
- Adding new functionality - purely a rename refactor

## Implementation Approach

Backend-first: Update backend types and implementations, verify tests pass, then update frontend components, then update component tests.

## Phase 1: Update `src/backend.ts` Return Types

### Changes Required

**1. Return type signatures (8 functions):**

| Function | Line | Change |
|----------|------|--------|
| `getCoordinatorParticipant` | 113 | `Promise<{ documents: ParticipantRow[] }>` → `Promise<{ participants: ParticipantRow[] }>` |
| `listTripParticipants` | 130 | `Promise<{ documents: ParticipantRow[] }>` → `Promise<{ participants: ParticipantRow[] }>` |
| `listTrips` | 148 | `documents: TripRow[]` → `trips: TripRow[]` |
| `getTripByCode` | 200 | `Promise<{ documents: TripRow[] }>` → `Promise<{ trips: TripRow[] }>` |
| `listParticipatedTrips` | 329 | `Promise<{ documents: TripRow[] }>` → `Promise<{ trips: TripRow[] }>` |
| `listProposals` | 487 | `Promise<{ documents: ProposalRow[] }>` → `Promise<{ proposals: ProposalRow[] }>` |
| `listPolls` | 728 | `Promise<{ documents: PollRow[] }>` → `Promise<{ polls: PollRow[] }>` |
| `listVotes` | 809 | `Promise<{ documents: VoteRow[] }>` → `Promise<{ votes: VoteRow[] }>` |

**2. Internal destructuring (use rename syntax):**

| Line | Current | Changed To |
|------|---------|------------|
| 151 | `const { documents: coordinatorParticipants }` | unchanged |
| 166 | `return { documents: [], coordinatorUserIds: {} }` | `return { participants: [], coordinatorUserIds: {} }` |
| 172 | `const { documents: trips }` | unchanged |
| 181 | `return { documents: orderedTrips, coordinatorUserIds }` | `return { trips: orderedTrips, coordinatorUserIds }` |
| 213 | `const { documents }` | `const { documents: trips }` |
| 220 | `documents.length === 0` | `trips.length === 0` |
| 271 | `const { documents }` | `const { documents: participants }` |
| 273-274 | `documents.length`, `documents[0]` | `participants.length`, `participants[0]` |
| 293 | `const { documents: coordinatorDocs }` | unchanged |
| 303 | `const { documents }` | `const { documents: participants }` |
| 311 | `documents.map` | `participants.map` |
| 330 | `const { documents }` | `const { documents: participants }` |
| 341 | `return { documents: [] }` | `return { participants: [] }` |
| 343 | `const { documents: trips }` | unchanged |
| 350 | `return { documents: trips }` | `return { trips }` |
| 368 | `const { documents }` | `const { documents: participants }` |
| 379 | `documents.length > 0` | `participants.length > 0` |
| 405 | `const { documents }` | `const { documents: participants }` |
| 416-420 | `documents.length`, `documents[0]` | `participants.length`, `participants[0]` |
| 429 | `const { documents }` | `const { documents: participants }` |
| 440-441 | `documents.length` | `participants.length` |
| 615 | `const { documents }` | `const { documents: participants }` |
| 617-618 | `documents.length`, `documents[0]` | `participants.length`, `participants[0]` |
| 638 | `const { documents: coordDocs }` | unchanged |
| 645 | `const { documents: openPolls }` | unchanged |
| 659 | `const { documents: proposals }` | unchanged |
| 707 | `const { documents }` | `const { documents: participants }` |
| 709-710 | `documents.length`, `documents[0]` | `participants.length`, `participants[0]` |
| 766 | `const { documents }` | `const { documents: votes }` |
| 777, 782 | `documents.length`, `documents[0]` | `votes.length`, `votes[0]` |

**Note:** `fetchRows<T>` itself (line 81-86) keeps `documents` internally - only callers rename on destructuring.

### Success Criteria

#### Automated Verification:
- [x] `bun run lint` passes with no errors
- [x] `bun run typecheck` passes with no failures

---

## Phase 2: Update `src/backend.test.ts`

### Changes Required

Update all test assertions referencing `result.documents` or `{ documents: [] }`:

| Line | Current | Changed To |
|------|---------|------------|
| 68-69 | `result.documents` | `result.participants` |
| 78 | `result.documents.toHaveLength(0)` | `result.participants.toHaveLength(0)` |
| 123 | `result.documents[0].code` | `result.trips[0].code` |
| 129 | `result.documents.toHaveLength(0)` | `result.trips.toHaveLength(0)` |
| 337 | `{ documents: [] }` | `{ trips: [] }` (as mock return) |
| 357-358 | `result.documents`, `result.documents[0].$id` | `result.participants`, `result.participants[0].$id` |
| 442-443 | `result.documents`, `result.documents[0].$id` | `result.trips`, `result.trips[0].$id` |
| 953-954 | `result.documents`, `result.documents[0].$id` | `result.proposals`, `result.proposals[0].$id` |
| 1083-1084 | `result.documents`, `result.documents[0].$id` | `result.polls`, `result.polls[0].$id` |

### Success Criteria

#### Automated Verification:
- [x] `bun run test src/backend.test.ts` passes with no failures

---

## Phase 3: Update Frontend Components

### Changes Required

**`src/App.tsx`:**

| Line | Current | Changed To |
|------|---------|------------|
| 23 | `documents:` | `trips:` |
| 32 | `documents:` | `trips:` |
| 35 | `documents:` | `participants:` |
| 49 | `documents:` | `participants:` |
| 101, 104 | `ownRes.documents` | `ownRes.trips` |
| 105-107 | `participatedRes.documents` | `participatedRes.trips` |
| 127, 130 | `ownRes.documents` | `ownRes.trips` |
| 131-133 | `participatedRes.documents` | `participatedRes.trips` |

**`src/Trips.tsx`:**
- Line 29: Prop type `documents: Trip[]` → `trips: Trip[]`
- Line 37: Prop type `documents: Array<{...}>` → `trips: Array<{...}>`

**`src/TripOverview.tsx`:**
- Lines 24, 31: Prop types `documents:` → `trips:` and `participants:`
- Lines 79-84: `.then(({ documents }) => {` → `.then(({ trips }) => {`

**`src/TripRow.tsx`:**
- Line 13: Prop type `documents:` → `trips:`
- Lines 34-36: `const { documents } = await` → `const { trips } = await`

**`src/TripTable.tsx`:**
- Line 16: Prop type `documents:` → `trips:`

**`src/Proposals.tsx`:**
- Lines 34, 62: Prop types `documents:` → `proposals:` and `participants:`
- Lines 109-112: `proposalsResult.documents` → `proposalsResult.proposals`, `coordResult.documents` → `coordResult.participants`

**`src/Poll.tsx`:**
- Lines 42, 46, 51, 67: Prop types `documents:` → `polls:`, `proposals:`, `votes:`, `participants:`
- Lines 125-136: `coordResult.documents` → `coordResult.participants`, `proposalsResult.documents` → `proposalsResult.proposals`, `pollsResult.documents` → `pollsResult.polls`, `votesResult.documents` → `votesResult.votes`

**`src/JoinTripForm.tsx`:**
- Line 15: Prop type `documents: unknown[]` → `trips: unknown[]`
- Lines 42-44: `res.documents.length` → `res.trips.length`, `res.documents[0]` → `res.trips[0]`

**`src/ParticipantList.tsx`:**
- Line 14: Prop type `documents:` → `participants:`
- Lines 34-36: `const { documents } = await listTripParticipants(tripId)` → `const { participants } = await listTripParticipants(tripId)`

### Success Criteria

#### Automated Verification:
- [x] `bun run lint` passes with no errors
- [x] `bun run typecheck` passes with no failures

---

## Phase 4: Update Component Tests

### Changes Required

Update all mock returns and assertions in test files to use new property names:

**`src/App.test.tsx`:** Lines 27-33, 44-50, 182, 190, 196-198  
**`src/Trips.test.tsx`:** Lines 25, 32  
**`src/TripOverview.test.tsx`:** Lines 27, 36  
**`src/TripRow.test.tsx`:** Line 25  
**`src/TripTable.test.tsx`:** Line 20  
**`src/Proposals.test.tsx`:** Lines 28, 38, 46, 61, 103, 117, 139, 155, 159, 177, 181  
**`src/Poll.test.tsx`:** Lines 26-28, 32, 44, 61, 76, 88, 91, 107, 109, 124  
**`src/JoinTripForm.test.tsx`:** Lines 21, 45, 61, 78, 109  
**`src/ParticipantList.test.tsx`:** Lines 22, 45

### Success Criteria

#### Automated Verification:
- [x] `bun run test` passes with no failures

---

## Overall Success Criteria

### Automated Verification:
- [x] `bun run lint` passes with no errors
- [x] `bun run typecheck` passes with no failures
- [x] `bun run test` passes with no failures

### Manual Verification:
- [x] Code is more readable with specific property names
- [x] No lingering `documents` references in the affected files

---

## Implementation Order

1. Phase 1: Update `src/backend.ts` - types and implementations
2. Phase 2: Update `src/backend.test.ts` - backend tests
3. Phase 3: Update frontend components - prop types and usage
4. Phase 4: Update component tests - all test mocks and assertions
5. Run full test suite and fix any issues

## References

- Original ticket: `thoughts/tickets/debt-documents-naming.md`
- Research: `thoughts/research/2026-04-01_debt-documents-naming.md`
