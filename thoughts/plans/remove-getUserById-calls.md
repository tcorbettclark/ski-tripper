# Remove getUserById Calls Implementation Plan

## Overview

Replace the many separate web calls to Appwrite to fetch user names by storing `userName` directly in PARTICIPANTS and `creatorName` in PROPOSALS at document creation time. This removes round-trip delays and simplifies the code.

## Current State Analysis

The `getUserById` function in `backend.js:107-119` makes separate web API calls to Appwrite's users endpoint to fetch user display names. This is called from multiple components:

- **TripRow.jsx:28** - Fetches coordinator name
- **TripOverview.jsx:53,66** - Fetches coordinator name, then all participant names via `Promise.all`
- **ProposalsRow.jsx:36** - Fetches proposal creator name
- **ProposalViewer.jsx:23** - Fetches proposal creator name

Each call adds latency and complexity. The `PUBLIC_APPWRITE_READ_USERS_API_KEY` is a read-only key intentionally exposed for these calls.

## Desired End State

1. User names stored at document creation time in Appwrite collections
2. No `getUserById` function, no separate user API calls
3. No `PUBLIC_APPWRITE_READ_USERS_API_KEY` env var needed
4. All tests pass without mocking `getUserById`

### Key Discoveries

- `createTrip` at `backend.js:88-105` creates PARTICIPANTS document without userName
- `joinTrip` at `backend.js:170-189` creates PARTICIPANTS document without userName
- `createProposal` at `backend.js:210-219` creates PROPOSALS document without creatorName
- User object (with name) is available from `account.get()` at creation time in components
- 11 test files mock `getUserById` and will need updating

## What We're NOT Doing

- No migration of existing documents (existing PARTICIPANTS/PROPOSALS docs lack userName/creatorName)
- No propagation of user name changes to existing documents
- No changes to Appwrite collection schemas (userName/creatorName added at appwrite layer)

## Implementation Approach

1. Modify backend create functions to accept and store user name
2. Update components to pass user name at creation time
3. Update display components to use stored name instead of calling getUserById
4. Remove getUserById entirely
5. Clean up env vars and tests

## Phase 1: Backend Changes

### Overview

Modify `createTrip`, `joinTrip`, and `createProposal` to accept a user name parameter and store it in Appwrite. Delete `getUserById`.

### Changes Required

#### 1. `createTrip` function

**File**: `src/backend.js:88-105`
**Changes**: Add `userName` parameter, store in PARTICIPANTS document

```javascript
export async function createTrip(userId, userName, data, db = databases) {
  const code = await findUniqueCode(db);
  const trip = await db.createDocument(
    DATABASE_ID,
    TRIPS_COLLECTION_ID,
    ID.unique(),
    { code, ...data },
    [Permission.read(Role.users()), Permission.write(Role.user(userId))],
  );
  await db.createDocument(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    ID.unique(),
    { userId, userName, tripId: trip.$id, role: "coordinator" },
    [Permission.read(Role.user(userId)), Permission.write(Role.user(userId))],
  );
  return trip;
}
```

#### 2. `joinTrip` function

**File**: `src/backend.js:170-189`
**Changes**: Add `userName` parameter, store in PARTICIPANTS document

```javascript
export async function joinTrip(userId, userName, tripId, db = databases) {
  // ... existing trip validation ...
  return db.createDocument(
    DATABASE_ID,
    PARTICIPANTS_COLLECTION_ID,
    ID.unique(),
    { userId, userName, tripId, role: "participant" },
    [Permission.read(Role.user(userId)), Permission.write(Role.user(userId))],
  );
}
```

#### 3. `createProposal` function

**File**: `src/backend.js:210-219`
**Changes**: Add `creatorName` parameter, store in PROPOSALS document

```javascript
export async function createProposal(
  tripId,
  userId,
  creatorName,
  data,
  db = databases,
) {
  await _verifyParticipant(tripId, userId, db);
  return db.createDocument(
    DATABASE_ID,
    PROPOSALS_COLLECTION_ID,
    ID.unique(),
    { tripId, userId, creatorName, state: "DRAFT", ...data },
    [Permission.read(Role.users()), Permission.write(Role.user(userId))],
  );
}
```

#### 4. Remove `getUserById`

**File**: `src/backend.js:107-119` and lines 121-123
**Changes**: Delete the function and the comment about PUBLIC_APPWRITE_READ_USERS_API_KEY

### Success Criteria

- [x] `bun run test src/backend.test.js` passes (after Phase 4 updates)

---

## Phase 2: Component Updates - Create Forms

### Overview

Update `CreateTripForm`, `JoinTripForm`, and `CreateProposalForm` to fetch user name from `account.get()` and pass it to the backend create functions.

### Changes Required

#### 1. CreateTripForm

**File**: `src/CreateTripForm.jsx`
**Changes**:

- Import `account` from backend
- Fetch user name on submit and pass to `createTrip`

#### 2. JoinTripForm

**File**: `src/JoinTripForm.jsx`
**Changes**:

- Import `account` from backend
- Fetch user name on submit and pass to `joinTrip`

#### 3. CreateProposalForm

**File**: `src/CreateProposalForm.jsx`
**Changes**:

- Import `account` from backend
- Fetch user name on submit and pass to `createProposal`

---

## Phase 3: Component Updates - Display Components

### Overview

Update display components to use `userName` from PARTICIPANTS documents and `creatorName` from PROPOSALS documents instead of calling `getUserById`.

### Changes Required

#### 1. TripRow

**File**: `src/TripRow.jsx`
**Changes**:

- Remove `getUserById` import and prop
- Get coordinator name from `documents[0].userName` instead of calling `getUserById`

```javascript
// Before:
getCoordinatorParticipant(trip.$id)
  .then(({ documents }) => {
    if (!mountedRef.current || documents.length === 0) return;
    return getUserById(documents[0].userId);
  })
  .then((c) => {
    if (mountedRef.current && c) setCoordinator(c);
  });

// After:
getCoordinatorParticipant(trip.$id).then(({ documents }) => {
  if (!mountedRef.current || documents.length === 0) return;
  setCoordinator({ name: documents[0].userName });
});
```

#### 2. TripOverview

**File**: `src/TripOverview.jsx`
**Changes**:

- Remove `getUserById` import and prop
- Get coordinator name from `documents[0].userName`
- Get participant names from `tripParticipants[i].userName` instead of `Promise.all(getUserById...)`

#### 3. ProposalsRow

**File**: `src/ProposalsRow.jsx`
**Changes**:

- Remove `getUserById` import and prop
- Use `proposal.creatorName` instead of calling `getUserById`

#### 4. ProposalViewer

**File**: `src/ProposalViewer.jsx`
**Changes**:

- Remove `getUserById` import and prop
- Use `proposal.creatorName` instead of calling `getUserById`

---

## Phase 4: App.jsx Cleanup

### Overview

Remove `getUserById` from App.jsx imports and prop passing to child components.

### Changes Required

**File**: `src/App.jsx`
**Changes**:

- Remove `getUserById as _getUserById` from backend imports
- Remove `getUserById` from props passed to TripRow, TripOverview, ProposalsRow, ProposalViewer

---

## Phase 5: Test Updates

### Overview

Remove all `getUserById` mocks from test files.

### Files to Update

| File                              | Line                                          | Change                   |
| --------------------------------- | --------------------------------------------- | ------------------------ |
| `src/App.test.jsx`                | 31, 134                                       | Remove getUserById mock  |
| `src/TripOverview.test.jsx`       | 18                                            | Remove getUserById mock  |
| `src/TripRow.test.jsx`            | 20                                            | Remove getUserById mock  |
| `src/TripTable.test.jsx`          | 20                                            | Remove getUserById mock  |
| `src/Trips.test.jsx`              | 23                                            | Remove getUserById mock  |
| `src/Proposals.test.jsx`          | 22, 87                                        | Remove getUserById mock  |
| `src/ProposalsRow.test.jsx`       | 35                                            | Remove getUserById mock  |
| `src/ProposalsTable.test.jsx`     | 34                                            | Remove getUserById mock  |
| `src/ProposalViewer.test.jsx`     | 63, 116, 123, 125                             | Remove getUserById mock  |
| `src/backend.test.js`             | 306-319                                       | Remove getUserById tests |
| `src/CreateTripForm.test.jsx`     | Mock `account.get()` to return user with name |
| `src/JoinTripForm.test.jsx`       | Mock `account.get()` to return user with name |
| `src/CreateProposalForm.test.jsx` | Mock `account.get()` to return user with name |

### Success Criteria

- [x] `bun run test` passes

---

## Phase 6: Environment Cleanup

### Overview

Remove `PUBLIC_APPWRITE_READ_USERS_API_KEY` from `.env` and any deployment configuration.

### Files to Update

- `.env` - Remove `PUBLIC_APPWRITE_READ_USERS_API_KEY`
- Any deployment config (Vercel, etc.) - Remove the environment variable

---

## Phase 7: Verification

### Overview

Run full test suite and lint to verify the refactor is complete.

### Success Criteria

#### Automated Verification:

- [x] `bun run test` passes
- [x] `bun run lint` passes

#### Manual Verification:

- [ ] Create a new trip - coordinator name appears correctly
- [ ] Join a trip - participant name appears correctly
- [ ] Create a proposal - creator name appears correctly in ProposalsRow and ProposalViewer

---

## Testing Strategy

### Unit Tests

- Backend functions tested with mocked Appwrite SDK
- Create form components test the full flow with mocked `account.get()` and `createTrip`/`joinTrip`/`createProposal`

### Integration Tests

- Manual verification via browser testing

## Migration Notes

Existing documents in Appwrite will not have `userName` or `creatorName` fields. This is acceptable per the requirements - the feature works for new documents only. A future migration could backfill existing documents if needed.

## References

- Original ticket: `thoughts/tickets/refactor-1.md`
- Research: `thoughts/research/2026-03-28_refactor-remove-getUserById-calls.md`
